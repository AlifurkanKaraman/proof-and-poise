import { z } from 'zod';
import { LIMITS } from '../limits';
import { AnswerScoreSchema, CompetencyIdSchema, RubricScoreSchema, ShortIdSchema } from './common';
import { AnswerSourceSchema } from './inputs';

/** Rubric dimensions (Req 11.1). `star` applies to behavioral questions only. */
export const DIMENSIONS = [
  'relevance',
  'specificity',
  'evidence',
  'star',
  'clarity',
  'ownership',
  'roleConnection',
] as const;
export const DimensionSchema = z.enum(DIMENSIONS);
export type Dimension = z.infer<typeof DimensionSchema>;

export const DimensionResultSchema = z.object({
  score: RubricScoreSchema,
  rationale: z.string().min(1).max(300),
});
export type DimensionResult = z.infer<typeof DimensionResultSchema>;

const dimensionShape = Object.fromEntries(
  DIMENSIONS.map((d) => [d, DimensionResultSchema.nullable()]),
) as Record<Dimension, z.ZodNullable<typeof DimensionResultSchema>>;

export const DimensionScoresSchema = z.object(dimensionShape);
export type DimensionScores = z.infer<typeof DimensionScoresSchema>;

export const EvaluationSchema = z.object({
  dimensions: DimensionScoresSchema,
  strength: z.string().min(1).max(400),
  improvement: z.string().min(1).max(400),
  strongerOutline: z.array(z.string().min(1).max(240)).min(1).max(6),
  /** Computed server-side from `dimensions` (design §6.2). */
  weightedScore: AnswerScoreSchema,
  /** Model's suggestion; the server decides whether to use it (design §7.3). */
  candidateFollowUp: z.string().max(LIMITS.interview.followUpMaxChars).nullable(),
  /** `sample` = labeled offline fallback (Req 13.4); never presented as live. */
  feedbackSource: z.enum(['live', 'sample']),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

export const TurnKindSchema = z.enum([
  'behavioral',
  'role_specific',
  'evidence_gap',
  'follow_up',
  'practice',
]);
export type TurnKind = z.infer<typeof TurnKindSchema>;

export const TurnStatusSchema = z.enum([
  'asked',
  'transcribing',
  'answered',
  'evaluated',
  'failed',
]);
export type TurnStatus = z.infer<typeof TurnStatusSchema>;

export const TurnAnswerSchema = z.object({
  text: z.string().min(1).max(LIMITS.answer.max),
  source: AnswerSourceSchema,
  edited: z.boolean(),
});
export type TurnAnswer = z.infer<typeof TurnAnswerSchema>;

export const TurnSchema = z.object({
  id: ShortIdSchema,
  /** Primary question position 1..5. Follow-ups and practice turns share their parent's index. */
  index: z.number().int().min(1).max(LIMITS.interview.primaryQuestions),
  /** Display label: "3" for a primary, "3a" for its follow-up. */
  label: z.string().regex(/^[1-5][a-z]?$/),
  kind: TurnKindSchema,
  parentTurnId: ShortIdSchema.optional(),
  competencyIds: z.array(CompetencyIdSchema).min(1).max(3),
  question: z.string().min(1).max(LIMITS.interview.questionMaxChars),
  answer: TurnAnswerSchema.optional(),
  evaluation: EvaluationSchema.optional(),
  status: TurnStatusSchema,
});
export type Turn = z.infer<typeof TurnSchema>;

export const InterviewStateSchema = z.object({
  turns: z.array(TurnSchema),
  total: z.literal(LIMITS.interview.primaryQuestions),
  followUpsUsed: z.number().int().min(0).max(LIMITS.interview.maxFollowUps),
  status: z.enum(['in_progress', 'complete']),
});
export type InterviewState = z.infer<typeof InterviewStateSchema>;
