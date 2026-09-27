/**
 * Request body parsing against the shared Zod schemas. Validation errors map field paths
 * to issue codes only; input values are never echoed back or logged.
 */
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { z } from 'zod';
import { ApiError } from './errors';

/** Largest accepted JSON body (resume 12k + job 8k chars, with generous headroom). */
const MAX_BODY_BYTES = 128 * 1024;

export function parseBody<S extends z.ZodType>(
  event: APIGatewayProxyEventV2,
  schema: S,
): z.infer<S> {
  const raw = event.body
    ? event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body
    : '';
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    throw new ApiError('VALIDATION', undefined, { body: 'too_big' });
  }
  let json: unknown;
  try {
    json = raw === '' ? undefined : JSON.parse(raw);
  } catch {
    throw new ApiError('VALIDATION', undefined, { body: 'invalid_json' });
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'body';
      fields[path] ??= issue.code;
    }
    throw new ApiError('VALIDATION', undefined, fields);
  }
  return result.data;
}
