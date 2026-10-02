/**
 * Minimal router over the shared route contracts. Handlers stay thin; this module owns
 * path matching, JSON serialization, error mapping, and per-request logging.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { API_BASE_PATH, matchPath, type RouteContract } from '@proof-and-poise/shared';
import type { SessionMeta } from '../data/sessionRepository';
import { ApiError, toApiError } from './errors';
import { logger as defaultLogger, type Logger } from './logger';

export interface RequestContext {
  event: APIGatewayProxyEventV2;
  params: Record<string, string>;
  requestId: string;
  /** Set for routes whose contract has `auth: true`; the router authenticates first. */
  session: SessionMeta | undefined;
}

/** Resolves the session for `{sessionId}` from the request headers, or throws 401. */
export type Authenticator = (
  sessionId: string | undefined,
  headers: APIGatewayProxyEventV2['headers'] | undefined,
) => Promise<SessionMeta>;

/** The authenticated session, for handlers of `auth: true` routes. */
export function sessionOf(ctx: RequestContext): SessionMeta {
  if (!ctx.session) throw new ApiError('UNAUTHORIZED');
  return ctx.session;
}

export interface HandlerResult {
  status?: number;
  body?: unknown;
}

export type RouteHandler = (ctx: RequestContext) => Promise<HandlerResult> | HandlerResult;

interface Registered {
  contract: RouteContract;
  handler: RouteHandler;
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

export class Router {
  private readonly entries: Registered[] = [];
  constructor(
    private readonly log: Logger = defaultLogger,
    private readonly authenticate?: Authenticator,
  ) {}

  add(contract: RouteContract, handler: RouteHandler): this {
    this.entries.push({ contract, handler });
    return this;
  }

  async handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    const started = Date.now();
    const requestId = event.requestContext?.requestId ?? 'unknown';
    const method = event.requestContext?.http?.method ?? 'GET';
    const rawPath = event.rawPath ?? '/';
    let routeLabel = 'unmatched';

    try {
      if (!rawPath.startsWith(`${API_BASE_PATH}/`)) throw new ApiError('NOT_FOUND');
      const relPath = rawPath.slice(API_BASE_PATH.length);

      for (const { contract, handler } of this.entries) {
        if (contract.method !== method) continue;
        const params = matchPath(contract.path, relPath);
        if (!params) continue;
        routeLabel = `${method} ${contract.path}`;
        // Session-scoped routes fail closed: no authenticator configured means 401 (Req 2.2).
        let session: SessionMeta | undefined;
        if (contract.auth) {
          if (!this.authenticate) throw new ApiError('UNAUTHORIZED');
          session = await this.authenticate(params['sessionId'], event.headers);
        }
        const result = await handler({ event, params, requestId, session });
        const status = result.status ?? contract.successStatus;
        this.log.info('request', {
          requestId,
          route: routeLabel,
          status,
          latencyMs: Date.now() - started,
        });
        return result.body === undefined || status === 204
          ? { statusCode: status, headers: JSON_HEADERS }
          : { statusCode: status, headers: JSON_HEADERS, body: JSON.stringify(result.body) };
      }
      throw new ApiError('NOT_FOUND');
    } catch (err) {
      const apiError = toApiError(err);
      const fields = {
        requestId,
        route: routeLabel,
        status: apiError.status,
        latencyMs: Date.now() - started,
        errorCode: apiError.code,
      };
      if (apiError.status >= 500) this.log.error('request_failed', err, fields);
      else this.log.warn('request_rejected', fields);
      return {
        statusCode: apiError.status,
        headers: JSON_HEADERS,
        body: JSON.stringify(apiError.toBody()),
      };
    }
  }
}
