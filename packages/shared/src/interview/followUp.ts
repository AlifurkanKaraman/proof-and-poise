import { LIMITS } from '../limits';
import type { DimensionScores } from '../schemas/interview';

/** Dimensions whose weakness (≤ 2) triggers a follow-up (design §7.3). */
export const FOLLOW_UP_TRIGGER_DIMENSIONS = [
  'relevance',
  'specificity',
  'evidence',
  'ownership',
] as const;

/**
 * Deterministic deepening follow-up used only when the guaranteed follow-up on the GAP
 * question is due and the model offered no usable candidate.
 */
export const DEFAULT_DEEPENING_FOLLOW_UP =
  'You mentioned an example in your answer. Walk me through one specific decision you made there, and what happened as a result.';

export type FollowUpDecision =
  { ask: false } | { ask: true; text: string; reason: 'weak_dimensions' | 'guaranteed_deepening' };

const usable = (text: string | null): text is string =>
  text !== null && text.trim().length > 0 && text.length <= LIMITS.interview.followUpMaxChars;

/**
 * The follow-up rule, applied after each *primary* evaluation (design §7.3):
 * 1. If 2 follow-ups were already used, don't ask.
 * 2. If relevance, specificity, evidence, or ownership is ≤ 2 and the model gave a
 *    usable candidate follow-up (≤ 300 chars), ask it.
 * 3. Otherwise, if none were used and this is primary question 3 (GAP), ask the
 *    deepening follow-up. This guarantees at least one follow-up.
 */
export function decideFollowUp(input: {
  followUpsUsed: number;
  /** 1-based primary question position. */
  primaryIndex: number;
  dimensions: DimensionScores;
  candidateFollowUp: string | null;
}): FollowUpDecision {
  const { followUpsUsed, primaryIndex, dimensions, candidateFollowUp } = input;
  if (followUpsUsed >= LIMITS.interview.maxFollowUps) return { ask: false };

  const weak = FOLLOW_UP_TRIGGER_DIMENSIONS.some((d) => {
    const r = dimensions[d];
    return r !== null && r.score <= 2;
  });
  if (weak && usable(candidateFollowUp)) {
    return { ask: true, text: candidateFollowUp.trim(), reason: 'weak_dimensions' };
  }

  if (followUpsUsed === 0 && primaryIndex === LIMITS.interview.gapPosition) {
    return {
      ask: true,
      text: usable(candidateFollowUp) ? candidateFollowUp.trim() : DEFAULT_DEEPENING_FOLLOW_UP,
      reason: 'guaranteed_deepening',
    };
  }
  return { ask: false };
}
