/**
 * contracts/index.ts
 * API contract definitions: routes with method, path, request/response schemas.
 * Consumed by both frontend (typed client) and backend (route validation).
 */

import { z } from 'zod';
import {
  CreateSessionInputSchema,
  JobSetupInputSchema,
  ConfirmationInputSchema,
  RecommendationDecisionInputSchema,
  AnswerSubmissionInputSchema,
  PracticeRequestInputSchema,
  UploadPresignInputSchema,
  TranscriptionStartInputSchema,
} from '../schemas/inputs.js';
import {
  EvidenceMapSchema,
  ReportSchema,
  CompetencySchema,
  RecommendationSchema,
  TurnSchema,
  ScoreSetSchema,
  ScoreEventSchema,
  SessionStageSchema,
  AnalysisStatusSchema,
  SessionModeSchema,
} from '../schemas/index.js';

// =============================================================================
// Response schemas
// =============================================================================

export const SessionResponseSchema = z.object({
  sessionId: z.string(),
  sessionToken: z.string(),
  expiresAt: z.string().datetime(),
});

export const SessionSummarySchema = z.object({
  sessionId: z.string(),
  mode: SessionModeSchema,
  stage: SessionStageSchema,
  createdAt: z.string().datetime(),
  company: z.string().optional(),
  role: z.string().optional(),
});

export const AnalysisResponseSchema = z.object({
  status: AnalysisStatusSchema,
  errorCode: z.string().optional(),
  evidenceMap: EvidenceMapSchema.optional(),
});

export const DecisionResponseSchema = z.object({
  recommendation: RecommendationSchema,
  scores: ScoreSetSchema,
  scoreEvent: ScoreEventSchema.optional(),
});

export const ConfirmationResponseSchema = z.object({
  competency: CompetencySchema,
  recommendation: RecommendationSchema.optional(),
  scores: ScoreSetSchema,
  scoreEvent: ScoreEventSchema,
});

export const InterviewPlanResponseSchema = z.object({
  turns: z.array(TurnSchema),
  total: z.literal(5),
});

export const InterviewStateResponseSchema = z.object({
  turns: z.array(TurnSchema),
  followUpsUsed: z.number().int().min(0).max(2),
  completedPrimary: z.number().int().min(0).max(5),
});

export const UploadPresignResponseSchema = z.object({
  url: z.string().url(),
  fields: z.record(z.string()),
  key: z.string(),
  expiresIn: z.number().int(),
});

export const TranscriptionStatusResponseSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  text: z.string().optional(),
  errorMessage: z.string().optional(),
});

export const EvaluationResponseSchema = z.object({
  evaluation: z.object({
    dimensions: z.record(z.string(), z.object({ score: z.number(), rationale: z.string() }).nullable()),
    strength: z.string(),
    improvement: z.string(),
    strongerOutline: z.array(z.string()),
    weightedScore: z.number(),
  }),
  next: TurnSchema.nullable(),
});

export const PracticeResponseSchema = z.object({
  practiceTurn: TurnSchema,
});

// =============================================================================
// Error response schema
// =============================================================================

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.enum([
      'VALIDATION',
      'UNAUTHORIZED',
      'NOT_FOUND',
      'QUOTA_EXCEEDED',
      'CAPACITY_REACHED',
      'MODEL_OUTPUT_INVALID',
      'UPSTREAM_UNAVAILABLE',
      'EXTRACTION_FAILED',
      'CONFLICT',
      'INTERNAL',
    ]),
    message: z.string(),
    fields: z.record(z.string()).optional(),
  }),
});

// =============================================================================
// Contract definitions
// =============================================================================

export interface Contract<TRequest = void, TResponse = void> {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  requiresAuth: boolean;
  request?: z.ZodType<TRequest>;
  response: z.ZodType<TResponse>;
  description: string;
}

// Health check
export const healthContract: Contract<void, { status: string }> = {
  method: 'GET',
  path: '/health',
  requiresAuth: false,
  response: z.object({ status: z.literal('ok') }),
  description: 'Liveness check',
};

// Session routes
export const createSessionContract: Contract<
  z.infer<typeof CreateSessionInputSchema>,
  z.infer<typeof SessionResponseSchema>
> = {
  method: 'POST',
  path: '/sessions',
  requiresAuth: false,
  request: CreateSessionInputSchema,
  response: SessionResponseSchema,
  description: 'Create a new session (demo or standard)',
};

export const getSessionContract: Contract<void, z.infer<typeof SessionSummarySchema>> = {
  method: 'GET',
  path: '/sessions/:id',
  requiresAuth: true,
  response: SessionSummarySchema,
  description: 'Get session summary for resuming',
};

export const deleteSessionContract: Contract<void, void> = {
  method: 'DELETE',
  path: '/sessions/:id',
  requiresAuth: true,
  response: z.void(),
  description: 'Delete all session data',
};

// Upload routes
export const createResumeUploadContract: Contract<
  z.infer<typeof UploadPresignInputSchema>,
  z.infer<typeof UploadPresignResponseSchema>
> = {
  method: 'POST',
  path: '/sessions/:id/uploads/resume',
  requiresAuth: true,
  request: UploadPresignInputSchema,
  response: UploadPresignResponseSchema,
  description: 'Get presigned POST for resume upload',
};

// Analysis routes
export const startAnalysisContract: Contract<
  z.infer<typeof JobSetupInputSchema>,
  { status: 'queued' }
