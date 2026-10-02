import { z } from 'zod';
import { API_BASE_PATH } from '@proof-and-poise/shared';

/**
 * The only two variables the web bundle may read (Req 15.1, design §11).
 * Empty strings count as unset, since Amplify and `.env` files often leave them blank.
 */
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

export const WebEnvSchema = z.object({
  VITE_API_BASE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  VITE_APP_ENV: z.preprocess(
    emptyToUndefined,
    z.enum(['local', 'mock', 'dev', 'prod']).default('local'),
  ),
});

export interface WebEnv {
  /** Origin (plus any path prefix) the client prepends to `/v1/...` contract paths. */
  apiBaseUrl: string;
  appEnv: z.infer<typeof WebEnvSchema>['VITE_APP_ENV'];
  /** `vite --mode mock` (`pnpm dev:mock`): requests are answered by MSW in the browser. */
  mockApi: boolean;
}

/** Strip a trailing slash and a trailing `/v1`; contract paths already include `/v1`. */
export function normalizeBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  return trimmed.endsWith(API_BASE_PATH) ? trimmed.slice(0, -API_BASE_PATH.length) : trimmed;
}

const sameOrigin = () => (typeof window === 'undefined' ? '' : window.location.origin);

/**
 * Validate the raw Vite env. Throws with the failing variable names only (never values).
 * In mock mode the API base is always the page's own origin, so a configured real API
 * is never called while MSW is active.
 */
export function parseWebEnv(raw: Record<string, unknown>, mode: string): WebEnv {
  const parsed = WebEnvSchema.safeParse({
    VITE_API_BASE_URL: raw.VITE_API_BASE_URL,
    VITE_APP_ENV: raw.VITE_APP_ENV,
  });
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))].join(', ');
    throw new Error(`Invalid web environment: ${names}`);
  }
  const mockApi = mode === 'mock';
  const configured = parsed.data.VITE_API_BASE_URL;
  return {
    apiBaseUrl: mockApi || !configured ? sameOrigin() : normalizeBaseUrl(configured),
    appEnv: mockApi ? 'mock' : parsed.data.VITE_APP_ENV,
    mockApi,
  };
}

export const env: WebEnv = parseWebEnv(import.meta.env, import.meta.env.MODE);
