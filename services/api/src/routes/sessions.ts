import {
  CreateSessionRequestSchema,
  type CreateSessionResponse,
  type SessionSummary,
} from '@proof-and-poise/shared';
import { parseBody } from '../lib/request';
import { sessionOf, type RouteHandler } from '../lib/router';
import type { SessionService } from '../services/sessionService';

/** POST /sessions (Req 2.1, 16.3). */
export const createSession =
  (sessions: SessionService): RouteHandler =>
  async ({ event }) => {
    const { mode } = parseBody(event, CreateSessionRequestSchema);
    const body: CreateSessionResponse = await sessions.create(
      mode,
      event.requestContext?.http?.sourceIp,
    );
    return { body };
  };

/** GET /sessions/{sessionId} (Req 2.6). */
export const getSession =
  (sessions: SessionService): RouteHandler =>
  (ctx) => {
    const body: SessionSummary = sessions.summary(sessionOf(ctx));
    return { body };
  };

/** DELETE /sessions/{sessionId} (Req 2.5). */
export const deleteSession =
  (sessions: SessionService): RouteHandler =>
  async (ctx) => {
    await sessions.delete(sessionOf(ctx));
    return {};
  };
