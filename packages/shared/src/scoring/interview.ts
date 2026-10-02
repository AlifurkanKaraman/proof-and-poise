import type { Importance, Strength } from '../schemas/common';
import type { CompetencyReadiness } from '../schemas/evidenceMap';
import type { Dimension, DimensionScores } from '../schemas/interview';
import {
  DIMENSION_WEIGHT,
  IMPORTANCE_WEIGHT,
  READINESS_WEIGHTS,
  STRENGTH_VALUE,
  toScore100,
} from './weights';

const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Answer score (1–4): weighted mean of the scored dimensions (design §6.2).
 * Null dimensions (STAR on non-behavioral questions) are excluded, which
 * redistributes their weight proportionally among the others.
 * Rounded to 2 decimals.
 */
export function answerScore(dimensions: DimensionScores): number {
  let num = 0;
  let den = 0;
  for (const [d, result] of Object.entries(dimensions) as [
    Dimension,
    DimensionScores[Dimension],
  ][]) {
    if (result === null) continue;
    const w = DIMENSION_WEIGHT[d];
    num += w * result.score;
    den += w;
  }
  if (den === 0) throw new Error('answerScore: no scored dimensions');
  return round2(num / den);
}

/**
 * Question score = max(primary, (primary + followUp) / 2), then the best practice
 * attempt replaces it when higher (design §6.2). A follow-up can only help.
 */
export function questionScore(
  primary: number,
  followUp: number | null = null,
  practiceAttempts: readonly number[] = [],
): number {
  const base = followUp === null ? primary : Math.max(primary, (primary + followUp) / 2);
  return round2(Math.max(base, ...practiceAttempts));
}

export interface ScoredQuestion {
  score: number;
  competencyIds: readonly string[];
}

/**
 * Interview performance P ∈ [0, 1] = Σ(qScore_norm × w_q) / Σ w_q, with
 * qScore_norm = (score − 1) / 3 and w_q = the highest importance weight among the
 * targeted competencies (1 when none are known). Returns null with no questions.
 */
export function interviewPerformance(
  questions: readonly ScoredQuestion[],
  importanceById: ReadonlyMap<string, Importance> | Readonly<Record<string, Importance>>,
): number | null {
  if (questions.length === 0) return null;
  const lookup = (id: string) =>
    importanceById instanceof Map
      ? importanceById.get(id)
      : (importanceById as Record<string, Importance>)[id];
  let num = 0;
  let den = 0;
  for (const q of questions) {
    const weights = q.competencyIds
      .map(lookup)
      .filter((i): i is Importance => i !== undefined)
      .map((i) => IMPORTANCE_WEIGHT[i]);
    const w = weights.length > 0 ? Math.max(...weights) : 1;
    const norm = Math.min(1, Math.max(0, (q.score - 1) / 3));
    num += norm * w;
    den += w;
  }
  return num / den;
}

/** Interview Readiness = 100 × (0.7·P + 0.3·JobMatch/100). */
export function interviewReadiness(performance: number, jobMatch: number): number {
  return toScore100(
    100 *
      (READINESS_WEIGHTS.performance * performance + (READINESS_WEIGHTS.jobMatch * jobMatch) / 100),
  );
}

/** Competency readiness status (design §6.2). */
export function competencyReadiness(
  strength: Strength,
  bestScore: number | null,
): CompetencyReadiness {
  const s = STRENGTH_VALUE[strength];
  if (bestScore === null) return s >= 0.6 ? 'developing' : 'not_assessed';
  if (s >= 0.6 && bestScore >= 3.0) return 'ready';
  if (bestScore >= 2.5) return 'developing';
  return 'needs_practice';
}

export type AnswerLevel = 'beginning' | 'developing' | 'proficient' | 'strong';

/**
 * Display level for a 1–4 score. "Practice again" is offered below `proficient`
 * (Req 12.3). Thresholds: < 2 beginning, < 3 developing, < 3.5 proficient, else strong.
 */
export function answerLevel(score: number): AnswerLevel {
  if (score < 2) return 'beginning';
  if (score < 3) return 'developing';
  if (score < 3.5) return 'proficient';
  return 'strong';
}

export const canPracticeAgain = (score: number) => score < 3;
