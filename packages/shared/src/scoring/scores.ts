import type { Importance, Strength } from '../schemas/common';
import { IMPORTANCE_WEIGHT, STRENGTH_VALUE, toScore100 } from './weights';

export interface ScoredCompetency {
  importance: Importance;
  strength: Strength;
}

/** Job Match = 100 × Σ(w·s) / Σ(w). Empty input scores 0. */
export function jobMatchScore(competencies: readonly ScoredCompetency[]): number {
  let num = 0;
  let den = 0;
  for (const c of competencies) {
    const w = IMPORTANCE_WEIGHT[c.importance];
    num += w * STRENGTH_VALUE[c.strength];
    den += w;
  }
  return den === 0 ? 0 : toScore100((100 * num) / den);
}

/** Evidence Coverage = 100 × Σ(w·[s > 0]) / Σ(w). */
export function evidenceCoverageScore(competencies: readonly ScoredCompetency[]): number {
  let num = 0;
  let den = 0;
  for (const c of competencies) {
    const w = IMPORTANCE_WEIGHT[c.importance];
    if (STRENGTH_VALUE[c.strength] > 0) num += w;
    den += w;
  }
  return den === 0 ? 0 : toScore100((100 * num) / den);
}

/** Keyword Coverage = 100 × matched / total, with required keywords counted twice. */
export function keywordCoverageScore(
  keywords: readonly { required: boolean; matched: boolean }[],
): number {
  let num = 0;
  let den = 0;
  for (const k of keywords) {
    const w = k.required ? 2 : 1;
    if (k.matched) num += w;
    den += w;
  }
  return den === 0 ? 0 : toScore100((100 * num) / den);
}

/** Inputs for the "How is this calculated?" disclosure (Req 6.3). */
export function coverageBreakdown(competencies: readonly ScoredCompetency[]) {
  const by = (imp: Importance) => competencies.filter((c) => c.importance === imp);
  const withEvidence = (cs: ScoredCompetency[]) =>
    cs.filter((c) => STRENGTH_VALUE[c.strength] > 0).length;
  return (['required', 'preferred', 'contextual'] as const).map((importance) => {
    const cs = by(importance);
    return { importance, total: cs.length, withEvidence: withEvidence(cs) };
  });
}
