/**
 * keywords.ts
 * Keyword tracking schema.
 */

import { z } from 'zod';

export const KeywordSchema = z.object({
  term: z.string().describe('Normalized keyword from job description'),
  required: z.boolean().describe('Is this a required vs preferred keyword'),
  matched: z.boolean().describe('Found in working resume or confirmations'),
});

export type Keyword = z.infer<typeof KeywordSchema>;
