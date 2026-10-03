/**
 * Parse tailored resume text into a structured document for export (design §7.7, Req 7.10).
 * Pure string heuristics; no model call. Lines that don't fit a pattern stay in their
 * section, in order, as plain paragraphs, so nothing is dropped.
 */
import { LIMITS } from '../limits';
import type {
  ExportDocument,
  ExportEntry,
  ExportItem,
  ExportRun,
  ExportSection,
  ExportSectionKind,
  LineRole,
} from './types';

/** The only text an export may add: canonical section headings (Jake's Resume style). */
export const EXPORT_HEADINGS = [
  'Summary',
  'Education',
  'Experience',
  'Projects',
  'Technical Skills',
  'Certifications',
  'Awards',
  'Leadership',
  'Volunteer Experience',
] as const;

const KNOWN_HEADINGS: readonly [RegExp, ExportSectionKind][] = [
  [/^(?:summary|profile|objective|professional summary|career summary)$/i, 'summary'],
  [/^education$/i, 'education'],
  [
    /^(?:experience|work experience|professional experience|relevant experience|employment|employment history)$/i,
    'experience',
  ],
  [/^(?:projects?|personal projects|selected projects|academic projects)$/i, 'projects'],
  // The optional tail (group 1) is capped at three words and must be Title Case or ALL CAPS
  // (checked in detectHeading), so a wrapped sentence like "Skills and experience in" isn't one.
  [/^(?:technical\s+|core\s+|key\s+)?skills(?:\s*(?:&|and)\s*(\S+(?:\s+\S+){0,2}))?$/i, 'skills'],
  [/^(?:certifications?|licenses\s*(?:&|and)\s*certifications)$/i, 'certifications'],
  [/^(?:awards|honors|honors\s*(?:&|and)\s*awards|awards\s*(?:&|and)\s*honors)$/i, 'awards'],
  [/^(?:leadership|leadership experience)$/i, 'leadership'],
  [/^(?:volunteer(?:ing)?|volunteer experience)$/i, 'volunteer'],
];

/** Kinds whose lines are grouped into title / subtitle / bullets entries. */
const ENTRY_KINDS: ReadonlySet<ExportSectionKind> = new Set([
  'education',
  'experience',
  'projects',
  'leadership',
  'volunteer',
]);

/**
 * Bullet glyphs that PDF extraction and word processors produce; the same set as
 * grounding/normalize.ts BULLETS (●, ◦, ■, ✓, U+F0B7, ...). Several have no glyph in the
 * PDF font, so they're treated as markers and redrawn as "•".
 */
const BULLET_GLYPHS =
  '\u2022\u2023\u2043\u2219\u25AA\u25AB\u25CF\u25E6\u25A0\u25A1\u25C6\u25C7\u2756\u27A2\u27A4\u2713\u2714\u00B7\uF0B7\uF0A7';
// ASCII-like markers need a following space ("-5%" isn't a bullet); symbol glyphs don't.
const BULLET = new RegExp(`^\\s*(?:[-*–]\\s+|[${BULLET_GLYPHS}]\\s*)`);
/** Characters that carry no content: whitespace and separators (truthfulness rule 3). */
export const EXPORT_SEPARATORS = new RegExp(`[\\s,|*–—${BULLET_GLYPHS}-]+`, 'g');
const CONTACT_SPLIT = new RegExp(`[|${BULLET_GLYPHS}]`);

const MONTH =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const POINT = `(?:${MONTH}\\s+)?(?:19|20)\\d{2}`;
const RANGE = `${POINT}\\s*(?:–|—|-|to)\\s*(?:${POINT}|present|current|now)`;
const SINGLE = `(?:(?:expected|graduated)\\s+)?${POINT}`;
// A range may follow any separator or a space; a lone year needs a clear separator so
// "Led a team of 5 in 2023" stays one line. No regex `d` flag (React Native safe).
const TRAILING_RANGE = new RegExp(`[,|·–—\\s](${RANGE})\\s*$`, 'i');
const TRAILING_SINGLE = new RegExp(`(?:[,|·]\\s*|\\t\\s*|\\s{2,})(${SINGLE})\\s*$`, 'i');
const TRAILING_SEPARATORS = /[\s,|·–—-]+$/;

const isSpace = (c: string | undefined) => c !== undefined && /\s/.test(c);

/** `[start, end)` narrowed to exclude leading and trailing whitespace. */
export function trimRange(line: string, start: number, end: number): [number, number] {
  let s = start;
  let e = end;
  while (s < e && isSpace(line[s])) s++;
  while (e > s && isSpace(line[e - 1])) e--;
  return [s, e];
}

