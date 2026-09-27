/**
 * API error model (design §8). Every error response is `{ error: { code, message, fields? } }`.
 * Codes and HTTP statuses come from the shared contract so client and server agree.
 */
import { ERROR_STATUS, type ErrorCode, type ErrorResponse } from '@proof-and-poise/shared';

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION: 'The request is invalid.',
  UNAUTHORIZED: 'Missing or invalid session token.',
  NOT_FOUND: 'Not found.',
  QUOTA_EXCEEDED: 'This session has reached its limit for this action.',
  CAPACITY_REACHED: 'Daily capacity reached. Try the demo or type your answers.',
  MODEL_OUTPUT_INVALID: 'The AI response could not be validated. Please try again.',
  UPSTREAM_UNAVAILABLE: 'A dependent service is unavailable. Please try again.',
  EXTRACTION_FAILED: 'We could not read text from that file. Paste the text instead.',
  CONFLICT: 'This action conflicts with the current state.',
  INTERNAL: 'Something went wrong. Please try again.',
};

export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields: Record<string, string> | undefined;

  constructor(code: ErrorCode, message?: string, fields?: Record<string, string>) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.fields = fields;
  }

  toBody(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
      },
    };
  }
}

/** Anything that isn't an ApiError becomes a generic INTERNAL error (no detail leaks). */
export function toApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError('INTERNAL');
}
