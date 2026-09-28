/**
 * novel-terms.ts
 * Detect novel terms in recommendations that could indicate fabrication.
 * Prevents AI from adding facts not present in source materials.
 */

import { normalizeKeyword, extractTokens } from './normalize.js';
import { getKeywordAliases, isTechTerm } from '../keywords/index.js';

/**
 * Result of novel term detection.
 */
export interface NovelTermsResult {
  numericTerms: string[];
  keywordTerms: string[];
  hasNovelTerms: boolean;
}

/**
 * Detect novel terms in proposed text that aren't found in allowed sources.
 *
 * Novel terms include:
 * 1. Numeric tokens (digits, %, $, k/M suffixes) not in sources
 * 2. Keywords or tech-dictionary terms not in sources
 *
 * Returns list of novel terms found. Empty if all terms are grounded.
 */
export function detectNovelTerms(
  proposedText: string,
  allowedSources: string[]
): NovelTermsResult {
  const proposedTokens = extractTokens(proposedText);
  const sourceText = allowedSources.join(' ');
  const sourceTokens = new Set(extractTokens(sourceText));

  const numericTerms: string[] = [];
  const keywordTerms: string[] = [];

  for (const token of proposedTokens) {
    // Check numeric patterns
    if (isNumericTerm(token)) {
      if (!sourceTokens.has(token)) {
        numericTerms.push(token);
      }
      continue;
    }

    // Check if it's a known keyword/tech term
    if (isTechTerm(token) || isKnownKeyword(token, sourceTokens)) {
      if (!sourceTokens.has(token) && !hasAliasInSources(token, sourceTokens)) {
        keywordTerms.push(token);
      }
    }
  }

  return {
    numericTerms,
    keywordTerms,
    hasNovelTerms: numericTerms.length > 0 || keywordTerms.length > 0,
  };
}

/**
 * Check if a token is a numeric term (digits, percentages, currency, suffixes).
 */
function isNumericTerm(token: string): boolean {
  // Patterns: digits, %, $, k/M/B suffixes
  const numericPattern = /\d+|%|\$|(\d+[kmb])|(\d+\.\d+)/i;
  return numericPattern.test(token);
}

/**
 * Check if token is a known keyword (uses keyword dictionary).
 */
function isKnownKeyword(token: string, sourceTokens: Set<string>): boolean {
  // Simple heuristic: capitalized multi-char tokens or known tech terms
  return token.length > 2 && (isTechTerm(token) || /^[a-z]{3,}$/.test(token));
}

/**
 * Check if a keyword has an alias in the sources.
 */
function hasAliasInSources(keyword: string, sourceTokens: Set<string>): boolean {
  const aliases = getKeywordAliases(keyword);
  return aliases.some((alias) => sourceTokens.has(normalizeKeyword(alias)));
}

/**
 * Validate that a recommendation's trust label is consistent with novel term check.
 *
 * Rules:
 * - rewording_only: MUST have no novel terms AND no new keyword matches
 * - verified_from_resume: Added terms must appear elsewhere in resume
 */
export function validateTrustLabel(
  trustLabel: 'verified_from_resume' | 'confirmed_by_candidate' | 'missing_evidence' | 'rewording_only',
  proposedText: string | null,
  originalText: string,
  resumeText: string
): { valid: boolean; reason?: string } {
  if (trustLabel === 'rewording_only') {
    if (!proposedText) {
      return { valid: false, reason: 'rewording_only requires proposed text' };
    }

    const novelTerms = detectNovelTerms(proposedText, [originalText, resumeText]);
    if (novelTerms.hasNovelTerms) {
      return {
        valid: false,
        reason: `rewording_only but found novel terms: ${[...novelTerms.numericTerms, ...novelTerms.keywordTerms].join(', ')}`,
      };
    }
  }

  if (trustLabel === 'verified_from_resume') {
    if (!proposedText) {
      return { valid: false, reason: 'verified_from_resume requires proposed text' };
    }

    const novelTerms = detectNovelTerms(proposedText, [resumeText]);
    if (novelTerms.hasNovelTerms) {
      return {
        valid: false,
        reason: 'verified_from_resume but added terms not found in resume',
      };
    }
  }

  if (trustLabel === 'missing_evidence') {
    if (proposedText !== null) {
      return { valid: false, reason: 'missing_evidence must have null proposed text' };
    }
  }

  return { valid: true };
}
