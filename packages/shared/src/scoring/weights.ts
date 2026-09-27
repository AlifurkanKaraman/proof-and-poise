import type { Importance, Strength } from '../schemas/common';
import type { Dimension } from '../schemas/interview';

/** Importance weight `w` (design §6). */
export const IMPORTANCE_WEIGHT: Record<Importance, number> = {
  required: 3,
  preferred: 2,
  contextual: 1,
};

/** Strength value `s` (design §6). */
export const STRENGTH_VALUE: Record<Strength, number> = {
  strong: 1.0,
  moderate: 0.6,
  weak: 0.3,
  none: 0,
};

/** Ordered weakest → strongest, for caps and comparisons. */
export const STRENGTH_ORDER: readonly Strength[] = ['none', 'weak', 'moderate', 'strong'];

/** Answer rubric weights (design §6.2). Sum = 100. */
export const DIMENSION_WEIGHT: Record<Dimension, number> = {
  relevance: 20,
  specificity: 15,
  evidence: 20,
  star: 10,
  clarity: 10,
  ownership: 15,
  roleConnection: 10,
};

/** Interview Readiness term weights (design §6.2). */
export const READINESS_WEIGHTS = { performance: 0.7, jobMatch: 0.3 } as const;

/** Clamp to [0, 100] and round to an integer (Req 6.5). */
export function toScore100(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(100, Math.max(0, Math.round(x)));
}
