/**
 * quote-verification.ts
 * Verify that quotes are grounded in source documents.
 */

import { normalize } from './normalize.js';
import { LIMITS } from '../limits.js';

/**
 * Check if a quote is grounded in any of the provided sources.
 * Returns true if the normalized quote is a substring of any normalized source.
 *
 * Requirements:
 * - Quote must be >= EVIDENCE_QUOTE_MIN_CHARS (prevents trivial matches)
 * - Normalized quote must be a substring of at least one normalized source
 */
export function isGroundedQuote(quote: string, sources: string[]): boolean {
  // Reject quotes that are too short
  if (quote.length < LIMITS.EVIDENCE_QUOTE_MIN_CHARS) {
    return false;
  }

  const normalizedQuote = normalize(quote);

  // Check if quote appears in any source
  for (const source of sources) {
    const normalizedSource = normalize(source);
    if (normalizedSource.includes(normalizedQuote)) {
      return true;
    }
  }

  return false;
}

/**
 * Find all grounded quotes from a list of candidates.
 * Returns array of quotes that are grounded in the sources.
 */
export function filterGroundedQuotes(candidates: string[], sources: string[]): string[] {
  return candidates.filter((quote) => isGroundedQuote(quote, sources));
}

/**
 * Verify that a quote is grounded and return the source it was found in.
 * Returns the source text if grounded, null otherwise.
 */
export function findGroundingSource(quote: string, sources: string[]): string | null {
  if (quote.length < LIMITS.EVIDENCE_QUOTE_MIN_CHARS) {
    return null;
  }

  const normalizedQuote = normalize(quote);

  for (const source of sources) {
    const normalizedSource = normalize(source);
    if (normalizedSource.includes(normalizedQuote)) {
      return source;
    }
  }

  return null;
}
