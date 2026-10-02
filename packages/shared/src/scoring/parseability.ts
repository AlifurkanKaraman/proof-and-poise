import { LIMITS } from '../limits';
import type {
  ParseabilityCheck,
  ParseabilityCheckId,
  ParseabilityResult,
} from '../schemas/evidenceMap';

const POINTS: Record<Exclude<ParseabilityCheckId, 'extractable'>, number> = {
  section_headings: 25,
  contact_info: 15,
  dates: 15,
  line_structure: 15,
  clean_characters: 15,
  word_count: 15,
};

const HEADINGS = [
  /^\s*(?:work\s+|professional\s+)?experience\b/im,
  /^\s*education\b/im,
  /^\s*(?:technical\s+)?skills\b/im,
  /^\s*(?:selected\s+|academic\s+)?projects\b/im,
  /^\s*(?:summary|profile|objective)\b/im,
  /^\s*(?:certifications?|awards|publications|leadership|volunteer(?:ing)?)\b/im,
];

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const PROFILE_URL = /\b(?:linkedin\.com|github\.com)\/\S+/i;
const DATE =
  /\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|(?:19|20)\d{2}\s*[-\u2013\u2014]\s*(?:(?:19|20)\d{2}|present|current))\b/i;
const BULLET_LINE = /^\s*(?:[-*\u2022\u25AA\u25CF\u25E6\u2023\u2043]|\d+[.)])\s+\S/m;

/** Share of characters that are control/private-use/replacement glyphs (garbled extraction). */
function garbledRatio(text: string): number {
  if (text.length === 0) return 1;
  // eslint-disable-next-line no-control-regex
  const bad = text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD\uE000-\uF8FF]/g);
  return (bad?.length ?? 0) / text.length;
}

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

/**
 * Resume Parseability (design §6.2): a deterministic 100-point checklist.
 * Extractable text (≥ 200 chars) is a gate; failing it scores 0.
 * For pasted text (`inputKind: 'text'`), the UI notes that layout wasn't evaluated.
 */
export function parseabilityScore(text: string, inputKind: 'pdf' | 'text'): ParseabilityResult {
  const extractable = text.trim().length >= LIMITS.analysis.minExtractedChars;
  const headingHits = HEADINGS.filter((re) => re.test(text)).length;
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const words = wordCount(text);

  const passed: Record<Exclude<ParseabilityCheckId, 'extractable'>, boolean> = {
    section_headings: headingHits >= 2,
    contact_info: EMAIL.test(text) || PHONE.test(text) || PROFILE_URL.test(text),
    dates: DATE.test(text),
    line_structure: BULLET_LINE.test(text) || lines.length >= 8,
    clean_characters: garbledRatio(text) < 0.02,
    word_count: words >= 300 && words <= 1_200,
  };

  const checks: ParseabilityCheck[] = [
    { id: 'extractable', passed: extractable, points: 0, maxPoints: 0 },
    ...(Object.keys(POINTS) as (keyof typeof POINTS)[]).map((id) => ({
      id,
      passed: extractable && passed[id],
      points: extractable && passed[id] ? POINTS[id] : 0,
      maxPoints: POINTS[id],
    })),
  ];

  const score = checks.reduce((sum, c) => sum + c.points, 0);
  return { score, inputKind, checks };
}

export const PARSEABILITY_DISCLAIMER =
  'Heuristic readability check, not a prediction of any specific applicant tracking system.';