> = {
  method: 'POST',
  path: '/sessions/:id/analysis',
  requiresAuth: true,
  request: JobSetupInputSchema,
  response: z.object({ status: z.literal('queued') }),
  description: 'Start analysis (async)',
};

export const getAnalysisContract: Contract<void, z.infer<typeof AnalysisResponseSchema>> = {
  method: 'GET',
  path: '/sessions/:id/analysis',
  requiresAuth: true,
  response: AnalysisResponseSchema,
  description: 'Poll analysis status or get evidence map',
};

// Recommendation routes
export const decideRecommendationContract: Contract<
  z.infer<typeof RecommendationDecisionInputSchema>,
  z.infer<typeof DecisionResponseSchema>
> = {
  method: 'POST',
  path: '/sessions/:id/recommendations/:recId/decision',
  requiresAuth: true,
  request: RecommendationDecisionInputSchema,
  response: DecisionResponseSchema,
  description: 'Accept, reject, or reset a recommendation',
};

// Confirmation routes
export const createConfirmationContract: Contract<
  z.infer<typeof ConfirmationInputSchema>,
  z.infer<typeof ConfirmationResponseSchema>
> = {
  method: 'POST',
  path: '/sessions/:id/confirmations',
  requiresAuth: true,
  request: ConfirmationInputSchema,
  response: ConfirmationResponseSchema,
  description: 'Confirm missing evidence',
};

// Interview routes
export const createInterviewContract: Contract<void, z.infer<typeof InterviewPlanResponseSchema>> = {
  method: 'POST',
  path: '/sessions/:id/interview',
  requiresAuth: true,
  response: InterviewPlanResponseSchema,
  description: 'Generate interview plan (idempotent)',
};

export const getInterviewContract: Contract<void, z.infer<typeof InterviewStateResponseSchema>> = {
  method: 'GET',
  path: '/sessions/:id/interview',
  requiresAuth: true,
  response: InterviewStateResponseSchema,
  description: 'Get current interview state',
};

// Audio upload and transcription
export const createAudioUploadContract: Contract<
  z.infer<typeof UploadPresignInputSchema>,
  z.infer<typeof UploadPresignResponseSchema>
> = {
  method: 'POST',
  path: '/sessions/:id/interview/turns/:turnId/uploads/audio',
  requiresAuth: true,
  request: UploadPresignInputSchema,
  response: UploadPresignResponseSchema,
  description: 'Get presigned POST for audio upload',
};

export const startTranscriptionContract: Contract<
  z.infer<typeof TranscriptionStartInputSchema>,
  { status: 'started' }
> = {
  method: 'POST',
  path: '/sessions/:id/interview/turns/:turnId/transcription',
  requiresAuth: true,
  request: TranscriptionStartInputSchema,
  response: z.object({ status: z.literal('started') }),
  description: 'Start transcription job',
};

export const getTranscriptionContract: Contract<
  void,
  z.infer<typeof TranscriptionStatusResponseSchema>
> = {
  method: 'GET',
  path: '/sessions/:id/interview/turns/:turnId/transcription',
  requiresAuth: true,
  response: TranscriptionStatusResponseSchema,
  description: 'Poll transcription status, cleanup when done',
};

// Answer submission
export const submitAnswerContract: Contract<
  z.infer<typeof AnswerSubmissionInputSchema>,
  z.infer<typeof EvaluationResponseSchema>
> = {
  method: 'POST',
  path: '/sessions/:id/interview/turns/:turnId/answer',
  requiresAuth: true,
  request: AnswerSubmissionInputSchema,
  response: EvaluationResponseSchema,
  description: 'Submit answer, get evaluation and next turn',
};

// Practice
export const createPracticeContract: Contract<
  z.infer<typeof PracticeRequestInputSchema>,
  z.infer<typeof PracticeResponseSchema>
> = {
  method: 'POST',
  path: '/sessions/:id/practice',
  requiresAuth: true,
  request: PracticeRequestInputSchema,
  response: PracticeResponseSchema,
  description: 'Create practice turn for a question',
};

// Report routes
export const createReportContract: Contract<void, z.infer<typeof ReportSchema>> = {
  method: 'POST',
  path: '/sessions/:id/report',
  requiresAuth: true,
  response: ReportSchema,
  description: 'Generate report (idempotent)',
};

export const getReportContract: Contract<void, z.infer<typeof ReportSchema>> = {
  method: 'GET',
  path: '/sessions/:id/report',
  requiresAuth: true,
  response: ReportSchema,
  description: 'Fetch existing report',
};

// =============================================================================
// Contract registry (for typed client generation)
// =============================================================================

export const contracts = {
  health: healthContract,
  createSession: createSessionContract,
  getSession: getSessionContract,
  deleteSession: deleteSessionContract,
  createResumeUpload: createResumeUploadContract,
  startAnalysis: startAnalysisContract,
  getAnalysis: getAnalysisContract,
  decideRecommendation: decideRecommendationContract,
  createConfirmation: createConfirmationContract,
  createInterview: createInterviewContract,
  getInterview: getInterviewContract,
  createAudioUpload: createAudioUploadContract,
  startTranscription: startTranscriptionContract,
  getTranscription: getTranscriptionContract,
  submitAnswer: submitAnswerContract,
  createPractice: createPracticeContract,
  createReport: createReportContract,
  getReport: getReportContract,
} as const;

export type ContractName = keyof typeof contracts;
