const QUOTES_SINGLE = /[\u2018\u2019\u201A\u201B\u2032\u0060\u00B4]/g;
const QUOTES_DOUBLE = /[\u201C\u201D\u201E\u201F\u2033\u00AB\u00BB]/g;
const DASHES = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g;
/** Bullet glyphs commonly produced by PDF extraction and word processors. */
const BULLETS =
  /[\u2022\u2023\u2043\u2219\u25AA\u25AB\u25CF\u25E6\u25A0\u25A1\u25C6\u25C7\u2756\u27A2\u27A4\u2713\u2714\u00B7\uF0B7\uF0A7]/g;
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;

/**
 * Canonical text form for grounding and matching (design §7.4):
 * NFKC, lowercase, unified quotes and dashes, bullet glyphs stripped,
 * whitespace collapsed, trimmed.
 */
export function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .replace(ZERO_WIDTH, '')
    .toLowerCase()
    .replace(QUOTES_SINGLE, "'")
    .replace(QUOTES_DOUBLE, '"')
    .replace(DASHES, '-')
    .replace(BULLETS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
