/**
 * Lambda environment validation (Req 15.4). Parsed once at cold start; an invalid
 * configuration throws immediately so the function fails fast instead of misbehaving.
 */
import { z } from 'zod';

const csv = z
  .string()
  .min(1)
  .transform((s) =>
    s
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0),
  )
  .pipe(z.array(z.url()).min(1));

export const EnvSchema = z.object({
  APP_STAGE: z.enum(['dev', 'prod']),
  TABLE_NAME: z.string().min(3).max(255),
  BUCKET_NAME: z.string().min(3).max(63),
  MODEL_ID: z.string().min(1).default('us.amazon.nova-lite-v1:0'),
  ALLOWED_ORIGINS: csv,
  // Added by later tasks (analysis worker, IP-hash salt). Optional until then.
  WORKER_FUNCTION_NAME: z.string().min(1).optional(),
  IP_HASH_SALT_PARAM: z.string().min(1).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export class EnvError extends Error {
  override readonly name = 'EnvError';
  /** Names of invalid variables only; values are never included. */
  readonly invalidKeys: string[];
  constructor(invalidKeys: string[]) {
    super(`Invalid environment: ${invalidKeys.join(', ')}`);
    this.invalidKeys = invalidKeys;
  }
}

export function loadEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((i) => String(i.path[0] ?? '?')))];
    throw new EnvError(keys);
  }
  return result.data;
}
