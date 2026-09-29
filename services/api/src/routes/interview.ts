import { AnswerRequestSchema, type AnswerResponse } from '@proof-and-poise/shared';
import { ApiError } from '../lib/errors';
import { parseBody } from '../lib/request';
import { sessionOf, type RouteHandler } from '../lib/router';
import type { InterviewService } from '../services/interviewService';

/** POST /sessions/{sessionId}/interview: generate the plan, idempotent (Req 9.1). */
export const startInterview =
  (interview: InterviewService): RouteHandler =>
  async (ctx) => ({ body: await interview.start(sessionOf(ctx)) });

/** GET /sessions/{sessionId}/interview: current state, for resuming (Req 9.7). */
export const getInterview =
  (interview: InterviewService): RouteHandler =>
  async (ctx) => ({ body: await interview.get(sessionOf(ctx)) });

/** POST /sessions/{sessionId}/turns/{turnId}/answer (Req 9.3–9.4, 11.1–11.5). */
export const submitAnswer =
  (interview: InterviewService): RouteHandler =>
  async (ctx) => {
    const turnId = ctx.params['turnId'];
    if (!turnId) throw new ApiError('NOT_FOUND');
    const req = parseBody(ctx.event, AnswerRequestSchema);
    const body: AnswerResponse = await interview.answer(sessionOf(ctx), turnId, req);
    return { body };
  };
