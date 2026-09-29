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
  /** SSM parameter name holding the IP-hash salt; the value is read at cold start (Req 16.3). */
  IP_HASH_SALT_PARAM: z.string().regex(/^\/[A-Za-z0-9_.\-/]{1,1010}$/),
  /** Analysis worker, invoked asynchronously by `POST /analysis` (design §2). */
  WORKER_FUNCTION_NAME: z.string().min(1).max(140),
});

export type Env = z.infer<typeof EnvSchema>;

/** The analysis worker only needs storage and the model (design §11). */
export const WorkerEnvSchema = EnvSchema.pick({
  APP_STAGE: true,
  TABLE_NAME: true,
  BUCKET_NAME: true,
  MODEL_ID: true,
});
export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;

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
  return parseEnv(EnvSchema, source);
}

export function loadWorkerEnv(source: Record<string, string | undefined>): WorkerEnv {
  return parseEnv(WorkerEnvSchema, source);
}

function parseEnv<S extends z.ZodType>(
  schema: S,
  source: Record<string, string | undefined>,
): z.infer<S> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((i) => String(i.path[0] ?? '?')))];
    throw new EnvError(keys);
  }
  return result.data;
}
