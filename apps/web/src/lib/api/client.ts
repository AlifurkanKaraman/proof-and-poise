import type { z } from 'zod';
import {
  buildPath,
  ERROR_STATUS,
  ErrorResponseSchema,
  routes,
  type ErrorCode,
  type RouteContract,
  type RouteName,
} from '@proof-and-poise/shared';
import { ApiError } from './errors';

type Routes = typeof routes;

/** Request body type (schema input) for a route, or `undefined` for bodiless routes. */
export type RouteBody<N extends RouteName> = Routes[N]['request'] extends z.ZodType
  ? z.input<Routes[N]['request']>
  : undefined;

/** Parsed response type for a route, or `null` for 204 routes. */
export type RouteResponse<N extends RouteName> = Routes[N]['response'] extends z.ZodType
  ? z.output<Routes[N]['response']>
  : null;

export interface RequestOptions<N extends RouteName> {
  /** Path params, e.g. `{ sessionId, turnId }`. */
  params?: Record<string, string>;
  body?: RouteBody<N>;
  signal?: AbortSignal;
}

export interface ApiClientConfig {
  /** Origin (plus optional prefix) without `/v1`. */
  baseUrl: string;
  /** Token for a session ID; null when there is none (see `lib/session.ts`). */
  getToken: (sessionId: string | undefined) => string | null;
  fetch?: typeof fetch;
}

export interface ApiClient {
  request<N extends RouteName>(name: N, options?: RequestOptions<N>): Promise<RouteResponse<N>>;
}

/** Field path → issue code, never the input value (matches the server's `fields`). */
function issueFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_';
    fields[key] ??= issue.code;
  }
  return fields;
}

const CODE_BY_STATUS = new Map<number, ErrorCode>(
  (Object.entries(ERROR_STATUS) as [ErrorCode, number][])
    // CAPACITY_REACHED and UPSTREAM_UNAVAILABLE share 503; prefer the generic one.
    .filter(([code]) => code !== 'CAPACITY_REACHED')
    .map(([code, status]) => [status, code]),
);

async function readJson(res: Response): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    const text = await res.text();
    return { ok: true, value: text === '' ? undefined : JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/**
 * Typed fetch client built from the shared route contracts (design §8). Every request body
 * is validated before sending and every response is validated before it's returned.
 * Failures always reject with `ApiError`; a contract mismatch never crashes the caller.
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  const doFetch = config.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const baseUrl = config.baseUrl.replace(/\/+$/, '');

  async function request<N extends RouteName>(
    name: N,
    options: RequestOptions<N> = {},
  ): Promise<RouteResponse<N>> {
    // Widened to the base contract; the typed signature above carries the specifics.
    const contract: RouteContract = routes[name];
    const fail = (init: Omit<ConstructorParameters<typeof ApiError>[0], 'route'>) =>
      new ApiError({ ...init, route: name });

    let path: string;
    try {
      path = buildPath(contract.path, options.params);
    } catch {
      throw fail({
        kind: 'invalid_request',
        code: 'VALIDATION',
        message: 'Missing path parameter.',
      });
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (contract.auth) {
      const token = config.getToken(options.params?.sessionId);
      if (!token) {
        throw fail({ kind: 'no_session', code: 'UNAUTHORIZED', message: 'No session token.' });
      }
      headers.Authorization = `Bearer ${token}`;
    }

    let body: string | undefined;
    if (contract.request) {
      const parsed = contract.request.safeParse(options.body);
      if (!parsed.success) {
        throw fail({
          kind: 'invalid_request',
          code: 'VALIDATION',
          message: 'Request body failed validation.',
          fields: issueFields(parsed.error),
        });
      }
      body = JSON.stringify(parsed.data);
      headers['Content-Type'] = 'application/json';
    }

    let res: Response;
    try {
      res = await doFetch(`${baseUrl}${path}`, {
        method: contract.method,
        headers,
        ...(body === undefined ? {} : { body }),
        ...(options.signal ? { signal: options.signal } : {}),
      });
    } catch {
      throw fail({
        kind: 'network',
        code: 'UPSTREAM_UNAVAILABLE',
        message: 'Network request failed.',
      });
    }

    const json = await readJson(res);

    if (!res.ok) {
      const parsed = json.ok ? ErrorResponseSchema.safeParse(json.value) : null;
      if (parsed?.success) {
        const { code, message, fields } = parsed.data.error;
        throw fail({
          kind: 'http',
          code,
          message,
          status: res.status,
          ...(fields ? { fields } : {}),
        });
      }
      throw fail({
        kind: 'http',
        code: CODE_BY_STATUS.get(res.status) ?? 'INTERNAL',
        message: `Request failed with status ${res.status}.`,
        status: res.status,
      });
    }

    if (contract.response === null) return null as RouteResponse<N>;

    const parsed = json.ok ? contract.response.safeParse(json.value) : null;
    if (!parsed?.success) {
      throw fail({
        kind: 'invalid_response',
        code: 'INTERNAL',
        message: 'The server response did not match the expected format.',
        status: res.status,
        ...(parsed ? { fields: issueFields(parsed.error) } : {}),
      });
    }
    return parsed.data as RouteResponse<N>;
  }

  return { request };
}
