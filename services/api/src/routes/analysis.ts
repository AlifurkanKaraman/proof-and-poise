import { AnalysisRequestSchema, type AnalysisStatusResponse } from '@proof-and-poise/shared';
import { parseBody } from '../lib/request';
import { sessionOf, type RouteHandler } from '../lib/router';
import type { AnalysisService } from '../services/analysisService';

/** POST /sessions/{sessionId}/analysis → 202 queued (Req 5.1). Invalid input never reaches Bedrock (Req 3.6). */
export const startAnalysis =
  (analysis: AnalysisService): RouteHandler =>
  async (ctx) => {
    const session = sessionOf(ctx);
    const req = parseBody(ctx.event, AnalysisRequestSchema);
    const body: { status: 'queued' } = await analysis.start(session, req);
    return { body };
  };

/** GET /sessions/{sessionId}/analysis → status, stage, or the EvidenceMap (Req 5.1). */
export const getAnalysis =
  (analysis: AnalysisService): RouteHandler =>
  async (ctx) => {
    const body: AnalysisStatusResponse = await analysis.get(sessionOf(ctx));
    return { body };
  };
