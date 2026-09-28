/**
 * evidence.ts
 * Evidence schema - verbatim quotes from resume or candidate confirmations.
 */

import { z } from 'zod';
import { EvidenceSourceSchema, ResumeSectionSchema } from './base.js';
import { LIMITS } from '../limits.js';

export const EvidenceSchema = z.object({
  id: z.string(), // e.g., "e1", "e2", ...
  source: EvidenceSourceSchema,
  quote: z
    .string()
    .min(LIMITS.EVIDENCE_QUOTE_MIN_CHARS)
    .max(LIMITS.EVIDENCE_QUOTE_MAX_CHARS)
    .describe('Verbatim quote, grounding-verified'),
  section: ResumeSectionSchema.optional().describe('Section where evidence was found (resume only)'),
});

export type Evidence = z.infer<typeof EvidenceSchema>;
