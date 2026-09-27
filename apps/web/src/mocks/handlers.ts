import { delay, http, HttpResponse, type HttpHandler, type JsonBodyType } from 'msw';
import type { z } from 'zod';
import {
  API_BASE_PATH,
  ERROR_STATUS,
  routes,
  type ErrorCode,
  type ErrorResponse,
  type RouteContract,
  type RouteName,
} from '@proof-and-poise/shared';
import type { RouteResponse } from '../lib/api/client';
import { faultFor } from './controls';
import { MOCK_UPLOAD_URL, MockApiError, type MockDb, type MockSession } from './db';

type Routes = typeof routes;

interface ResolverContext<N extends RouteName> {
  /** Authorized session; only set for `auth: true` routes. */
  session: MockSession | null;
  params: Record<string, string>;
  body: Routes[N]['request'] extends z.ZodType ? z.output<Routes[N]['request']> : undefined;
}

type Resolver<N extends RouteName> = (ctx: ResolverContext<N>) => RouteResponse<N>;

const need = (s: MockSession | null): MockSession => {
  if (!s) throw new MockApiError('UNAUTHORIZED', 'Missing or invalid session token.');
  return s;
};
const param = (p: Record<string, string>, name: string): string => p[name] ?? '';

/** One resolver per contract route; the mapped type makes a missing route a type error. */
function createResolvers(db: MockDb): { [N in RouteName]: Resolver<N> } {
  return {
    health: () => ({ status: 'ok' }),
    createSession: ({ body }) => db.createSession(body.mode),
    getSession: ({ session }) => db.summary(need(session)),
    deleteSession: ({ session }) => {
      db.deleteSession(need(session));
      return null;
    },
    presignResume: ({ session }) => db.presignResume(need(session)),
    startAnalysis: ({ session, body }) => db.startAnalysis(need(session), body),
    getAnalysis: ({ session }) => db.analysisStatus(need(session)),
    decideRecommendation: ({ session, params, body }) =>
      db.decide(need(session), param(params, 'recId'), body),
    createConfirmation: ({ session, body }) => db.confirm(need(session), body),
    startInterview: ({ session }) => db.startInterview(need(session)),
    getInterview: ({ session }) => {
      const s = need(session);
      if (!s.interview) throw new MockApiError('NOT_FOUND', 'The interview has not started.');
      return s.interview;
    },
    presignAudio: ({ session, params }) => db.presignAudio(need(session), param(params, 'turnId')),
    startTranscription: ({ session, params }) =>
      db.startTranscription(need(session), param(params, 'turnId')),
    getTranscription: ({ session, params }) =>
      db.getTranscription(need(session), param(params, 'turnId')),
    submitAnswer: ({ session, params, body }) =>
      db.submitAnswer(need(session), param(params, 'turnId'), body),
    createReport: ({ session }) => db.createReport(need(session)),
    getReport: ({ session }) => db.getReport(need(session)),
    startPractice: ({ session, body }) => db.startPractice(need(session), body.turnId),
  };
}

export function errorResponse(code: ErrorCode, message: string, fields?: Record<string, string>) {
  const body: ErrorResponse = { error: { code, message, ...(fields ? { fields } : {}) } };
  return HttpResponse.json(body, { status: ERROR_STATUS[code] });
}

/** `/sessions/{sessionId}` → `*\/v1/sessions/:sessionId` (any origin, so any base URL works). */
export const mswPath = (template: string) =>
  `*${API_BASE_PATH}${template.replace(/\{([A-Za-z]+)\}/g, ':$1')}`;

const bearer = (request: Request): string | null => {
  const m = /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '');
  return m?.[1] ?? null;
};

function issueFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) fields[issue.path.map(String).join('.') || '_'] ??= issue.code;
  return fields;
}

/**
 * MSW handlers for every route in the shared contract (design §10), plus the mock upload
 * target. Each handler enforces bearer auth and request validation, applies any simulated
 * fault, and validates its own response against the contract before sending it.
 */
export function createHandlers(db: MockDb): HttpHandler[] {
  const resolvers = createResolvers(db);

  const contractHandlers = (Object.keys(routes) as RouteName[]).map((name) => {
    const contract: RouteContract = routes[name];
    const method =
      contract.method === 'GET' ? http.get : contract.method === 'POST' ? http.post : http.delete;
    const resolve = resolvers[name] as (ctx: ResolverContext<RouteName>) => unknown;

    return method(mswPath(contract.path), async ({ request, params: rawParams }) => {
      // Realistic latency in the browser; instant under Node (tests).
      await delay();

      const fault = faultFor(name);
      if (fault === 'network') return HttpResponse.error();
      if (fault === 'invalid_response') {
        return HttpResponse.json({ unexpected: true }, { status: 200 });
      }
      if (fault) return errorResponse(fault, 'Simulated error (mock API).');

      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawParams)) if (typeof v === 'string') params[k] = v;

      let session: MockSession | null = null;
      if (contract.auth) {
        session = db.authorize(params.sessionId, bearer(request));
        if (!session) return errorResponse('UNAUTHORIZED', 'Missing or invalid session token.');
      }

      let body: unknown;
      if (contract.request) {
        const raw: unknown = await request.json().catch(() => undefined);
        const parsed = contract.request.safeParse(raw);
        if (!parsed.success) {
          return errorResponse(
            'VALIDATION',
            'Request body failed validation.',
            issueFields(parsed.error),
          );
        }
        body = parsed.data;
      }

      let result: unknown;
      try {
        result = resolve({ session, params, body } as ResolverContext<RouteName>);
      } catch (e) {
        if (e instanceof MockApiError) return errorResponse(e.code, e.message);
        return errorResponse('INTERNAL', 'Unexpected mock error.');
      }

      if (contract.response === null) return new HttpResponse(null, { status: 204 });
      const checked = contract.response.safeParse(result);
      if (!checked.success)
        return errorResponse('INTERNAL', 'The mock produced an invalid response.');
      // Contract output is plain JSON data (validated just above).
      return HttpResponse.json(checked.data as JsonBodyType, { status: contract.successStatus });
    });
  });

  // Presigned POST target (S3 stand-in): accept the multipart upload.
  const upload = http.post(MOCK_UPLOAD_URL, () => new HttpResponse(null, { status: 204 }));

  return [...contractHandlers, upload];
}
