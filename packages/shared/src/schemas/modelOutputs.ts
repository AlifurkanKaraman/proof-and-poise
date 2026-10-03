/**
 * Model-output schemas. Stricter than stored schemas (design §4):
 * `.strict()` objects, bounded strings and arrays, and no computed fields.
 * The server converts validated output into domain objects and fills in
 * every computed field (IDs, strengths after caps, scores, decisions).
 *
 * No field exists where an inference about emotion, honesty, personality,
 * disability, or employability could be stored (Req 11.4).
 */
import { z } from 'zod';
import { LIMITS } from '../limits';
import {
  CompetencyCategorySchema,
  CompetencyIdSchema,
  ImportanceSchema,
  ResumeSectionSchema,
  RubricScoreSchema,
  SenioritySchema,
  StrengthSchema,
} from './common';

const str = (max: number) => z.string().min(1).max(max);

// --- analyze ----------------------------------------------------------------

export const AnalysisModelCompetencySchema = z.strictObject({
  id: CompetencyIdSchema,
  name: str(80),
  description: str(300),
  /**
   * Verbatim job-description phrase this competency comes from; grounded server-side.
   * A longer quote is clipped, not rejected: its first `maxChars` characters are still a
   * verbatim slice of the job, so one long qualification line can't fail the whole
   * analysis (design §7.4). The tool schema still advertises the limit to the model.
   */
  jobQuote: z
    .string()
    .min(1)
    .overwrite((s) => s.slice(0, LIMITS.analysis.jobQuote.maxChars))
    .max(LIMITS.analysis.jobQuote.maxChars),
  importance: ImportanceSchema,
  category: CompetencyCategorySchema,
  evidence: z
    .array(z.strictObject({ quote: str(400), section: ResumeSectionSchema }))
    .max(LIMITS.analysis.evidencePerCompetency.max),
  proposedStrength: StrengthSchema,
  missingEvidence: str(300).nullable(),
  suggestedInterviewTopic: str(200),
});

export const AnalysisModelRecommendationSchema = z.strictObject({
  competencyId: CompetencyIdSchema,
  originalText: str(600),
  proposedText: str(600).nullable(),
  reason: str(400),
  /** The model cannot assign `confirmed_by_candidate`; only confirmations produce that. */
  trustLabel: z.enum(['verified_from_resume', 'missing_evidence', 'rewording_only']),
  /**
   * Verbatim resume quotes supporting the change; resolved to evidence IDs server-side.
   * Models sometimes omit it; missing means none, and `verified_from_resume` still needs one.
   */
  sourceQuotes: z.array(str(400)).max(3).default([]),
});

export const AnalysisModelOutputSchema = z.strictObject({
  seniority: SenioritySchema,
  competencies: z
    .array(AnalysisModelCompetencySchema)
    .min(LIMITS.analysis.competencies.min)
    .max(LIMITS.analysis.competencies.max),
  keywords: z
    .array(z.strictObject({ term: str(60), required: z.boolean() }))
    .min(LIMITS.analysis.keywords.min)
    .max(LIMITS.analysis.keywords.max),
  recommendations: z
    .array(AnalysisModelRecommendationSchema)
    .max(LIMITS.analysis.recommendations.max),
});
export type AnalysisModelOutput = z.infer<typeof AnalysisModelOutputSchema>;

// --- confirmRewrite ---------------------------------------------------------

export const ConfirmRewriteModelOutputSchema = z.strictObject({
  recommendation: z
    .strictObject({
      originalText: str(600),
      proposedText: str(600),
      reason: str(400),
    })
    .nullable(),
});
export type ConfirmRewriteModelOutput = z.infer<typeof ConfirmRewriteModelOutputSchema>;

// --- generateQuestions ------------------------------------------------------

const CandidateQuestionSchema = z.strictObject({
  competencyIds: z.array(CompetencyIdSchema).min(1).max(3),
  question: str(LIMITS.interview.questionMaxChars),
});

export const GenerateQuestionsModelOutputSchema = z.strictObject({
  behavioral: z
    .array(CandidateQuestionSchema)
    .length(LIMITS.interview.candidateQuestions.behavioral),
  roleSpecific: z
    .array(CandidateQuestionSchema)
    .length(LIMITS.interview.candidateQuestions.roleSpecific),
  /** Targets the competency the server selected with `selectGapCompetency` and passed in. */
  evidenceGap: z.strictObject({
    competencyId: CompetencyIdSchema,
    question: str(LIMITS.interview.questionMaxChars),
  }),
});
export type GenerateQuestionsModelOutput = z.infer<typeof GenerateQuestionsModelOutputSchema>;

// --- evaluateAnswer ---------------------------------------------------------

const ModelDimensionSchema = z.strictObject({ score: RubricScoreSchema, rationale: str(300) });

export const EvaluationModelOutputSchema = z.strictObject({
  dimensions: z.strictObject({
    relevance: ModelDimensionSchema,
    specificity: ModelDimensionSchema,
    evidence: ModelDimensionSchema,
    /** Null for non-behavioral questions. */
    star: ModelDimensionSchema.nullable(),
    clarity: ModelDimensionSchema,
    ownership: ModelDimensionSchema,
    roleConnection: ModelDimensionSchema,
  }),
  strength: str(400),
  improvement: str(400),
  strongerOutline: z.array(str(240)).min(2).max(5),
  candidateFollowUp: str(LIMITS.interview.followUpMaxChars).nullable(),
});
export type EvaluationModelOutput = z.infer<typeof EvaluationModelOutputSchema>;

// --- report narrative -------------------------------------------------------

export const ReportNarrativeModelOutputSchema = z.strictObject({
  summary: str(900),
  weakestAreas: z
    .array(z.strictObject({ competencyId: CompetencyIdSchema, reason: str(300) }))
    .max(5),
  starOutlines: z
    .array(
      z.strictObject({
        competencyId: CompetencyIdSchema,
        title: str(120),
        situation: str(300),
        task: str(300),
        action: str(300),
        result: str(300),
      }),
    )
    .min(LIMITS.report.starOutlines.min)
    .max(LIMITS.report.starOutlines.max),
  actions: z
    .array(z.strictObject({ competencyId: CompetencyIdSchema, step: str(300) }))
    .length(LIMITS.report.actions),
});
export type ReportNarrativeModelOutput = z.infer<typeof ReportNarrativeModelOutputSchema>;
