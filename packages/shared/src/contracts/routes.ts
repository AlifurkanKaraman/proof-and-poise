/**
 * Route contracts (design §8). Base path `/v1`.
 * The API router, the web client, and the MSW mocks are all built from these.
 */
import { z } from 'zod';
import {
  AnalysisRequestSchema,
  AudioUploadRequestSchema,
  ConfirmationRequestSchema,
  CreateSessionRequestSchema,
  DecisionRequestSchema,
  PracticeRequestSchema,
  AnswerRequestSchema,
  ResumeUploadRequestSchema,
  TranscriptionStartRequestSchema,
} from '../schemas/inputs';
import {
  CompetencySchema,
  EvidenceMapSchema,
  RecommendationSchema,
  ScoreEventSchema,
  ScoreSetSchema,
} from '../schemas/evidenceMap';
import { EvaluationSchema, InterviewStateSchema, TurnSchema } from '../schemas/interview';
import { ReportSchema } from '../schemas/report';
import { IsoDateTimeSchema, SessionModeSchema, SessionStageSchema } from '../schemas/common';
import { ErrorCodeSchema } from './errors';

export const API_BASE_PATH = '/v1';

export type HttpMethod = 'GET' | 'POST' | 'DELETE';

export interface RouteContract<
  Req extends z.ZodType | null = z.ZodType | null,
  Res extends z.ZodType | null = z.ZodType | null,
> {
  method: HttpMethod;
  /** Path template relative to `/v1`, e.g. `/sessions/{sessionId}/analysis`. */
  path: string;
  /** Whether `Authorization: Bearer <sessionToken>` is required. */
  auth: boolean;
  request: Req;
  /** Null for bodiless responses (204). */
  response: Res;
  successStatus: 200 | 201 | 202 | 204;
}

const route = <Req extends z.ZodType | null, Res extends z.ZodType | null>(
  c: RouteContract<Req, Res>,
): RouteContract<Req, Res> => c;

// --- Response schemas ---------------------------------------------------------

export const HealthResponseSchema = z.object({ status: z.literal('ok') });

export const CreateSessionResponseSchema = z.object({
  sessionId: z.uuid({ version: 'v4' }),
  sessionToken: z.string().min(43).max(128),
  expiresAt: IsoDateTimeSchema,
});
export type CreateSessionResponse = z.infer<typeof CreateSessionResponseSchema>;

export const SessionSummarySchema = z.object({
  sessionId: z.uuid({ version: 'v4' }),
  mode: SessionModeSchema,
  stage: SessionStageSchema,
  expiresAt: IsoDateTimeSchema,
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const PresignedPostResponseSchema = z.object({
  url: z.url(),
  fields: z.record(z.string(), z.string()),
  key: z.string().min(1).max(256),
  expiresIn: z.number().int().positive().max(300),
});
export type PresignedPostResponse = z.infer<typeof PresignedPostResponseSchema>;

export const AnalysisStageSchema = z.enum([
  'reading_resume',
  'mapping_competencies',
  'checking_evidence',
  'drafting_recommendations',
]);
export type AnalysisStage = z.infer<typeof AnalysisStageSchema>;

export const AnalysisStatusResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('queued') }),
  z.object({ status: z.literal('running'), stage: AnalysisStageSchema }),
  z.object({
    status: z.literal('ready'),
    evidenceMap: EvidenceMapSchema,
    /** Original (possibly truncated) resume text, for the working-resume view. */
    resumeText: z.string().min(1),
    /** Resume text was truncated to the limit before analysis (Req 4.5). */
    truncated: z.boolean(),
    /** Demo sessions load a precomputed fixture (Req 13.2). */
    precomputed: z.boolean(),
  }),
  z.object({ status: z.literal('failed'), errorCode: ErrorCodeSchema }),
]);
export type AnalysisStatusResponse = z.infer<typeof AnalysisStatusResponseSchema>;

export const DecisionResponseSchema = z.object({
  recommendation: RecommendationSchema,
  scores: ScoreSetSchema,
  scoreEvent: ScoreEventSchema.nullable(),
});
export type DecisionResponse = z.infer<typeof DecisionResponseSchema>;

export const ConfirmationResponseSchema = z.object({
  competency: CompetencySchema,
  recommendation: RecommendationSchema.optional(),
  scores: ScoreSetSchema,
  scoreEvent: ScoreEventSchema.nullable(),
});
export type ConfirmationResponse = z.infer<typeof ConfirmationResponseSchema>;

export const TranscriptionStartResponseSchema = z.object({ status: z.literal('transcribing') });

export const TranscriptionStatusResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('transcribing') }),
  z.object({ status: z.literal('ready'), text: z.string() }),
  z.object({ status: z.literal('failed'), errorCode: ErrorCodeSchema }),
]);
export type TranscriptionStatusResponse = z.infer<typeof TranscriptionStatusResponseSchema>;

export const AnswerResponseSchema = z.object({
  evaluation: EvaluationSchema,
  next: TurnSchema.nullable(),
});
export type AnswerResponse = z.infer<typeof AnswerResponseSchema>;

export const PracticeResponseSchema = z.object({ turn: TurnSchema });
export type PracticeResponse = z.infer<typeof PracticeResponseSchema>;

