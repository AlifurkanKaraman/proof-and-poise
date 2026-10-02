/**
 * `invokeStructured` (design §7.1): one Bedrock Converse call with a single forced tool
 * whose input schema is generated from the shared Zod model-output schema.
 *
 * - Per-task `maxTokens` and temperature come from `LIMITS.model` (Req 16.5).
 * - The global daily Bedrock budget is reserved before every call (Req 16.4); when it's
 *   exhausted the call never happens and `CAPACITY_REACHED` is thrown.
 * - Output is used only after `schema.safeParse` plus optional semantic checks pass. On
 *   failure it retries once with the compact list of validation errors; a second failure
 *   throws `MODEL_OUTPUT_INVALID` (Req 5.3). No partial output is returned.
 * - Only token counts, task, attempt, and duration are logged (Req 15.3). Prompts, tool
 *   input, and validation messages never reach the logger.
 * - If the model rejects `toolChoice: { tool }`, it falls back to `auto` plus an instruction
 *   to call the tool; validation still gates the result.
 * - A truncated or malformed tool call (`max_tokens` stop, or Bedrock's
 *   `ModelErrorException`) counts as invalid output, not an outage: it gets the repair retry
 *   and ends in `MODEL_OUTPUT_INVALID`.
 */
import {
  ConverseCommand,
  type BedrockRuntimeClient,
  type ContentBlock,
  type ConverseCommandOutput,
  type ToolChoice,
} from '@aws-sdk/client-bedrock-runtime';
import type { z } from 'zod';
import { LIMITS, type ModelTask } from '@proof-and-poise/shared';
import type { QuotaCounters } from '../data/quotas';
import { ApiError } from '../lib/errors';
import type { Logger } from '../lib/logger';
import { toolSpec } from './tools';

export interface ModelDeps {
  bedrock: BedrockRuntimeClient;
  modelId: string;
  quotas: Pick<QuotaCounters, 'consumeGlobal'>;
  log: Logger;
  now: () => number;
}

export interface StructuredRequest<S extends z.ZodType> {
  task: ModelTask;
  toolName: string;
  toolDescription: string;
  schema: S;
  system: string;
  /** User message; user-supplied content must already be wrapped in delimited tags. */
  user: string;
  /** Semantic checks beyond the schema (e.g. unique IDs). Returns issue strings; [] = ok. */
  check?: (output: z.infer<S>) => string[];
  /**
   * Advisory checks: issues trigger the repair retry, but output that passes `schema` and
   * `check` is never rejected for them. If the retry is worse, the earlier output is used.
   */
  softCheck?: (output: z.infer<S>) => string[];
  /** Epoch ms after which the call is aborted (Req 5.5). */
  deadlineMs?: number;
}

/** At most this many validation issues are echoed back to the model on the repair retry. */
const MAX_REPAIR_ISSUES = 20;
const MAX_ATTEMPTS = 2;

type Attempt<T> = { ok: true; value: T } | { ok: false; issues: string[]; usable?: T };

/** Marker for a tool call that was cut off or malformed (design §7.1). */
const TRUNCATED = Symbol('truncated');

/** Bedrock's error when a model produces an invalid or incomplete tool call. */
const isModelError = (err: unknown) =>
  typeof err === 'object' &&
  err !== null &&
  (err as { name?: unknown }).name === 'ModelErrorException';

const TRUNCATED_ISSUE =
  'Your previous call was cut off or malformed. Use fewer items and shorter quotes and text.';

function toolInput(res: ConverseCommandOutput, toolName: string): unknown {
  if (res.stopReason === 'max_tokens') return TRUNCATED;
  const blocks: ContentBlock[] = res.output?.message?.content ?? [];
  for (const b of blocks) {
    if (b.toolUse?.name === toolName) return b.toolUse.input;
  }
  return undefined;
}

function compactIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}

const isToolChoiceRejection = (err: unknown) =>
  typeof err === 'object' &&
  err !== null &&
  (err as { name?: unknown }).name === 'ValidationException';

