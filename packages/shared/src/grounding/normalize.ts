/**
 * normalize.ts
 * Text normalization for grounding verification.
 * Ensures consistent matching across quotes and sources.
 */

/**
 * Normalize text for grounding comparison:
 * - NFKC Unicode normalization
 * - Lowercase
 * - Collapse whitespace
 * - Unify quotes and dashes
 * - Strip common bullet glyphs
 */
export function normalize(text: string): string {
  return (
    text
      .normalize('NFKC')
      .toLowerCase()
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      // Unify quotes
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      // Unify dashes
      .replace(/[–—]/g, '-')
      // Strip bullet glyphs
      .replace(/[•\u2022\u2023\u25E6\u2043\u2219]/g, '')
      .trim()
  );
}

/**
 * Normalize for keyword matching (more aggressive):
 * - Apply standard normalization
 * - Remove punctuation
 * - Handle plurals (simple s/es removal)
 */
export function normalizeKeyword(text: string): string {
  const normalized = normalize(text);
  return (
    normalized
      // Remove punctuation except hyphens in tech terms
      .replace(/[^\w\s-]/g, '')
      // Simplify whitespace again
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Extract potential keywords from text (split on whitespace/punctuation).
 */
export function extractTokens(text: string): string[] {
  const normalized = normalizeKeyword(text);
  return normalized.split(/\s+/).filter((token) => token.length > 0);
}

/**
 * Check if two normalized strings are equivalent for matching.
 */
export function areEquivalent(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}
