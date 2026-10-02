import { TECH_TERMS } from '../keywords/dictionary';
import { canonicalTerm, containsTermNormalized, findTerms } from '../keywords/match';
import { normalize } from './normalize';

/**
 * Numeric claims: digits with optional currency prefix, separators, and magnitude
 * or percent suffixes. Digits glued to letters on the left (e.g. "s3", "ec2") are
 * product names, handled by the tech dictionary instead.
 */
const NUMERIC_RE =
  /(?<![a-z0-9])[$€£¥]?\d+(?:[.,]\d+)*(?:\s?(?:%|percent|million|billion|thousand|bn|k|m|x|\+)(?![a-z0-9]))?/g;

function canonicalNumber(token: string): string {
  return token
    .replace(/\s+/g, '')
    .replace(/,/g, '')
    .replace(/percent$/, '%');
}

/** Canonical numeric tokens in `text` (normalized first). */
export function numericTokens(text: string): string[] {
  const n = normalize(text);
  return [...new Set([...n.matchAll(NUMERIC_RE)].map((m) => canonicalNumber(m[0])))];
}

/** The bare number inside a token: "$1200k" → "1200". */
const numericCore = (token: string) => token.replace(/^[^\d]+/, '').replace(/[^\d.]+$/, '');

function allowedNumbers(sources: readonly string[]): Set<string> {
  const set = new Set<string>();
  for (const s of sources) {
    for (const t of numericTokens(s)) {
      set.add(t);
      // Dropping a unit is never a new claim; adding one is.
      set.add(numericCore(t));
    }
  }
  return set;
}

export interface NovelTermsOptions {
  /** Job keywords to treat as terms in addition to the tech dictionary. */
  keywords?: readonly string[];
}

export interface NovelTermsResult {
  numbers: string[];
  terms: string[];
}

export const isEmptyNovelTerms = (r: NovelTermsResult) =>
  r.numbers.length === 0 && r.terms.length === 0;

function vocabulary(opts: NovelTermsOptions): string[] {
  return [...TECH_TERMS, ...(opts.keywords ?? [])];
}

/** Items in `text` not supported by `sources`. */
function unsupported(
  text: string,
  sources: readonly string[],
  opts: NovelTermsOptions,
): NovelTermsResult {
  const nums = allowedNumbers(sources);
  const numbers = numericTokens(text).filter((t) => !nums.has(t));
  const haystack = sources.map(normalize).join('\n');
  const terms = findTerms(text, vocabulary(opts)).filter(
    (t) => !containsTermNormalized(haystack, t),
  );
  return { numbers, terms };
}

/**
 * Numeric tokens and keyword/tech terms in `proposed` that appear in neither
 * `original` nor `allowedSources` (design §7.4, Req 7.3). Any hit means the
 * recommendation must be discarded.
 */
export function novelTerms(
  proposed: string,
  original: string,
  allowedSources: readonly string[],
  opts: NovelTermsOptions = {},
): NovelTermsResult {
  return unsupported(proposed, [original, ...allowedSources], opts);
}

/** Numbers and terms in `proposed` that are not already in `original`. */
export function addedTerms(
  proposed: string,
  original: string,
  opts: NovelTermsOptions = {},
): NovelTermsResult {
  return unsupported(proposed, [original], opts);
}

/** True when every added number and term appears in at least one of `quotes`. */
export function addedTermsSupportedBy(added: NovelTermsResult, quotes: readonly string[]): boolean {
  if (isEmptyNovelTerms(added)) return true;
  const nums = allowedNumbers(quotes);
  const haystack = quotes.map(normalize).join('\n');
  return (
    added.numbers.every((n) => nums.has(n)) &&
    added.terms.every((t) => containsTermNormalized(haystack, canonicalTerm(t)))
  );
}