export async function invokeStructured<S extends z.ZodType>(
  deps: ModelDeps,
  req: StructuredRequest<S>,
): Promise<z.infer<S>> {
  const { maxTokens, temperature } = LIMITS.model[req.task];
  const tool = toolSpec(req.toolName, req.toolDescription, req.schema);
  let toolChoice: ToolChoice = { tool: { name: req.toolName } };
  let fallbackInstruction = '';
  let issues: string[] = [];

  let usable: z.infer<S> | undefined;
  const validate = (input: unknown, last: boolean): Attempt<z.infer<S>> => {
    if (input === TRUNCATED) return { ok: false, issues: [TRUNCATED_ISSUE] };
    if (input === undefined) return { ok: false, issues: [`No ${req.toolName} tool call.`] };
    const parsed = req.schema.safeParse(input);
    if (!parsed.success) return { ok: false, issues: compactIssues(parsed.error) };
    const semantic = req.check?.(parsed.data) ?? [];
    if (semantic.length > 0) return { ok: false, issues: semantic };
    const soft = last ? [] : (req.softCheck?.(parsed.data) ?? []);
    return soft.length > 0
      ? { ok: false, issues: soft, usable: parsed.data }
      : { ok: true, value: parsed.data };
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const repair =
      issues.length > 0
        ? `\n\nYour previous ${req.toolName} call failed validation:\n- ${issues
            .slice(0, MAX_REPAIR_ISSUES)
            .join('\n- ')}\nCall ${req.toolName} again with corrected input.`
        : '';
    const input = (): ConverseInput => ({
      modelId: deps.modelId,
      system: [{ text: req.system + fallbackInstruction }],
      messages: [{ role: 'user', content: [{ text: req.user + repair }] }],
      inferenceConfig: { maxTokens, temperature },
      toolConfig: { tools: [tool], toolChoice },
    });
    const forced = 'tool' in toolChoice;
    const res = await send(deps, req, attempt, input(), forced).catch((err: unknown) => {
      // Fallback (design §7.1 step 5): the model rejected forced tool choice.
      if (!forced || !isToolChoiceRejection(err)) throw err;
      deps.log.warn('model_tool_choice_fallback', { task: req.task, attempt });
      toolChoice = { auto: {} };
      fallbackInstruction = `\n\nAlways respond by calling the ${req.toolName} tool exactly once.`;
      return send(deps, req, attempt, input(), false);
    });
    const last = attempt === MAX_ATTEMPTS;
    const result = validate(res === TRUNCATED ? TRUNCATED : toolInput(res, req.toolName), last);
    if (result.ok) return result.value;
    if (result.usable !== undefined) usable = result.usable;
    issues = result.issues;
    deps.log.warn('model_output_invalid', { task: req.task, attempt });
  }
  // The retry failed hard, but an earlier answer passed every required check.
  if (usable !== undefined) return usable;
  throw new ApiError('MODEL_OUTPUT_INVALID');
}

type ConverseInput = ConstructorParameters<typeof ConverseCommand>[0];

/**
 * Reserve budget, call Converse, log token usage only. SDK failures become
 * `UPSTREAM_UNAVAILABLE`, except a `ValidationException` when `rethrowValidation` is set,
 * which the caller turns into the tool-choice fallback.
 */
async function send<S extends z.ZodType>(
  deps: ModelDeps,
  req: StructuredRequest<S>,
  attempt: number,
  input: ConverseInput,
  rethrowValidation: boolean,
): Promise<ConverseCommandOutput | typeof TRUNCATED> {
  // Throws CAPACITY_REACHED before any Bedrock call once today's cap is used (Req 16.4).
  await deps.quotas.consumeGlobal('bedrockCalls', 1, deps.now());
  const started = deps.now();
  const remaining = req.deadlineMs === undefined ? undefined : req.deadlineMs - started;
  if (remaining !== undefined && remaining <= 0) throw new ApiError('UPSTREAM_UNAVAILABLE');
  try {
    const res = await deps.bedrock.send(
      new ConverseCommand(input),
      remaining === undefined ? {} : { abortSignal: AbortSignal.timeout(remaining) },
    );
    deps.log.info('model_call', {
      task: req.task,
      attempt,
      inputTokens: res.usage?.inputTokens ?? 0,
      outputTokens: res.usage?.outputTokens ?? 0,
      durationMs: deps.now() - started,
      ...(res.stopReason ? { stopReason: res.stopReason } : {}),
    });
    return res;
  } catch (err) {
    if (rethrowValidation && isToolChoiceRejection(err)) throw err;
    if (isModelError(err)) {
      // The model's tool call was malformed or too long; repairable, not an outage.
      deps.log.warn('model_call_truncated', {
        task: req.task,
        attempt,
        durationMs: deps.now() - started,
      });
      return TRUNCATED;
    }
    deps.log.error('model_call_failed', err, {
      task: req.task,
      attempt,
      durationMs: deps.now() - started,
    });
    throw new ApiError('UPSTREAM_UNAVAILABLE');
  }
}