export function makeRun(line: string, index: number, start: number, end: number): ExportRun {
  return { text: line.slice(start, end), source: { line: index, start, end } };
}

/** True when the line has no content characters (blank or separators only, e.g. `---`). */
export function isContentless(line: string): boolean {
  return line.replace(EXPORT_SEPARATORS, '') === '';
}

/** Offset where a bullet's text starts, or null when the line isn't a bullet. */
export function bulletStart(line: string): number | null {
  const m = BULLET.exec(line);
  return m ? m[0].length : null;
}

/**
 * Section kind for a heading line, `'unknown'` for an all-caps heading we don't recognise,
 * or null when the line isn't a heading.
 */
export function detectHeading(line: string): ExportSectionKind | 'unknown' | null {
  const core = line.trim().replace(/\s*:$/, '');
  if (core === '' || bulletStart(line) !== null || !headingShaped(core)) return null;
  for (const [re, kind] of KNOWN_HEADINGS) {
    const m = re.exec(core);
    if (m && (m[1] === undefined || m[1].split(/\s+/).every(isHeadingWord))) return kind;
  }
  if (core === core.toUpperCase() && !/[\d@|,]/.test(core)) return 'unknown';
  return null;
}

const isUpper = (c: string) => c !== c.toLowerCase() && c === c.toUpperCase();
const firstLetter = (s: string) => [...s].find((c) => c.toLowerCase() !== c.toUpperCase());

/**
 * Every heading, known or not, is short and starts with an uppercase letter, so a lowercase
 * line wrapped out of a sentence ("leadership", "experience building ...") stays content.
 */
function headingShaped(core: string): boolean {
  const first = firstLetter(core);
  return (
    first !== undefined &&
    isUpper(first) &&
    core.length <= LIMITS.export.headingMaxChars &&
    core.split(/\s+/).length <= LIMITS.export.headingMaxWords
  );
}

/** A word in a heading tail: a connector, or one starting with an uppercase letter. */
function isHeadingWord(word: string): boolean {
  if (/^(?:&|and|of)$/i.test(word)) return true;
  const first = firstLetter(word);
  return first !== undefined && isUpper(first);
}

/**
 * Split a trailing date or date range off `line[start, end)`. Both ranges are trimmed; the
 * separator before the date (", " or " | ") is dropped. `dates` is null when there is no
 * trailing date or nothing would be left before it.
 */
export function splitTrailingDates(
  line: string,
  start = 0,
  end = line.length,
): { main: [number, number]; dates: [number, number] | null } {
  const [s, e] = trimRange(line, start, end);
  const segment = line.slice(s, e);
  const m = TRAILING_RANGE.exec(segment) ?? TRAILING_SINGLE.exec(segment);
  const date = m?.[1];
  if (date !== undefined) {
    const dateStart = s + segment.lastIndexOf(date);
    const mainEnd = s + line.slice(s, dateStart).replace(TRAILING_SEPARATORS, '').length;
    if (mainEnd > s) return { main: [s, mainEnd], dates: [dateStart, dateStart + date.length] };
  }
  return { main: [s, e], dates: null };
}

function datedRuns(line: string, index: number, start: number) {
  const { main, dates } = splitTrailingDates(line, start);
  return {
    main: makeRun(line, index, main[0], main[1]),
    dates: dates ? makeRun(line, index, dates[0], dates[1]) : null,
  };
}

/** Contact runs for one header line, split on `|`, `•` and `·`. */
function contactRuns(line: string, index: number): ExportRun[] {
  const runs: ExportRun[] = [];
  let from = 0;
  for (let i = 0; i <= line.length; i++) {
    if (i === line.length || CONTACT_SPLIT.test(line[i] ?? '')) {
      const [s, e] = trimRange(line, from, i);
      if (s < e && !isContentless(line.slice(s, e))) runs.push(makeRun(line, index, s, e));
      from = i + 1;
    }
  }
  return runs;
}

// `(?!//)`: "https://..." isn't a "https:" label (the renderers would put a space in the URL).
const SKILL_LINE = new RegExp(`^([^:]{1,${LIMITS.export.skillLabelMaxChars}}):(?!//)\\s*(\\S.*)$`);

/** "Label: items" inside `line[start, end)`, or null. */
function skillRuns(line: string, index: number, start: number) {
  const [s, e] = trimRange(line, start, line.length);
  const m = SKILL_LINE.exec(line.slice(s, e));
  if (!m || m[1] === undefined || m[2] === undefined) return null;
  // The label keeps its colon, so the line stays verbatim.
  const [ls, le] = trimRange(line, s, s + m[1].length + 1);
  if (ls === le || isContentless(m[1])) return null;
  const itemsStart = e - m[2].length;
  return { label: makeRun(line, index, ls, le), items: makeRun(line, index, itemsStart, e) };
}

