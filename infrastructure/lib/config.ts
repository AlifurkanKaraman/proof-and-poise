/** Stage configuration resolved from CDK context (`--context stage=dev|prod`). */
import type { App } from 'aws-cdk-lib';

export const STAGES = ['dev', 'prod'] as const;
export type Stage = (typeof STAGES)[number];

export const REGION = 'us-east-1';
export const DEFAULT_MODEL_ID = 'us.amazon.nova-lite-v1:0';
export const LOCAL_ORIGIN = 'http://localhost:5173';

export interface StageConfig {
  stage: Stage;
  /** CORS allowlist for the HTTP API and the upload bucket (Req 15.6). */
  allowedOrigins: string[];
  modelId: string;
  /**
   * Alarm notification address (task 23). Only from `--context alarmEmail=...`, never
   * committed (personal data). Without it the topic exists but has no subscription.
   */
  alarmEmail?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isStage(v: unknown): v is Stage {
  return typeof v === 'string' && (STAGES as readonly string[]).includes(v);
}

/** `http://localhost:5173`, or an exact `https://host[:port]` origin (no path, no wildcard). */
const ORIGIN_RE = /^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/;

/**
 * Origins come from `proof-and-poise:allowedOrigins` in cdk.json (per stage), and can be
 * overridden with `--context allowedOrigins=https://a,https://b` (e.g. the Amplify branch
 * domains, task 10 / docs/amplify-hosting.md). The local dev origin is always kept.
 * `*`, paths, and non-https remote origins are rejected (Req 15.6).
 */
export function resolveConfig(app: App): StageConfig {
  const stage: unknown = app.node.tryGetContext('stage') ?? 'dev';
  if (!isStage(stage)) throw new Error(`Invalid stage context. Use one of: ${STAGES.join(', ')}`);

  const override: unknown = app.node.tryGetContext('allowedOrigins');
  const perStage: unknown = app.node.tryGetContext('proof-and-poise:allowedOrigins');
  let origins: string[] = [LOCAL_ORIGIN];
  if (typeof override === 'string' && override.trim()) {
    origins = override
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  } else if (perStage && typeof perStage === 'object') {
    const list = (perStage as Record<string, unknown>)[stage];
    if (Array.isArray(list)) origins = list.filter((o): o is string => typeof o === 'string');
  }
  if (!origins.includes(LOCAL_ORIGIN)) origins.push(LOCAL_ORIGIN);
  for (const o of origins) {
    if (o !== LOCAL_ORIGIN && !ORIGIN_RE.test(o)) throw new Error(`Invalid CORS origin: ${o}`);
  }

  const modelId: unknown = app.node.tryGetContext('modelId');
  const alarmEmail: unknown = app.node.tryGetContext('alarmEmail');
  const email = typeof alarmEmail === 'string' ? alarmEmail.trim() : '';
  if (email && !EMAIL_RE.test(email)) throw new Error('Invalid alarmEmail context');
  return {
    stage,
    allowedOrigins: [...new Set(origins)],
    modelId: typeof modelId === 'string' && modelId ? modelId : DEFAULT_MODEL_ID,
    ...(email ? { alarmEmail: email } : {}),
  };
}
