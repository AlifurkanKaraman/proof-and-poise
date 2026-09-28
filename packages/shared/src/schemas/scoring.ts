/**
 * scoring.ts
 * Schemas for scoring and score events.
 */

import { z } from 'zod';

export const ParseabilityResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  details: z.object({
    hasMinLength: z.boolean(),
    hasStandardHeadings: z.boolean(),
    hasContact: z.boolean(),
    hasDates: z.boolean(),
    hasBulletStructure: z.boolean(),
    lowGarbledRatio: z.boolean(),
    wordCountInRange: z.boolean(),
  }),
  isPasted: z.boolean().describe('True if input was pasted text, not PDF'),
});

export type ParseabilityResult = z.infer<typeof ParseabilityResultSchema>;

export const ScoreSetSchema = z.object({
  jobMatch: z.number().int().min(0).max(100).describe('Weighted match of competencies'),
  evidenceCoverage: z.number().int().min(0).max(100).describe('Weighted share with any evidence'),
  keywordCoverage: z.number().int().min(0).max(100).describe('Keyword match percentage'),
  parseability: z.number().int().min(0).max(100).describe('Resume quality score'),
  interviewReadiness: z
    .number()
    .int()
    .min(0)
    .max(100)
    .nullable()
    .describe('Overall interview preparedness (null before interview)'),
});

export type ScoreSet = z.infer<typeof ScoreSetSchema>;

export const ScoreEventSchema = z.object({
  metric: z.enum(['jobMatch', 'evidenceCoverage', 'keywordCoverage', 'interviewReadiness']),
  before: z.number(),
  after: z.number(),
  reason: z.string().max(200).describe('User-facing explanation'),
  sourceRef: z.string().optional().describe('e.g., competencyId, recommendationId, turnId'),
  at: z.string().datetime().describe('ISO 8601 timestamp'),
});

export type ScoreEvent = z.infer<typeof ScoreEventSchema>;