function buildItems(kind: ExportSectionKind, lines: string[], indexes: number[]): ExportItem[] {
  const items: ExportItem[] = [];
  let entry: ExportEntry | null = null;
  for (const i of indexes) {
    const line = lines[i] ?? '';
    if (isContentless(line)) {
      entry = null; // a blank line ends the current entry
      continue;
    }
    const bullet = bulletStart(line);
    if (kind === 'skills') {
      const skill = skillRuns(line, i, bullet ?? 0);
      if (skill) {
        items.push({ type: 'skill', ...skill });
        continue;
      }
    }
    if (bullet !== null) {
      const [s, e] = trimRange(line, bullet, line.length);
      const run = makeRun(line, i, s, e);
      if (entry) entry.bullets.push(run);
      else items.push({ type: 'bullet', run });
      continue;
    }
    if (ENTRY_KINDS.has(kind)) {
      const { main, dates } = datedRuns(line, i, 0);
      if (!entry || entry.bullets.length > 0 || entry.subtitle !== null) {
        entry = {
          title: main,
          titleDates: dates,
          subtitle: null,
          subtitleDates: null,
          bullets: [],
        };
        items.push({ type: 'entry', entry });
      } else {
        entry.subtitle = main;
        entry.subtitleDates = dates;
      }
      continue;
    }
    const [s, e] = trimRange(line, 0, line.length);
    items.push({ type: 'paragraph', run: makeRun(line, i, s, e) });
  }
  return items;
}

export function parseResumeForExport(text: string): ExportDocument {
  const lines = text.split('\n');
  const roles: LineRole[] = lines.map(() => 'blank');
  const doc: ExportDocument = {
    lines,
    roles,
    name: null,
    contact: [],
    contactLines: [],
    sections: [],
  };

  const nameIndex = lines.findIndex((l) => !isContentless(l));
  if (nameIndex < 0) return doc;
  const nameLine = lines[nameIndex] ?? '';
  const [ns, ne] = trimRange(nameLine, 0, nameLine.length);
  doc.name = makeRun(nameLine, nameIndex, ns, ne);
  roles[nameIndex] = 'name';

  const headingAt = (i: number) => detectHeading(lines[i] ?? '');
  let firstHeading = -1;
  for (let i = nameIndex + 1; i < lines.length; i++) {
    if (!isContentless(lines[i] ?? '') && headingAt(i) !== null) {
      firstHeading = i;
      break;
    }
  }
  const bodyStart = firstHeading < 0 ? lines.length : firstHeading;

  // Header: contact lines right after the name (no bullets, capped). Without any heading
  // it also ends at the first blank line.
  let i = nameIndex + 1;
  let headerLines = 0;
  for (; i < bodyStart && headerLines < LIMITS.export.maxHeaderLines; i++) {
    const line = lines[i] ?? '';
    if (isContentless(line)) {
      if (firstHeading < 0) break;
      continue;
    }
    if (bulletStart(line) !== null) break;
    roles[i] = 'header';
    headerLines++;
    const runs = contactRuns(line, i);
    doc.contact.push(...runs);
    doc.contactLines.push(runs);
  }

  const classify = (idx: number) => {
    const line = lines[idx] ?? '';
    if (!isContentless(line)) roles[idx] = bulletStart(line) !== null ? 'bullet' : 'text';
  };

  // Lines between the header and the first heading form an implicit section.
  const leading: number[] = [];
  for (; i < bodyStart; i++) {
    classify(i);
    leading.push(i);
  }
  if (leading.some((idx) => roles[idx] !== 'blank')) {
    doc.sections.push({ kind: 'other', heading: null, items: buildItems('other', lines, leading) });
  }

  let current: { section: ExportSection; indexes: number[] } | null = null;
  const flush = () => {
    if (current) current.section.items = buildItems(current.section.kind, lines, current.indexes);
  };
  for (let idx = bodyStart; idx < lines.length; idx++) {
    const line = lines[idx] ?? '';
    const heading = isContentless(line) ? null : headingAt(idx);
    if (heading !== null) {
      flush();
      roles[idx] = 'heading';
      const [s, e] = trimRange(line, 0, line.length);
      const section: ExportSection = {
        kind: heading === 'unknown' ? 'other' : heading,
        heading: makeRun(line, idx, s, e),
        items: [],
      };
      doc.sections.push(section);
      current = { section, indexes: [] };
      continue;
    }
    classify(idx);
    current?.indexes.push(idx);
  }
  flush();
  return doc;
}