// --- Routes -----------------------------------------------------------------

const S = '/sessions/{sessionId}';
const T = `${S}/turns/{turnId}`;

export const routes = {
  health: route({
    method: 'GET',
    path: '/health',
    auth: false,
    request: null,
    response: HealthResponseSchema,
    successStatus: 200,
  }),
  createSession: route({
    method: 'POST',
    path: '/sessions',
    auth: false,
    request: CreateSessionRequestSchema,
    response: CreateSessionResponseSchema,
    successStatus: 201,
  }),
  getSession: route({
    method: 'GET',
    path: S,
    auth: true,
    request: null,
    response: SessionSummarySchema,
    successStatus: 200,
  }),
  deleteSession: route({
    method: 'DELETE',
    path: S,
    auth: true,
    request: null,
    response: null,
    successStatus: 204,
  }),
  presignResume: route({
    method: 'POST',
    path: `${S}/uploads/resume`,
    auth: true,
    request: ResumeUploadRequestSchema,
    response: PresignedPostResponseSchema,
    successStatus: 200,
  }),
  startAnalysis: route({
    method: 'POST',
    path: `${S}/analysis`,
    auth: true,
    request: AnalysisRequestSchema,
    response: z.object({ status: z.literal('queued') }),
    successStatus: 202,
  }),
  getAnalysis: route({
    method: 'GET',
    path: `${S}/analysis`,
    auth: true,
    request: null,
    response: AnalysisStatusResponseSchema,
    successStatus: 200,
  }),
  decideRecommendation: route({
    method: 'POST',
    path: `${S}/recommendations/{recId}/decision`,
    auth: true,
    request: DecisionRequestSchema,
    response: DecisionResponseSchema,
    successStatus: 200,
  }),
  createConfirmation: route({
    method: 'POST',
    path: `${S}/confirmations`,
    auth: true,
    request: ConfirmationRequestSchema,
    response: ConfirmationResponseSchema,
    successStatus: 200,
  }),
  startInterview: route({
    method: 'POST',
    path: `${S}/interview`,
    auth: true,
    request: null,
    response: InterviewStateSchema,
    successStatus: 200,
  }),
  getInterview: route({
    method: 'GET',
    path: `${S}/interview`,
    auth: true,
    request: null,
    response: InterviewStateSchema,
    successStatus: 200,
  }),
  presignAudio: route({
    method: 'POST',
    path: `${T}/uploads/audio`,
    auth: true,
    request: AudioUploadRequestSchema,
    response: PresignedPostResponseSchema,
    successStatus: 200,
  }),
  startTranscription: route({
    method: 'POST',
    path: `${T}/transcription`,
    auth: true,
    request: TranscriptionStartRequestSchema,
    response: TranscriptionStartResponseSchema,
    successStatus: 202,
  }),
  getTranscription: route({
    method: 'GET',
    path: `${T}/transcription`,
    auth: true,
    request: null,
    response: TranscriptionStatusResponseSchema,
    successStatus: 200,
  }),
  submitAnswer: route({
    method: 'POST',
    path: `${T}/answer`,
    auth: true,
    request: AnswerRequestSchema,
    response: AnswerResponseSchema,
    successStatus: 200,
  }),
  createReport: route({
    method: 'POST',
    path: `${S}/report`,
    auth: true,
    request: null,
    response: ReportSchema,
    successStatus: 200,
  }),
  getReport: route({
    method: 'GET',
    path: `${S}/report`,
    auth: true,
    request: null,
    response: ReportSchema,
    successStatus: 200,
  }),
  startPractice: route({
    method: 'POST',
    path: `${S}/practice`,
    auth: true,
    request: PracticeRequestSchema,
    response: PracticeResponseSchema,
    successStatus: 200,
  }),
} as const;

export type RouteName = keyof typeof routes;

/** Path parameter names referenced by a template, e.g. `{sessionId}` → `sessionId`. */
export function pathParams(template: string): string[] {
  return [...template.matchAll(/\{([A-Za-z]+)\}/g)].map((m) => m[1] ?? '');
}

/**
 * Fill a path template. Values are URI-encoded; missing params throw.
 * Returns the path relative to the base URL including `/v1`.
 */
export function buildPath(template: string, params: Record<string, string> = {}): string {
  const filled = template.replace(/\{([A-Za-z]+)\}/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined || value === '') throw new Error(`Missing path param: ${name}`);
    return encodeURIComponent(value);
  });
  return `${API_BASE_PATH}${filled}`;
}

/**
 * Match a concrete path (without `/v1`) against a template.
 * Returns decoded params, or null when it doesn't match.
 */
export function matchPath(template: string, path: string): Record<string, string> | null {
  const names: string[] = [];
  const pattern = template
    .replace(/[.*+?^$()|[\]\\]/g, '\\$&')
    .replace(/\\?\{([A-Za-z]+)\\?\}/g, (_, n: string) => {
      names.push(n);
      return '([^/]+)';
    });
  const m = new RegExp(`^${pattern}$`).exec(path);
  if (!m) return null;
  const out: Record<string, string> = {};
  names.forEach((n, i) => {
    out[n] = decodeURIComponent(m[i + 1] ?? '');
  });
  return out;
}
