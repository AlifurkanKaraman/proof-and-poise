import { z } from 'zod';
import { LIMITS } from '../limits';
import {
  AnswerScoreSchema,
  CompetencyCategorySchema,
  CompetencyIdSchema,
  ImportanceSchema,
  IsoDateTimeSchema,
  ResumeSectionSchema,
  Score100Schema,
  SenioritySchema,
  ShortIdSchema,
  StrengthSchema,
  TrustLabelSchema,
} from './common';

export const EvidenceSourceSchema = z.enum(['resume', 'candidate_confirmation']);
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;

export const EvidenceSchema = z.object({
  id: ShortIdSchema,
  source: EvidenceSourceSchema,
  /** Verbatim; grounding-verified for `resume` evidence. */
  quote: z.string().min(1).max(LIMITS.confirmation.max),
  section: ResumeSectionSchema.optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const CompetencyReadinessSchema = z.enum([
  'ready',
  'developing',
  'needs_practice',
  'not_assessed',
]);
export type CompetencyReadiness = z.infer<typeof CompetencyReadinessSchema>;

export const CompetencySchema = z.object({
  id: CompetencyIdSchema,
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(300),
  importance: ImportanceSchema,
  category: CompetencyCategorySchema,
  evidence: z
    .array(EvidenceSchema)
    .max(LIMITS.analysis.evidencePerCompetency.max + LIMITS.confirmation.maxPerSession),
  /** After server rules (design §6.1). */
  strength: StrengthSchema,
  missingEvidence: z.string().max(300).nullable(),
  suggestedInterviewTopic: z.string().min(1).max(200),
  confirmationState: z.enum(['none', 'confirmed']),
  recommendationIds: z.array(ShortIdSchema),
  interview: z
    .object({
      turnIds: z.array(ShortIdSchema),
      bestScore: AnswerScoreSchema.nullable(),
    })
    .optional(),
  readiness: CompetencyReadinessSchema,
  interviewPriority: z.boolean(),
});
export type Competency = z.infer<typeof CompetencySchema>;

export const RecommendationDecisionSchema = z.enum(['pending', 'accepted', 'rejected']);
export type RecommendationDecision = z.infer<typeof RecommendationDecisionSchema>;

export const RecommendationSchema = z.object({
  id: ShortIdSchema,
  competencyId: CompetencyIdSchema,
  /** Normalized substring of the resume (Req 7.2). */
  originalText: z.string().min(1).max(600),
  /** Null when `missing_evidence`. */
  proposedText: z.string().min(1).max(600).nullable(),
  reason: z.string().min(1).max(400),
  sourceEvidenceIds: z.array(ShortIdSchema),
  trustLabel: TrustLabelSchema,
  decision: RecommendationDecisionSchema,
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const KeywordSchema = z.object({
  term: z.string().min(1).max(60),
  required: z.boolean(),
  matched: z.boolean(),
});
export type Keyword = z.infer<typeof KeywordSchema>;

export const ParseabilityCheckIdSchema = z.enum([
  'extractable',
  'section_headings',
  'contact_info',
  'dates',
  'line_structure',
  'clean_characters',
  'word_count',
]);
export type ParseabilityCheckId = z.infer<typeof ParseabilityCheckIdSchema>;

export const ParseabilityCheckSchema = z.object({
  id: ParseabilityCheckIdSchema,
  passed: z.boolean(),
  points: z.number().int().min(0).max(100),
  maxPoints: z.number().int().min(0).max(100),
});
export type ParseabilityCheck = z.infer<typeof ParseabilityCheckSchema>;

export const ParseabilityResultSchema = z.object({
  score: Score100Schema,
  /** `text` means pasted input: layout was not evaluated (design §6.2). */
  inputKind: z.enum(['pdf', 'text']),
  checks: z.array(ParseabilityCheckSchema),
});
export type ParseabilityResult = z.infer<typeof ParseabilityResultSchema>;

export const ScoreMetricSchema = z.enum([
  'jobMatch',
  'evidenceCoverage',
  'keywordCoverage',
  'parseability',
  'interviewReadiness',
]);
export type ScoreMetric = z.infer<typeof ScoreMetricSchema>;

export const ScoreSetSchema = z.object({
  jobMatch: Score100Schema,
  evidenceCoverage: Score100Schema,
  keywordCoverage: Score100Schema,
  parseability: Score100Schema,
  /** Null until at least one answer is evaluated. */
  interviewReadiness: Score100Schema.nullable(),
});
export type ScoreSet = z.infer<typeof ScoreSetSchema>;

export const ScoreEventSchema = z.object({
  id: ShortIdSchema,
  metric: ScoreMetricSchema,
  before: Score100Schema.nullable(),
  after: Score100Schema.nullable(),
  reason: z.string().min(1).max(200),
  /** e.g. "recommendation:r3", "confirmation:c4", "turn:t3a". */
  sourceRef: z.string().min(1).max(64),
  at: IsoDateTimeSchema,
});
export type ScoreEvent = z.infer<typeof ScoreEventSchema>;

export const EvidenceMapSchema = z.object({
  competencies: z
    .array(CompetencySchema)
    .min(LIMITS.analysis.competencies.min)
    .max(LIMITS.analysis.competencies.max),
  keywords: z
    .array(KeywordSchema)
    .min(LIMITS.analysis.keywords.min)
    .max(LIMITS.analysis.keywords.max),
  recommendations: z
    .array(RecommendationSchema)
    // Up to 10 from analysis plus 1 per confirmation (Req 7.8, 8.3).
    .max(LIMITS.analysis.recommendations.max + LIMITS.confirmation.maxPerSession),
  seniority: SenioritySchema,
  parseability: ParseabilityResultSchema,
  scores: ScoreSetSchema,
  scoreEvents: z.array(ScoreEventSchema),
});
export type EvidenceMap = z.infer<typeof EvidenceMapSchema>;
