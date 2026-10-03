/**
 * Allowlisted structured logger (Req 15.3, design §11).
 *
 * Only the fields declared in `LogFields` are ever written, and each is type-checked at
 * runtime, so request bodies, resume/job text, answers, transcripts, and model I/O can't
 * leak even if a caller passes an arbitrary object. Errors are reduced to `{ code, name }`;
 * `message` is never logged because SDK messages can echo input.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogFields {
  requestId?: string;
  route?: string;
  status?: number;
  latencyMs?: number;
  errorCode?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  /** Model task name, e.g. `analyze` (design §7.2). */
  task?: string;
  /** 1-based model call attempt (1 = first call, 2 = repair retry). */
  attempt?: number;
  /** Counts only, never content (design §7.4). */
  discardedQuotes?: number;
  discardedRecommendations?: number;
  discardedCompetencies?: number;
  discardedKeywords?: number;
  /** Bedrock `stopReason`, a fixed enum such as `tool_use` or `max_tokens`. */
  stopReason?: string;
  /**
   * Why model output failed validation, as keys like `competencies.3.jobQuote:too_big` or
   * `check:keywords`: field paths plus a Zod code or check name, never messages or values.
   */
  issues?: string[];
}

type FieldKind = 'string' | 'number' | 'strings';

/** List fields keep at most this many entries. */
const MAX_LIST_ITEMS = 20;

const ALLOWED: Record<keyof LogFields, FieldKind> = {
  requestId: 'string',
  route: 'string',
  status: 'number',
  latencyMs: 'number',
  errorCode: 'string',
  inputTokens: 'number',
  outputTokens: 'number',
  durationMs: 'number',
  task: 'string',
  attempt: 'number',
  discardedQuotes: 'number',
  discardedRecommendations: 'number',
  discardedCompetencies: 'number',
  discardedKeywords: 'number',
  stopReason: 'string',
  issues: 'strings',
};

/** Allowlisted string values must look like identifiers, not free text. */
const SAFE_STRING = /^[A-Za-z0-9_\-./{}:$ ]{1,128}$/;
const SAFE_EVENT = /^[a-z0-9_.]{1,64}$/;
/** List entries are stricter than strings: path-like keys only, no spaces. */
const SAFE_KEY = /^[A-Za-z0-9_.:]{1,96}$/;

export interface SafeError {
  code: string;
  name: string;
}

export type LogSink = (line: string) => void;

// eslint-disable-next-line no-console -- the only sanctioned console use.
const defaultSink: LogSink = (line) => console.log(line);

export function pickAllowed(fields: unknown): LogFields {
  const out: Record<string, string | number | string[]> = {};
  if (typeof fields !== 'object' || fields === null) return out;
  for (const [key, kind] of Object.entries(ALLOWED)) {
    const value = (fields as Record<string, unknown>)[key];
    if (kind === 'number' && typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value;
    } else if (kind === 'string' && typeof value === 'string' && SAFE_STRING.test(value)) {
      out[key] = value;
    } else if (kind === 'strings' && Array.isArray(value)) {
      // Entries must be path-like keys (no spaces); free-text entries are dropped.
      const safe = value
        .filter((v): v is string => typeof v === 'string' && SAFE_KEY.test(v))
        .slice(0, MAX_LIST_ITEMS);
      if (safe.length > 0) out[key] = safe;
    }
  }
  return out as LogFields;
}

export function toSafeError(err: unknown): SafeError {
  const e = (typeof err === 'object' && err !== null ? err : {}) as Record<string, unknown>;
  const rawCode = e['code'] ?? e['errorCode'];
  const rawName = e['name'];
  const code = typeof rawCode === 'string' && SAFE_STRING.test(rawCode) ? rawCode : 'UNKNOWN';
  const name = typeof rawName === 'string' && SAFE_STRING.test(rawName) ? rawName : 'Error';
  return { code, name };
}

export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, err: unknown, fields?: LogFields): void;
}

export function createLogger(sink: LogSink = defaultSink): Logger {
  const write = (level: LogLevel, event: string, fields: unknown, err?: SafeError) => {
    const line: Record<string, unknown> = {
      level,
      event: SAFE_EVENT.test(event) ? event : 'invalid_event_name',
      at: new Date().toISOString(),
      ...pickAllowed(fields),
    };
    if (err) line['error'] = err;
    sink(JSON.stringify(line));
  };
  return {
    info: (event, fields) => write('info', event, fields),
    warn: (event, fields) => write('warn', event, fields),
    error: (event, err, fields) => write('error', event, fields, toSafeError(err)),
  };
}

export const logger = createLogger();
