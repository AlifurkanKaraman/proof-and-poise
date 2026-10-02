import type { ErrorCode, RouteName } from '@proof-and-poise/shared';

/**
 * Where a failure came from:
 * - `http`: the API answered with `{ error: { code, message, fields? } }` (or a non-contract error body).
 * - `network`: the request never got a response (offline, DNS, CORS, aborted).
 * - `invalid_request`: the client refused to send a body that fails the shared schema.
 * - `invalid_response`: a success response didn't match the contract (design §8).
 * - `no_session`: a session route was called without a stored token for that session.
 */
export type ApiErrorKind =
  'http' | 'network' | 'invalid_request' | 'invalid_response' | 'no_session';

export interface ApiErrorInit {
  kind: ApiErrorKind;
  code: ErrorCode;
  message: string;
  route: RouteName;
  status?: number | null;
  fields?: Record<string, string>;
}

/** The only error type the API client throws. */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly kind: ApiErrorKind;
  readonly code: ErrorCode;
  readonly route: RouteName;
  readonly status: number | null;
  readonly fields: Readonly<Record<string, string>> | undefined;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.kind = init.kind;
    this.code = init.code;
    this.route = init.route;
    this.status = init.status ?? null;
    this.fields = init.fields;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

/** Plain-language messages for error states; server messages may be more specific. */
const USER_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION: 'Some of the information is not valid. Check the highlighted fields and try again.',
  UNAUTHORIZED: 'Your session has ended or is not available in this tab. Start again to continue.',
  NOT_FOUND: 'We could not find that. It may have expired.',
  QUOTA_EXCEEDED: 'You have reached the limit for this session.',
  CAPACITY_REACHED: 'The service is at capacity right now. Try again in a few minutes.',
  MODEL_OUTPUT_INVALID: 'The AI response could not be verified. Try again.',
  UPSTREAM_UNAVAILABLE: 'The service is temporarily unavailable. Try again in a moment.',
  EXTRACTION_FAILED: 'We could not read text from that file. Paste the text instead.',
  CONFLICT: 'This was already done. Refresh to see the latest state.',
  INTERNAL: 'Something went wrong on our side. Try again.',
};

/** Message for an error code reported in a status body, e.g. a failed analysis. */
export function codeMessage(code: ErrorCode): string {
  return USER_MESSAGES[code];
}

export function userMessage(error: unknown): string {
  if (!isApiError(error)) return USER_MESSAGES.INTERNAL;
  if (error.kind === 'network')
    return 'We could not reach the server. Check your connection and try again.';
  return USER_MESSAGES[error.code];
}

/** Retrying only helps with transient failures; 4xx and contract mismatches won't change. */
export function isRetryable(error: unknown): boolean {
  if (!isApiError(error)) return false;
  if (error.kind === 'network') return true;
  return error.kind === 'http' && (error.status ?? 0) >= 500 && error.code !== 'CAPACITY_REACHED';
}
