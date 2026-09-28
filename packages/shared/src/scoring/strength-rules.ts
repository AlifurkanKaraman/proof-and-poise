/**
 * strength-rules.ts
 * Server-enforced rules for capping competency strength based on evidence.
 * The model proposes a strength; these rules enforce truthfulness constraints.
 */

import type { Strength, EvidenceSource, ResumeSection } from '../schemas/base.js';
import type { Evidence } from '../schemas/evidence.js';

export interface StrengthRuleResult {
  strength: Strength;
  reason: string;
}

/**
 * Apply server-side strength rules to a competency.
 *
 * Rules (in priority order):
 * 1. No evidence (no resume quote and no confirmation) → none
 * 2. Only confirmation (no resume quote) → at most moderate
 * 3. Only Skills section evidence (no Experience/Projects) → at most weak
 * 4. Otherwise, use the model's proposed strength
 */
export function applyStrengthRules(
  proposedStrength: Strength,
  evidence: Evidence[]
): StrengthRuleResult {
  // Rule 1: No evidence at all
  if (evidence.length === 0) {
    return {
      strength: 'none',
      reason: 'No evidence found in resume or confirmed by you',
    };
  }

  const hasResumeEvidence = evidence.some((e) => e.source === 'resume');
  const hasConfirmation = evidence.some((e) => e.source === 'candidate_confirmation');
  const hasNonSkillsEvidence = evidence.some(
    (e) => e.source === 'resume' && e.section && e.section !== 'skills'
  );

  // Rule 2: Only confirmation, no resume evidence
  if (!hasResumeEvidence && hasConfirmation) {
    const cappedStrength = capStrength(proposedStrength, 'moderate');
    return {
      strength: cappedStrength,
      reason: 'Based on your confirmation only (not found in resume)',
    };
  }

  // Rule 3: Only Skills section, no Experience/Projects
  if (hasResumeEvidence && !hasNonSkillsEvidence && !hasConfirmation) {
    const cappedStrength = capStrength(proposedStrength, 'weak');
    return {
      strength: cappedStrength,
      reason: 'Listed in Skills section only (not demonstrated in experience or projects)',
    };
  }

  // Rule 4: Has substantive evidence, use proposed
  if (hasNonSkillsEvidence || (hasResumeEvidence && hasConfirmation)) {
    return {
      strength: proposedStrength,
      reason: getStrengthReason(proposedStrength, hasConfirmation),
    };
  }

  // Fallback (shouldn't reach here)
  return {
    strength: proposedStrength,
    reason: 'Based on available evidence',
  };
}

/**
 * Cap a strength to a maximum level.
 * Strength hierarchy: strong > moderate > weak > none
 */
function capStrength(proposed: Strength, max: Strength): Strength {
  const hierarchy: Strength[] = ['none', 'weak', 'moderate', 'strong'];
  const proposedIndex = hierarchy.indexOf(proposed);
  const maxIndex = hierarchy.indexOf(max);

  return proposedIndex > maxIndex ? max : proposed;
}

/**
 * Generate a user-facing reason for the final strength.
 */
function getStrengthReason(strength: Strength, hasConfirmation: boolean): string {
  switch (strength) {
    case 'strong':
      return hasConfirmation
        ? 'Clearly demonstrated in resume and confirmed by you'
        : 'Clearly demonstrated across multiple resume sections';
    case 'moderate':
      return hasConfirmation
        ? 'Present in resume and confirmed by you'
        : 'Present in resume with some supporting detail';
    case 'weak':
      return 'Mentioned but not thoroughly demonstrated';
    case 'none':
      return 'No evidence found';
  }
}

/**
 * Get numeric value for strength (used in scoring calculations).
 */
export function strengthValue(strength: Strength): number {
  switch (strength) {
    case 'strong':
      return 1.0;
    case 'moderate':
      return 0.6;
    case 'weak':
      return 0.3;
    case 'none':
      return 0.0;
  }
}

/**
 * Get importance weight (used in scoring calculations).
 */
export function importanceWeight(importance: 'required' | 'preferred' | 'contextual'): number {
  switch (importance) {
    case 'required':
      return 3;
    case 'preferred':
      return 2;
    case 'contextual':
      return 1;
  }
}
