import { z } from 'zod';

export const ImportanceSchema = z.enum(['required', 'preferred', 'contextual']);
export type Importance = z.infer<typeof ImportanceSchema>;

export const StrengthSchema = z.enum(['strong', 'moderate', 'weak', 'none']);
export type Strength = z.infer<typeof StrengthSchema>;

export const TrustLabelSchema = z.enum([
  'verified_from_resume',
  'confirmed_by_candidate',
  'missing_evidence',
  'rewording_only',
]);
export type TrustLabel = z.infer<typeof TrustLabelSchema>;

export const CompetencyCategorySchema = z.enum(['technical', 'behavioral', 'domain']);
export type CompetencyCategory = z.infer<typeof CompetencyCategorySchema>;

export const ResumeSectionSchema = z.enum([
  'experience',
  'projects',
  'education',
  'skills',
  'other',
]);
export type ResumeSection = z.infer<typeof ResumeSectionSchema>;

export const SenioritySchema = z.enum(['intern', 'entry', 'mid', 'senior']);
export type Seniority = z.infer<typeof SenioritySchema>;

export const InterviewTypeSchema = z.enum([
  'behavioral_mixed',
  'technical_mixed',
  'behavioral_only',
]);
export type InterviewType = z.infer<typeof InterviewTypeSchema>;

export const SessionModeSchema = z.enum(['demo', 'standard']);
export type SessionMode = z.infer<typeof SessionModeSchema>;

export const SessionStageSchema = z.enum(['setup', 'analysis', 'interview', 'report']);
export type SessionStage = z.infer<typeof SessionStageSchema>;

/** Competency IDs are "c1".."c12". */
export const CompetencyIdSchema = z.string().regex(/^c(?:[1-9]|1[0-2])$/, 'Expected c1..c12');

/** Short opaque ID for evidence, recommendations, turns, and score events. */
export const ShortIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

export const IsoDateTimeSchema = z.iso.datetime();

/** Scores shown to users: integers in [0, 100] (Req 6.5). */
export const Score100Schema = z.number().int().min(0).max(100);

/** Rubric dimension score. */
export const RubricScoreSchema = z.number().int().min(1).max(4);

/** Weighted answer / question score, 1–4, may be fractional. */
export const AnswerScoreSchema = z.number().min(1).max(4);
