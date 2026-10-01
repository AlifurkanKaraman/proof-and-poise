import type { ResumeSection, Strength } from '../schemas/common';
import { STRENGTH_ORDER } from './weights';

export type StrengthCapReason =
  'no_evidence' | 'confirmation_only' | 'skills_only' | 'single_quote';

export interface StrengthEvidence {
  source: 'resume' | 'candidate_confirmation';
  section?: ResumeSection | undefined;
}

const minStrength = (a: Strength, b: Strength): Strength =>
  STRENGTH_ORDER.indexOf(a) <= STRENGTH_ORDER.indexOf(b) ? a : b;

/**
 * Apply the server-side strength caps (design §6.1) to a model-proposed strength.
 * `evidence` must already be grounding-filtered.
 *
 * - No grounded resume quote and no confirmation → `none`.
 * - Only confirmations → at most `moderate` (Req 8.2).
 * - Only a single resume quote from the Skills section (plus no confirmation) → at most `weak`.
 *   With a confirmation as well, the confirmation cap (`moderate`) applies instead.
 * - Only a single resume quote from experience, projects, or other sections (no
 *   confirmation) → at most `moderate`. `strong` needs two independent pieces of evidence.
 *   An Education line is exempt: one line fully proves a degree or certification.
 */
export function capStrength(
  proposed: Strength,
  evidence: readonly StrengthEvidence[],
): { strength: Strength; cap: StrengthCapReason | null } {
  const resume = evidence.filter((e) => e.source === 'resume');
  const confirmations = evidence.filter((e) => e.source === 'candidate_confirmation');

  if (resume.length === 0 && confirmations.length === 0) {
    return { strength: 'none', cap: 'no_evidence' };
  }

  const skillsOnly = resume.length === 1 && resume[0]?.section === 'skills';
  if (resume.length === 0 || (skillsOnly && confirmations.length > 0)) {
    const strength = minStrength(proposed, 'moderate');
    return { strength, cap: strength !== proposed ? 'confirmation_only' : null };
  }
  if (skillsOnly) {
    const strength = minStrength(proposed, 'weak');
    return { strength, cap: strength !== proposed ? 'skills_only' : null };
  }
  if (resume.length === 1 && confirmations.length === 0 && resume[0]?.section !== 'education') {
    const strength = minStrength(proposed, 'moderate');
    return { strength, cap: strength !== proposed ? 'single_quote' : null };
  }
  return { strength: proposed, cap: null };
}

/** Plain-language explanation for the UI (design §6.1). */
export const STRENGTH_CAP_EXPLANATION: Record<StrengthCapReason, string> = {
  no_evidence: 'None: no verified evidence in your resume yet.',
  confirmation_only: 'Moderate at most: confirmed by you, not yet shown in your resume.',
  skills_only: 'Weak: listed in Skills only, not shown in experience or projects.',
  single_quote: 'Moderate at most: shown in one resume line. Strong needs two.',
};
