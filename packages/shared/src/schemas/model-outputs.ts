/**
 * model-outputs.ts
 * Strict schemas for validating AI model outputs (Bedrock tool use).
 * These are stricter than stored schemas with bounded lengths.
 */

import { z } from 'zod';
import {
  ImportanceSchema,
  StrengthSchema,
  CompetencyCategorySchema,
  TrustLabelSchema,
  ResumeSectionSchema,
  SenioritySchema,
  TurnKindSchema,
  DimensionSchema,
} from './base.js';
import { LIMITS } from '../limits.js';

// Analysis model output
export const AnalysisModelCompetencySchema = z
  .object({
    name: z.string().min(1).max(LIMITS.MODEL_COMPETENCY_NAME_MAX_CHARS),
    description: z.string().min(1).max(LIMITS.MODEL_COMPETENCY_DESC_MAX_CHARS),
    importance: ImportanceSchema,
    category: CompetencyCategorySchema,
    proposedStrength: StrengthSchema.describe('Model proposes, server applies rules'),
    evidence: z
      .array(
        z.object({
          quote: z.string().min(LIMITS.EVIDENCE_QUOTE_MIN_CHARS).max(LIMITS.EVIDENCE_QUOTE_MAX_CHARS),
          section: ResumeSectionSchema,
        })
      )
      .max(5)
      .describe('Quotes from resume only'),
    missingEvidence: z.string().max(LIMITS.MODEL_MISSING_EVIDENCE_MAX_CHARS).nullable(),
    suggestedInterviewTopic: z.string().min(1).max(LIMITS.MODEL_SUGGESTION_MAX_CHARS),
  })
  .strict();

export const AnalysisModelKeywordSchema = z
  .object({
    term: z.string().min(1).max(50),
    required: z.boolean(),
  })
  .strict();

export const AnalysisModelRecommendationSchema = z
  .object({
    competencyId: z.string(),
    originalText: z.string().max(LIMITS.EVIDENCE_QUOTE_MAX_CHARS).describe('Empty for missing_evidence'),
    proposedText: z.string().max(LIMITS.EVIDENCE_QUOTE_MAX_CHARS).nullable(),
    reason: z.string().min(1).max(LIMITS.MODEL_RECOMMENDATION_REASON_MAX_CHARS),
    trustLabel: TrustLabelSchema,
    sourceEvidenceRefs: z
      .array(
        z.object({
          competencyId: z.string(),
          quoteSnippet: z.string().max(100).describe('Short snippet to match evidence'),
        })
      )
      .max(3)
      .describe('References for grounding verification'),
  })
  .strict();

export const AnalysisModelOutputSchema = z
  .object({
    competencies: z.array(AnalysisModelCompetencySchema).min(LIMITS.COMPETENCIES_MIN).max(LIMITS.COMPETENCIES_MAX),
    keywords: z.array(AnalysisModelKeywordSchema).min(3).max(20),
    recommendations: z.array(AnalysisModelRecommendationSchema).max(LIMITS.RECOMMENDATION_MAX),
    seniority: SenioritySchema,
  })
  .strict();

export type AnalysisModelOutput = z.infer<typeof AnalysisModelOutputSchema>;

// Confirm rewrite model output
export const ConfirmRewriteModelOutputSchema = z
  .object({
    proposedText: z.string().min(LIMITS.EVIDENCE_QUOTE_MIN_CHARS).max(LIMITS.EVIDENCE_QUOTE_MAX_CHARS),
    reason: z.string().min(1).max(LIMITS.MODEL_RECOMMENDATION_REASON_MAX_CHARS),
  })
  .strict();

export type ConfirmRewriteModelOutput = z.infer<typeof ConfirmRewriteModelOutputSchema>;

// Question generation model output
export const QuestionCandidateSchema = z
  .object({
    kind: TurnKindSchema,
    competencyIds: z.array(z.string()).min(1).max(3),
    question: z.string().min(10).max(LIMITS.MODEL_QUESTION_MAX_CHARS),
  })
  .strict();

export const QuestionGenerationModelOutputSchema = z
  .object({
    behavioral: z.array(QuestionCandidateSchema).length(3),
    roleSpecific: z.array(QuestionCandidateSchema).length(3),
  })
  .strict();

export type QuestionGenerationModelOutput = z.infer<typeof QuestionGenerationModelOutputSchema>;

// Evaluation model output
export const EvaluationDimensionOutputSchema = z
  .object({
    score: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    rationale: z.string().min(1).max(LIMITS.MODEL_EVALUATION_RATIONALE_MAX_CHARS),
  })
  .strict();

export const EvaluationModelOutputSchema = z
  .object({
    dimensions: z.record(DimensionSchema, EvaluationDimensionOutputSchema.nullable()),
    strength: z.string().min(1).max(LIMITS.MODEL_EVALUATION_STRENGTH_MAX_CHARS),
    improvement: z.string().min(1).max(LIMITS.MODEL_EVALUATION_IMPROVEMENT_MAX_CHARS),
    strongerOutline: z
      .array(z.string().min(1).max(LIMITS.MODEL_STRONGER_OUTLINE_POINT_MAX_CHARS))
      .min(1)
      .max(LIMITS.MODEL_STRONGER_OUTLINE_POINTS),
    candidateFollowUp: z.string().max(LIMITS.FOLLOW_UP_QUESTION_MAX_CHARS).nullable(),
  })
  .strict();

export type EvaluationModelOutput = z.infer<typeof EvaluationModelOutputSchema>;

// Report model output
export const ReportModelOutputSchema = z
  .object({
    narrative: z.string().min(100).max(LIMITS.REPORT_NARRATIVE_MAX_CHARS),
    topStrengths: z
      .array(
        z
          .object({
            competencyId: z.string(),
            why: z.string().min(1).max(200),
          })
          .strict()
      )
      .length(3),
    practiceAreas: z
      .array(
        z
          .object({
            competencyId: z.string(),
            why: z.string().min(1).max(200),
            actionable: z.string().min(1).max(200),
          })
          .strict()
      )
      .min(1)
      .max(3),
  })
  .strict();

export type ReportModelOutput = z.infer<typeof ReportModelOutputSchema>;
