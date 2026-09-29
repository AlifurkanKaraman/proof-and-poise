import {
  ConfirmationRequestSchema,
  DecisionRequestSchema,
  type ConfirmationResponse,
  type DecisionResponse,
} from '@proof-and-poise/shared';
import { ApiError } from '../lib/errors';
import { parseBody } from '../lib/request';
import { sessionOf, type RouteHandler } from '../lib/router';
import type { DecisionService } from '../services/decisionService';

/** POST /sessions/{sessionId}/recommendations/{recId}/decision (Req 7.5–7.6). */
export const decideRecommendation =
  (decisions: DecisionService): RouteHandler =>
  async (ctx) => {
    const recId = ctx.params['recId'];
    if (!recId) throw new ApiError('NOT_FOUND');
    const req = parseBody(ctx.event, DecisionRequestSchema);
    const body: DecisionResponse = await decisions.decide(sessionOf(ctx), recId, req);
    return { body };
  };

/** POST /sessions/{sessionId}/confirmations (Req 8.1–8.5). */
export const createConfirmation =
  (decisions: DecisionService): RouteHandler =>
  async (ctx) => {
    const req = parseBody(ctx.event, ConfirmationRequestSchema);
    const body: ConfirmationResponse = await decisions.confirm(sessionOf(ctx), req);
    return { body };
  };
