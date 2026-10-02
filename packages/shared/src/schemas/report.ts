import { z } from 'zod';
import { LIMITS } from '../limits';
import {
  AnswerScoreSchema,
  CompetencyIdSchema,
  IsoDateTimeSchema,
  Score100Schema,
  ShortIdSchema,
} from './common';
import { CompetencyReadinessSchema, EvidenceSourceSchema, ScoreEventSchema } from './evidenceMap';
import { TurnSchema } from './interview';

export const StarOutlineSchema = z.object({
  competencyId: CompetencyIdSchema,
  title: z.string().min(1).max(120),
  situation: z.string().min(1).max(300),
  task: z.string().min(1).max(300),
  action: z.string().min(1).max(300),
  result: z.string().min(1).max(300),
});
export type StarOutline = z.infer<typeof StarOutlineSchema>;

export const PrioritizedActionSchema = z.object({
  priority: z.number().int().min(1).max(LIMITS.report.actions),
  competencyId: CompetencyIdSchema,
  step: z.string().min(1).max(300),
});
export type PrioritizedAction = z.infer<typeof PrioritizedActionSchema>;

export const ReportQuestionSchema = z.object({
  primary: TurnSchema,
  followUps: z.array(TurnSchema),
  practiceAttempts: z.array(TurnSchema),
  /** Score before practice (primary + follow-up rule), and best including practice. */
  originalScore: AnswerScoreSchema.nullable(),
  bestScore: AnswerScoreSchema.nullable(),
});
export type ReportQuestion = z.infer<typeof ReportQuestionSchema>;

export const ReportSchema = z.object({
  readiness: z.object({
    score: Score100Schema,
    /** 100 × P, shown as the first term of the explanation. */
    interviewPerformance: Score100Schema,
    jobMatch: Score100Schema,
    performanceWeight: z.literal(0.7),
    jobMatchWeight: z.literal(0.3),
  }),
  summary: z.string().min(1).max(900),
  competencies: z.array(
    z.object({
      competencyId: CompetencyIdSchema,
      name: z.string().min(1).max(80),
      readiness: CompetencyReadinessSchema,
      bestScore: AnswerScoreSchema.nullable(),
    }),
  ),
  questions: z.array(ReportQuestionSchema),
  strongestEvidence: z
    .array(
      z.object({
        competencyId: CompetencyIdSchema,
        evidenceId: ShortIdSchema,
        source: EvidenceSourceSchema,
        quote: z.string().min(1).max(600),
      }),
    )
    .max(5),
  weakestAreas: z
    .array(z.object({ competencyId: CompetencyIdSchema, reason: z.string().min(1).max(300) }))
    .max(5),
  starOutlines: z
    .array(StarOutlineSchema)
    .min(LIMITS.report.starOutlines.min)
    .max(LIMITS.report.starOutlines.max),
  actions: z.array(PrioritizedActionSchema).length(LIMITS.report.actions),
  scoreEvents: z.array(ScoreEventSchema),
  generatedAt: IsoDateTimeSchema,
});
export type Report = z.infer<typeof ReportSchema>;
