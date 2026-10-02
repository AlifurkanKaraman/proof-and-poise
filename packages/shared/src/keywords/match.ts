import { normalize } from '../grounding/normalize';
import { ALIASES, TECH_TERMS } from './dictionary';

/** Separators treated as interchangeable inside a multi-part term ("ci/cd" ≈ "ci-cd" ≈ "ci cd"). */
const FLEX_SEP = '[\\s\\-/_.]*';
const FLEX_CHARS = /^[\s\-/_.]+$/;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// alias → canonical, and canonical → [canonical, ...aliases]
const aliasToCanonical = new Map<string, string>();
const variantsOf = new Map<string, string[]>();
for (const [canonical, aliases] of Object.entries(ALIASES)) {
  const c = normalize(canonical);
  const all = [c, ...aliases.map(normalize)];
  variantsOf.set(c, all);
  for (const a of all) aliasToCanonical.set(a, c);
}

/** Map a term to its canonical form (normalized; alias-resolved). */
export function canonicalTerm(term: string): string {
  const n = normalize(term);
  return aliasToCanonical.get(n) ?? n;
}

/** Every normalized spelling that should match a term. */
export function termVariants(term: string): string[] {
  const c = canonicalTerm(term);
  return variantsOf.get(c) ?? [c];
}

const regexCache = new Map<string, RegExp>();

/**
 * Build a boundary-aware regex for a single normalized spelling.
 * Internal separators are flexible; symbols like `+`, `#`, and leading `.` stay literal.
 * An optional plural suffix (`s` / `es`) is allowed when the term ends in a letter.
 */
function spellingRegex(spelling: string): RegExp {
  const cached = regexCache.get(spelling);
  if (cached) return cached;
  const parts = spelling.split(/([^a-z0-9]+)/).filter((p) => p !== '');
  const body = parts
    .map((p, i) => {
      if (/^[a-z0-9]+$/.test(p)) return escapeRe(p);
      const internal = i > 0 && i < parts.length - 1;
      return internal && FLEX_CHARS.test(p) ? FLEX_SEP : escapeRe(p);
    })
    .join('');
  const plural = /[a-z]$/.test(spelling) ? '(?:e?s)?' : '';
  const re = new RegExp(`(?<![a-z0-9])${body}${plural}(?![a-z0-9])`);
  regexCache.set(spelling, re);
  return re;
}

/** True when `term` (or any alias) appears in already-normalized text. */
export function containsTermNormalized(normalizedText: string, term: string): boolean {
  return termVariants(term).some((v) => v !== '' && spellingRegex(v).test(normalizedText));
}

/** True when `term` (or any alias) appears in `text`. */
export function containsTerm(text: string, term: string): boolean {
  return containsTermNormalized(normalize(text), term);
}

/**
 * Canonical terms from `vocabulary` (defaults to the tech dictionary) found in `text`.
 */
export function findTerms(text: string, vocabulary: readonly string[] = TECH_TERMS): string[] {
  const n = normalize(text);
  const found = new Set<string>();
  for (const term of vocabulary) {
    if (containsTermNormalized(n, term)) found.add(canonicalTerm(term));
  }
  return [...found];
}

/**
 * Deterministic keyword matching against the working resume and confirmations (design §6.2).
 */
export function matchKeywords<K extends { term: string; required: boolean }>(
  keywords: readonly K[],
  texts: readonly string[],
): (K & { matched: boolean })[] {
  const haystack = texts.map(normalize).join('\n');
  return keywords.map((k) => ({ ...k, matched: containsTermNormalized(haystack, k.term) }));
}
