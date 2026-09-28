/**
 * evidence-map.ts
 * The core EvidenceMap - the shared artifact that analysis produces and
 * recommendations/confirmations/interview all modify.
 */

import { z } from 'zod';
import { SenioritySchema } from './base.js';
import { CompetencySchema } from './competency.js';
import { KeywordSchema } from './keywords.js';
import { RecommendationSchema } from './recommendation.js';
import { ParseabilityResultSchema, ScoreSetSchema, ScoreEventSchema } from './scoring.js';

export const EvidenceMapSchema = z.object({
  competencies: z.array(CompetencySchema).min(6).max(12),
  keywords: z.array(KeywordSchema),
  recommendations: z.array(RecommendationSchema).max(8),
  seniority: SenioritySchema,
  parseability: ParseabilityResultSchema,
  scores: ScoreSetSchema,
  scoreEvents: z.array(ScoreEventSchema),
});

export type EvidenceMap = z.infer<typeof EvidenceMapSchema>;
