/**
 * follow-up-rule.ts
 * Deterministic rule for deciding when to ask follow-up questions.
 * Maximum 2 follow-ups per interview, strategically placed.
 */

import type { Evaluation } from '../schemas/interview.js';

export interface FollowUpDecision {
  shouldAsk: boolean;
  reason: string;
}

/**
 * Decide whether to ask a follow-up question after evaluating a primary answer.
 *
 * Rules (checked in order):
 * 1. If followUpsUsed == 2, don't ask (maximum reached)
 * 2. If any of relevance, specificity, evidence, or ownership is ≤ 2,
 *    and the model provided candidateFollowUp, ask it
 * 3. Otherwise, if followUpsUsed == 0 and this is question 3 (GAP question),
 *    ask the deepening follow-up (guarantees at least 1 follow-up)
 * 4. Otherwise, don't ask
 *
 * @param evaluation - The evaluation from the model
 * @param followUpsUsed - Count of follow-ups used so far (0-2)
 * @param questionIndex - Index of the primary question (1-5)
 * @param isGapQuestion - True if this is the evidence-gap question (index 3)
 * @returns Decision object with shouldAsk flag and reason
 */
export function decideFollowUp(
  evaluation: Evaluation,
  followUpsUsed: number,
  questionIndex: number,
  isGapQuestion: boolean
): FollowUpDecision {
  // Rule 1: Maximum follow-ups reached
  if (followUpsUsed >= 2) {
    return {
      shouldAsk: false,
      reason: 'Maximum follow-ups (2) already used',
    };
  }

  // Rule 2: Low score in key dimensions + model suggested follow-up
  const dimensions = evaluation.dimensions;
  const relevanceScore = dimensions.relevance?.score ?? 4;
  const specificityScore = dimensions.specificity?.score ?? 4;
  const evidenceScore = dimensions.evidence?.score ?? 4;
  const ownershipScore = dimensions.ownership?.score ?? 4;

  const hasLowScore =
    relevanceScore <= 2 || specificityScore <= 2 || evidenceScore <= 2 || ownershipScore <= 2;

  if (hasLowScore && evaluation.candidateFollowUp) {
    return {
      shouldAsk: true,
      reason: 'Answer needs clarification in key dimension',
    };
  }

  // Rule 3: Guaranteed follow-up on GAP question if none used yet
  if (followUpsUsed === 0 && isGapQuestion) {
    return {
      shouldAsk: true,
      reason: 'Guaranteed deepening follow-up on evidence gap question',
    };
  }

  // Rule 4: Don't ask
  return {
    shouldAsk: false,
    reason: 'Answer quality sufficient, no follow-up needed',
  };
}

/**
 * Validate that a follow-up question meets requirements:
 * - Must be ≤ 300 characters
 * - Should reference the candidate's answer
 *
 * Returns validation result.
 */
export function validateFollowUpQuestion(followUpText: string): {
  valid: boolean;
  reason?: string;
} {
  if (followUpText.length === 0) {
    return { valid: false, reason: 'Follow-up question is empty' };
  }

  if (followUpText.length > 300) {
    return { valid: false, reason: 'Follow-up question exceeds 300 characters' };
  }

  return { valid: true };
}

/**
 * Generate a default deepening follow-up for the GAP question.
 * Used when the model doesn't provide one, or for guaranteed Rule 3 follow-up.
 */
export function getDefaultGapFollowUp(competencyName: string): string {
  return `Can you elaborate more on your experience with ${competencyName}? What specific challenges did you face?`;
}
