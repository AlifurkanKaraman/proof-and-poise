import { z } from 'zod';
import { LIMITS } from '../limits';
import {
  InterviewTypeSchema,
  SessionModeSchema,
  ShortIdSchema,
  CompetencyIdSchema,
} from './common';

/** Trim, then enforce bounds. Used for all free-text user input. */
const boundedText = (min: number, max: number) => z.string().trim().min(min).max(max);

// --- Setup (Req 3.4) --------------------------------------------------------

export const ResumeTextInputSchema = z.object({
  kind: z.literal('text'),
  text: boundedText(LIMITS.resumeText.min, LIMITS.resumeText.max),
});

/** Server-issued S3 key from the presigned upload. Session ownership is checked server-side. */
export const ResumeUploadInputSchema = z.object({
  kind: z.literal('upload'),
  key: z
    .string()
    .min(1)
    .max(256)
    .regex(/^resumes\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/),
});

export const ResumeInputSchema = z.discriminatedUnion('kind', [
  ResumeTextInputSchema,
  ResumeUploadInputSchema,
]);
export type ResumeInput = z.infer<typeof ResumeInputSchema>;

export const JobInputSchema = z.object({
  description: boundedText(LIMITS.jobText.min, LIMITS.jobText.max),
  company: z.string().trim().max(LIMITS.company.max).optional(),
  role: boundedText(LIMITS.role.min, LIMITS.role.max),
  interviewType: InterviewTypeSchema.default('behavioral_mixed'),
});
export type JobInput = z.infer<typeof JobInputSchema>;

export const AnalysisRequestSchema = z.object({
  resume: ResumeInputSchema,
  job: JobInputSchema,
});
export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;

// --- Sessions ----------------------------------------------------------------

export const CreateSessionRequestSchema = z.object({ mode: SessionModeSchema });
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

// --- Uploads (Req 4.1, 10.4) -----------------------------------------------

export const ResumeUploadRequestSchema = z.object({
  contentType: z.literal(LIMITS.resumeUpload.contentType),
  size: z.number().int().min(LIMITS.resumeUpload.minBytes).max(LIMITS.resumeUpload.maxBytes),
});
export type ResumeUploadRequest = z.infer<typeof ResumeUploadRequestSchema>;

export const AudioUploadRequestSchema = z.object({
  contentType: z.enum(LIMITS.audioUpload.contentTypes),
  size: z.number().int().min(LIMITS.audioUpload.minBytes).max(LIMITS.audioUpload.maxBytes),
});
export type AudioUploadRequest = z.infer<typeof AudioUploadRequestSchema>;

// --- Recommendations and confirmations (Req 7.5, 8.1) ----------------------

export const DecisionRequestSchema = z.object({
  decision: z.enum(['accept', 'reject', 'reset']),
});
export type DecisionRequest = z.infer<typeof DecisionRequestSchema>;

export const ConfirmationRequestSchema = z.object({
  competencyId: CompetencyIdSchema,
  statement: boundedText(LIMITS.confirmation.min, LIMITS.confirmation.max),
  attested: z.literal(true),
});
export type ConfirmationRequest = z.infer<typeof ConfirmationRequestSchema>;

// --- Interview (Req 10.3–10.5) ---------------------------------------------

export const AnswerSourceSchema = z.enum(['typed', 'transcribed']);
export type AnswerSource = z.infer<typeof AnswerSourceSchema>;

export const AnswerRequestSchema = z.object({
  text: boundedText(LIMITS.answer.min, LIMITS.answer.max),
  source: AnswerSourceSchema,
  edited: z.boolean(),
});
export type AnswerRequest = z.infer<typeof AnswerRequestSchema>;

export const TranscriptionStartRequestSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(256)
    .regex(/^audio\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/),
  durationSec: z.number().positive().max(LIMITS.recording.maxSeconds),
});
export type TranscriptionStartRequest = z.infer<typeof TranscriptionStartRequestSchema>;

export const PracticeRequestSchema = z.object({ turnId: ShortIdSchema });
export type PracticeRequest = z.infer<typeof PracticeRequestSchema>;
