/**
 * inputs.ts
 * Input validation schemas for API requests and user submissions.
 */

import { z } from 'zod';
import { SessionModeSchema, DecisionSchema } from './base.js';
import { LIMITS } from '../limits.js';

// Session creation
export const CreateSessionInputSchema = z.object({
  mode: SessionModeSchema,
});

export type CreateSessionInput = z.infer<typeof CreateSessionInputSchema>;

// Job setup input
export const JobSetupInputSchema = z.object({
  resume: z
    .string()
    .min(LIMITS.RESUME_TEXT_MIN_CHARS)
    .max(LIMITS.RESUME_TEXT_MAX_CHARS)
    .describe('Resume text (extracted from PDF or pasted)'),
  job: z
    .string()
    .min(LIMITS.JOB_DESCRIPTION_MIN_CHARS)
    .max(LIMITS.JOB_DESCRIPTION_MAX_CHARS)
    .describe('Job description text'),
  company: z.string().max(LIMITS.COMPANY_NAME_MAX_CHARS).optional(),
  role: z.string().max(LIMITS.ROLE_TITLE_MAX_CHARS).optional(),
  interviewType: z.enum(['technical', 'behavioral', 'mixed']).optional(),
});

export type JobSetupInput = z.infer<typeof JobSetupInputSchema>;

// Confirmation input
export const ConfirmationInputSchema = z.object({
  competencyId: z.string(),
  statement: z.string().min(LIMITS.EVIDENCE_QUOTE_MIN_CHARS).max(LIMITS.EVIDENCE_QUOTE_MAX_CHARS),
  attested: z.literal(true).describe('User must attest the statement is truthful'),
});

export type ConfirmationInput = z.infer<typeof ConfirmationInputSchema>;

// Recommendation decision
export const RecommendationDecisionInputSchema = z.object({
  decision: DecisionSchema,
});

export type RecommendationDecisionInput = z.infer<typeof RecommendationDecisionInputSchema>;

// Answer submission
export const AnswerSubmissionInputSchema = z.object({
  text: z.string().min(LIMITS.ANSWER_TEXT_MIN_CHARS).max(LIMITS.ANSWER_TEXT_MAX_CHARS),
  source: z.enum(['typed', 'transcribed']),
  edited: z.boolean(),
});

export type AnswerSubmissionInput = z.infer<typeof AnswerSubmissionInputSchema>;

// Practice request
export const PracticeRequestInputSchema = z.object({
  turnId: z.string().describe('Original turn ID to practice again'),
});

export type PracticeRequestInput = z.infer<typeof PracticeRequestInputSchema>;

// Upload presign request
export const UploadPresignInputSchema = z.object({
  contentType: z.string().describe('MIME type (e.g., application/pdf, audio/webm)'),
  size: z.number().int().min(1).describe('File size in bytes'),
});

export type UploadPresignInput = z.infer<typeof UploadPresignInputSchema>;

// Transcription start
export const TranscriptionStartInputSchema = z.object({
  key: z.string().describe('S3 key of uploaded audio'),
  durationSec: z.number().min(1).max(LIMITS.AUDIO_MAX_DURATION_SECONDS),
});

export type TranscriptionStartInput = z.infer<typeof TranscriptionStartInputSchema>;
