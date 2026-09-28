/**
 * report.ts
 * Report schema - final readiness assessment and action plan.
 */

import { z } from 'zod';
import { LIMITS } from '../limits.js';

export const ReportSchema = z.object({
  interviewReadiness: z.number().int().min(0).max(100).describe('Overall readiness score'),
  interviewPerformance: z.number().min(0).max(1).describe('Normalized interview score (0-1)'),
  jobMatchContribution: z.number().min(0).max(1).describe('Job match contribution to readiness'),
  narrative: z
    .string()
    .max(LIMITS.REPORT_NARRATIVE_MAX_CHARS)
    .describe('Personalized summary and next steps'),
  topStrengths: z
    .array(
      z.object({
        competencyId: z.string(),
        name: z.string(),
        why: z.string().max(200),
      })
    )
    .max(3),
  practiceAreas: z
    .array(
      z.object({
        competencyId: z.string(),
        name: z.string(),
        why: z.string().max(200),
        actionable: z.string().max(200).describe('Specific next step'),
      })
    )
    .max(3),
  generatedAt: z.string().datetime(),
});

export type Report = z.infer<typeof ReportSchema>;
