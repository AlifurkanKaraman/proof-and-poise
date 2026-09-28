/**
 * readiness.ts
 * Calculate competency readiness based on strength and interview performance.
 */

import type { Readiness, Strength } from '../schemas/base.js';
import { strengthValue } from './strength-rules.js';

/**
 * Determine competency readiness:
 * - ready: s ≥ 0.6 AND best score ≥ 3.0
 * - developing: best score ≥ 2.5, OR s ≥ 0.6 with no score yet
 * - needs_practice: best score < 2.5
 * - not_assessed: no score AND s < 0.6
 */
export function calculateCompetencyReadiness(
  strength: Strength,
  bestInterviewScore: number | null
): Readiness {
  const s = strengthValue(strength);

  if (bestInterviewScore !== null) {
    // Has interview score
    if (s >= 0.6 && bestInterviewScore >= 3.0) {
      return 'ready';
    } else if (bestInterviewScore >= 2.5) {
      return 'developing';
    } else {
      return 'needs_practice';
    }
  } else {
    // No interview score yet
    if (s >= 0.6) {
      return 'developing';
    } else {
      return 'not_assessed';
    }
  }
}
