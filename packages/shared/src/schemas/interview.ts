/**
 * interview.ts
 * Interview schemas - Turns, Answers, Evaluations.
 */

import { z } from 'zod';
import { TurnKindSchema, TurnStatusSchema, AnswerSourceSchema, DimensionSchema } from './base.js';
import { LIMITS } from '../limits.js';

export const AnswerSchema = z.object({
  text: z.string().min(LIMITS.ANSWER_TEXT_MIN_CHARS).max(LIMITS.ANSWER_TEXT_MAX_CHARS),
  source: AnswerSourceSchema,
  edited: z.boolean().describe('True if transcription was edited before submission'),
});

export type Answer = z.infer<typeof AnswerSchema>;

export const DimensionScoreSchema = z.object({
  score: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  rationale: z.string().max(LIMITS.MODEL_EVALUATION_RATIONALE_MAX_CHARS),
});

export type DimensionScore = z.infer<typeof DimensionScoreSchema>;

export const EvaluationSchema = z.object({
  dimensions: z.record(DimensionSchema, DimensionScoreSchema.nullable()).describe('Null for non-behavioral'),
  strength: z.string().max(LIMITS.MODEL_EVALUATION_STRENGTH_MAX_CHARS).describe('What you did well'),
  improvement: z.string().max(LIMITS.MODEL_EVALUATION_IMPROVEMENT_MAX_CHARS).describe('What to improve'),
  strongerOutline: z
    .array(z.string().max(LIMITS.MODEL_STRONGER_OUTLINE_POINT_MAX_CHARS))
    .max(LIMITS.MODEL_STRONGER_OUTLINE_POINTS)
    .describe('Bullet points for a stronger answer'),
  weightedScore: z.number().min(1).max(4).describe('Computed server-side from dimensions'),
  candidateFollowUp: z
    .string()
    .max(LIMITS.FOLLOW_UP_QUESTION_MAX_CHARS)
    .nullable()
    .describe("Model's suggested follow-up; server decides if used"),
});

export type Evaluation = z.infer<typeof EvaluationSchema>;

export const TurnSchema = z.object({
  id: z.string().describe('e.g., "1", "2", "3a" (follow-up)'),
  index: z.number().int().min(1).describe('Primary question index (1-5), follow-ups share parent index'),
  kind: TurnKindSchema,
  parentTurnId: z.string().optional().describe('Set for follow_up and practice turns'),
  competencyIds: z.array(z.string()).describe('Competencies this question targets'),
  question: z.string().max(LIMITS.MODEL_QUESTION_MAX_CHARS),
  answer: AnswerSchema.optional(),
  evaluation: EvaluationSchema.optional(),
  status: TurnStatusSchema,
});

export type Turn = z.infer<typeof TurnSchema>;

export const InterviewPlanSchema = z.object({
  turns: z.array(TurnSchema).describe('All turns (primary + follow-ups + practice)'),
  totalPrimary: z.literal(5).describe('Always 5 primary questions'),
  followUpsUsed: z.number().int().min(0).max(2).describe('Count of follow-ups asked'),
});

export type InterviewPlan = z.infer<typeof InterviewPlanSchema>;
