import { z } from 'zod';

export const ERROR_CODES = [
  'VALIDATION',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'QUOTA_EXCEEDED',
  'CAPACITY_REACHED',
  'MODEL_OUTPUT_INVALID',
  'UPSTREAM_UNAVAILABLE',
  'EXTRACTION_FAILED',
  'CONFLICT',
  'INTERNAL',
] as const;
export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/** HTTP status for each error code (design §8, Req 16.4). */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  EXTRACTION_FAILED: 422,
  QUOTA_EXCEEDED: 429,
  INTERNAL: 500,
  MODEL_OUTPUT_INVALID: 502,
  UPSTREAM_UNAVAILABLE: 503,
  CAPACITY_REACHED: 503,
};

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string().max(300),
    /** Field path → error code (never echoes input values). */
    fields: z.record(z.string(), z.string()).optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
