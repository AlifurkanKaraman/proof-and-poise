import { PracticeRequestSchema, type PracticeResponse } from '@proof-and-poise/shared';
import { parseBody } from '../lib/request';
import { sessionOf, type RouteHandler } from '../lib/router';
import type { InterviewService } from '../services/interviewService';
import type { ReportService } from '../services/reportService';

/** POST /sessions/{sessionId}/report: build the report, idempotent (Req 12.1, 12.5). */
export const createReport =
  (reports: ReportService): RouteHandler =>
  async (ctx) => ({ body: await reports.create(sessionOf(ctx)) });

/** GET /sessions/{sessionId}/report: the stored report, 404 until created or after practice. */
export const getReport =
  (reports: ReportService): RouteHandler =>
  async (ctx) => ({ body: await reports.get(sessionOf(ctx)) });

/** POST /sessions/{sessionId}/practice: a practice turn for a low-scoring question (Req 12.3). */
export const startPractice =
  (interview: InterviewService): RouteHandler =>
  async (ctx) => {
    const { turnId } = parseBody(ctx.event, PracticeRequestSchema);
    const body: PracticeResponse = { turn: await interview.startPractice(sessionOf(ctx), turnId) };
    return { body };
  };
