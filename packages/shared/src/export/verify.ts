/**
 * Truthfulness check for an export layout (design §7.7, Req 7.10). Returns a list of
 * problems; `[]` means every content line appears exactly once in its original wording and
 * the only added text is canonical headings. The web panel refuses to export otherwise.
 */
import { LIMITS } from '../limits';
import { blockRuns } from './layout';
import { EXPORT_HEADINGS, EXPORT_SEPARATORS, parseResumeForExport } from './parse';
import type { ExportLayout, ExportSource } from './types';

const strip = (s: string) => s.replace(EXPORT_SEPARATORS, '');
const HEADINGS: ReadonlySet<string> = new Set(EXPORT_HEADINGS);

// Rule 4 doesn't trust the parser's roles alone: a line may be replaced by a canonical
// heading only if it also looks like a section heading on its own terms (short, starts with
// an uppercase letter, words and "&" only, and names a known section).
const HEADING_LIKE = /^[A-Z][A-Za-z&]*(?:\s+[A-Za-z&]+)*\s*:?$/;
const SECTION_WORD =
  /summary|profile|objective|education|experience|employment|project|skill|certification|license|award|honor|leadership|volunteer/i;

function replaceableHeading(line: string): boolean {
  const core = line.trim();
  return (
    HEADING_LIKE.test(core) &&
    SECTION_WORD.test(core) &&
    core.length <= LIMITS.export.headingMaxChars &&
    core.split(/\s+/).length <= LIMITS.export.headingMaxWords
  );
}

export function verifyExportLayout(text: string, layout: ExportLayout): string[] {
  const problems: string[] = [];
  const { lines, roles } = parseResumeForExport(text);
  const byLine = new Map<number, ExportSource[]>();
  let lastLine = -1;
  let unsourcedHeadings = 0;

  for (const block of layout.blocks) {
    // Rule 6 scope: jake reorders whole sections, so order restarts at each heading.
    if (layout.style === 'jake' && block.kind === 'heading') lastLine = -1;
    for (const run of blockRuns(block)) {
      const src = run.source;
      if (src === null) {
        // Rule 5: only canonical headings may be unsourced.
        if (block.kind !== 'heading' || !HEADINGS.has(run.text)) {
          problems.push(`added text "${run.text}" in a ${block.kind} block`);
        } else {
          unsourcedHeadings++;
        }
        continue;
      }
      // Rule 1: exact slice, non-empty, trimmed.
      const line = lines[src.line];
      if (line === undefined || line.slice(src.start, src.end) !== run.text) {
        problems.push(`run "${run.text}" doesn't match line ${src.line}`);
        continue;
      }
      if (run.text === '' || run.text !== run.text.trim()) {
        problems.push(`run on line ${src.line} is empty or untrimmed`);
      }
      // Rule 6: reading order (original: whole document; jake: within each section).
      if (src.line < lastLine) problems.push(`line ${src.line} is out of order`);
      lastLine = Math.max(lastLine, src.line);
      byLine.set(src.line, [...(byLine.get(src.line) ?? []), src]);
    }
  }

  let replaced = 0;
  lines.forEach((line, i) => {
    const runs = (byLine.get(i) ?? []).sort((a, b) => a.start - b.start);
    // Rule 2: each slice once, no overlaps.
    for (let k = 1; k < runs.length; k++) {
      if ((runs[k]?.start ?? 0) < (runs[k - 1]?.end ?? 0)) problems.push(`line ${i} repeats text`);
    }
    const role = roles[i];
    if (role === 'heading') {
      // Rule 4: a heading is kept as is, or (jake) replaced by a canonical heading, and only
      // if the line really looks like a section heading.
      const dropped = runs.length === 0 && layout.style === 'jake' && replaceableHeading(line);
      if (dropped) replaced++;
      const ok =
        dropped || (runs.length === 1 && line.slice(runs[0]?.start, runs[0]?.end) === line.trim());
      if (!ok) problems.push(`heading on line ${i} was changed`);
      return;
    }
    // Rule 3: every content character appears once, in order.
    const joined = runs.map((r) => line.slice(r.start, r.end)).join('');
    if (strip(joined) !== strip(line)) problems.push(`line ${i} lost or changed text`);
  });
  if (replaced > unsourcedHeadings) problems.push('a heading line vanished without a replacement');

  return problems;
}
