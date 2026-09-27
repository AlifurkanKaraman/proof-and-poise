import fc from 'fast-check';
import type { Importance, Strength } from '../schemas/common';
import type { DimensionScores } from '../schemas/interview';

export const importanceArb: fc.Arbitrary<Importance> = fc.constantFrom(
  'required',
  'preferred',
  'contextual',
);
export const strengthArb: fc.Arbitrary<Strength> = fc.constantFrom(
  'strong',
  'moderate',
  'weak',
  'none',
);

export const scoredCompetencyArb = fc.record({ importance: importanceArb, strength: strengthArb });

export const competenciesArb = fc.array(scoredCompetencyArb, { minLength: 6, maxLength: 12 });

export const keywordsArb = fc.array(fc.record({ required: fc.boolean(), matched: fc.boolean() }), {
  minLength: 8,
  maxLength: 30,
});

const dimArb = fc.record({
  score: fc.integer({ min: 1, max: 4 }),
  rationale: fc.constant('Cites the answer.'),
});

/** Rubric dimensions; `star` is null for non-behavioral questions. */
export const dimensionsArb: fc.Arbitrary<DimensionScores> = fc.record({
  relevance: dimArb,
  specificity: dimArb,
  evidence: dimArb,
  star: fc.option(dimArb, { nil: null }),
  clarity: dimArb,
  ownership: dimArb,
  roleConnection: dimArb,
});

/** Candidate follow-up: absent, usable, or too long to use. */
export const candidateFollowUpArb: fc.Arbitrary<string | null> = fc.oneof(
  fc.constant(null),
  fc.string({ minLength: 1, maxLength: 300 }).filter((s) => s.trim().length > 0),
  fc.string({ minLength: 301, maxLength: 400 }),
);
