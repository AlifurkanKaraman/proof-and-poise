/**
 * recommendation.ts
 * Recommendation schema - suggested improvements to the resume.
 */

import { z } from 'zod';
import { TrustLabelSchema, DecisionSchema } from './base.js';
import { LIMITS } from '../limits.js';

export const RecommendationSchema = z.object({
  id: z.string().describe('e.g., "r1", "r2", ...'),
  competencyId: z.string().describe('Which competency this recommendation supports'),
  originalText: z
    .string()
    .max(LIMITS.EVIDENCE_QUOTE_MAX_CHARS)
    .describe('Normalized substring of resume (or empty for missing_evidence)'),
  proposedText: z
    .string()
    .max(LIMITS.EVIDENCE_QUOTE_MAX_CHARS)
    .nullable()
    .describe('Proposed rewrite (null for missing_evidence)'),
  reason: z.string().max(LIMITS.MODEL_RECOMMENDATION_REASON_MAX_CHARS).describe('Why this change helps'),
  sourceEvidenceIds: z
    .array(z.string())
    .describe('Evidence IDs that support this recommendation (for trust verification)'),
  trustLabel: TrustLabelSchema,
  decision: DecisionSchema,
});

export type Recommendation = z.infer<typeof RecommendationSchema>;
