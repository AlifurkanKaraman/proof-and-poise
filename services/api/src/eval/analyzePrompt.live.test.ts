/**
 * LIVE prompt evaluation against Amazon Bedrock (task 9). Skipped unless
 * RUN_BEDROCK_EVAL=1, because it makes billable Converse calls (≤ 8, well under $0.01 on
 * Nova Lite) with your local AWS credentials. See docs/analysis-prompt-evaluation.md.
 *
 *   RUN_BEDROCK_EVAL=1 BEDROCK_EVAL_OUT=/tmp/analysis-eval.json \
 *     pnpm --filter @proof-and-poise/api exec vitest run src/eval/analyzePrompt.live.test.ts
 *
 * Only counts and pass/fail flags are written to BEDROCK_EVAL_OUT; no resume or model text.
 */
import { writeFileSync } from 'node:fs';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { afterAll, describe, expect, it } from 'vitest';
import { invokeStructured, type ModelDeps } from '../ai/invokeStructured';
import { analyzeRequest } from '../ai/prompts/analyze';
import { ApiError } from '../lib/errors';
import { createLogger } from '../lib/logger';
import { evaluateAnalysis, type EvalResult } from './evaluate';
import { EVAL_CASES } from './samples';

const LIVE = process.env['RUN_BEDROCK_EVAL'] === '1';
const MODEL_ID = process.env['MODEL_ID'] ?? 'us.amazon.nova-lite-v1:0';
/** Hard cap on billable calls for one run: 2 attempts per case. */
const MAX_CALLS = EVAL_CASES.length * 2;

const results: (EvalResult | { caseId: string; pass: false; errorCode: string })[] = [];
const logLines: string[] = [];
let calls = 0;

const deps = (): ModelDeps => ({
  bedrock: new BedrockRuntimeClient({ region: 'us-east-1' }),
  modelId: MODEL_ID,
  quotas: {
    consumeGlobal: () => {
      if (++calls > MAX_CALLS) throw new ApiError('CAPACITY_REACHED');
      return Promise.resolve(calls);
    },
  },
  log: createLogger((l) => logLines.push(l)),
  now: Date.now,
});

describe.skipIf(!LIVE)('analysis prompt, live Bedrock evaluation', () => {
  for (const c of EVAL_CASES) {
    it(`${c.id}: ${c.focus}`, { timeout: 120_000 }, async () => {
      try {
        const output = await invokeStructured(deps(), analyzeRequest(c.resumeText, c.job));
        const result = evaluateAnalysis(c, output);
        results.push(result);
        expect(result.checks).toMatchObject({ mapValid: true, gapListed: true });
        expect(result.pass).toBe(true);
      } catch (err) {
        if (err instanceof ApiError)
          results.push({ caseId: c.id, pass: false, errorCode: err.code });
        throw err;
      }
    });
  }

  afterAll(() => {
    const out = process.env['BEDROCK_EVAL_OUT'];
    if (!out) return;
    const usage = logLines
      .map((l) => JSON.parse(l) as Record<string, unknown>)
      .filter((l) => l['event'] === 'model_call');
    writeFileSync(
      out,
      JSON.stringify(
        {
          modelId: MODEL_ID,
          at: new Date().toISOString(),
          passRate: `${results.filter((r) => r.pass).length}/${EVAL_CASES.length}`,
          results,
          modelCalls: usage.map(({ task, attempt, inputTokens, outputTokens, durationMs }) => ({
            task,
            attempt,
            inputTokens,
            outputTokens,
            durationMs,
          })),
        },
        null,
        2,
      ),
    );
  });
});
