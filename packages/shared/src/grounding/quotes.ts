import { LIMITS } from '../limits';
import { normalize } from './normalize';

/**
 * True when the normalized quote is at least `minQuoteChars` long and is a substring
 * of some normalized source (design §7.4, Req 5.4).
 */
export function isGroundedQuote(quote: string, sources: readonly string[]): boolean {
  const q = normalize(quote);
  if (q.length < LIMITS.grounding.minQuoteChars) return false;
  return sources.some((s) => normalize(s).includes(q));
}

/**
 * Drop `resume` evidence whose quote isn't grounded in the resume text.
 * Candidate confirmations are the candidate's own words and are kept as-is.
 */
export function filterGroundedEvidence<E extends { source: string; quote: string }>(
  evidence: readonly E[],
  resumeText: string,
): { kept: E[]; discarded: number } {
  const kept = evidence.filter(
    (e) => e.source !== 'resume' || isGroundedQuote(e.quote, [resumeText]),
  );
  return { kept, discarded: evidence.length - kept.length };
}
