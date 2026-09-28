/**
 * competency.ts
 * Competency schema - a skill or trait extracted from the job description.
 */

import { z } from 'zod';
import {
  ImportanceSchema,
  StrengthSchema,
  CompetencyCategorySchema,
  ConfirmationStateSchema,
  ReadinessSchema,
} from './base.js';
import { EvidenceSchema } from './evidence.js';
import { LIMITS } from '../limits.js';

export const CompetencySchema = z.object({
  id: z.string().describe('e.g., "c1", "c2", ...'),
  name: z.string().max(LIMITS.MODEL_COMPETENCY_NAME_MAX_CHARS).describe('e.g., "Cloud infrastructure (AWS)"'),
  description: z.string().max(LIMITS.MODEL_COMPETENCY_DESC_MAX_CHARS),
  importance: ImportanceSchema,
  category: CompetencyCategorySchema,
  evidence: z.array(EvidenceSchema).describe('All evidence supporting this competency'),
  strength: StrengthSchema.describe('Computed by server after grounding checks'),
  missingEvidence: z
    .string()
    .max(LIMITS.MODEL_MISSING_EVIDENCE_MAX_CHARS)
    .nullable()
    .describe('What evidence is missing, if strength is weak/none'),
  suggestedInterviewTopic: z
    .string()
    .max(LIMITS.MODEL_SUGGESTION_MAX_CHARS)
    .describe('Topic to explore in interview'),
  confirmationState: ConfirmationStateSchema,
  recommendationIds: z.array(z.string()).describe('IDs of recommendations related to this competency'),
  interview: z
    .object({
      turnIds: z.array(z.string()).describe('Interview turn IDs that targeted this competency'),
      bestScore: z.number().min(1).max(4).nullable().describe('Best score achieved (1-4 scale)'),
    })
    .optional()
    .describe('Interview performance for this competency'),
  readiness: ReadinessSchema.describe('Computed by server based on strength and interview score'),
  interviewPriority: z
    .boolean()
    .describe('User selected "Practice this in the interview" for missing evidence'),
});

export type Competency = z.infer<typeof CompetencySchema>;
