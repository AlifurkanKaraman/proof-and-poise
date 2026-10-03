/**
 * Style-specific ordered blocks, consumed by the DOCX renderer, the PDF renderer and the
 * HTML preview alike (design §7.7). Layout only reorders and groups runs; the only text it
 * may add is a canonical heading from `EXPORT_HEADINGS`.
 */
import { bulletStart, makeRun, parseResumeForExport, trimRange } from './parse';
import type { EXPORT_HEADINGS } from './parse';
import type {
  ExportBlock,
  ExportDocument,
  ExportLayout,
  ExportRun,
  ExportSection,
  ExportSectionKind,
  ExportStyle,
} from './types';

type Heading = (typeof EXPORT_HEADINGS)[number];

/** Canonical Jake's Resume heading per known kind. */
const CANONICAL: Record<Exclude<ExportSectionKind, 'other'>, Heading> = {
  summary: 'Summary',
  education: 'Education',
  experience: 'Experience',
  projects: 'Projects',
  skills: 'Technical Skills',
  certifications: 'Certifications',
  awards: 'Awards',
  leadership: 'Leadership',
  volunteer: 'Volunteer Experience',
};

/**
 * Jake's Resume order: text before the first heading stays under the header, then Summary,
 * Education, Experience, Projects, Technical Skills, then every other section as it was.
 */
function jakeSlot(section: ExportSection): number {
  if (section.kind === 'other' && section.heading === null) return 0;
  if (section.kind === 'summary') return 1;
  const order: ExportSectionKind[] = ['education', 'experience', 'projects', 'skills'];
  const i = order.indexOf(section.kind);
  return i < 0 ? 6 : 2 + i;
}

function originalLayout(doc: ExportDocument): ExportLayout {
  const blocks: ExportBlock[] = [];
  let header = 0;
  doc.lines.forEach((line, i) => {
    const role = doc.roles[i];
    if (role === 'blank' || role === undefined) return;
    if (role === 'name' && doc.name) {
      blocks.push({ kind: 'name', run: doc.name });
      return;
    }
    if (role === 'header') {
      blocks.push({ kind: 'contact', items: doc.contactLines[header++] ?? [] });
      return;
    }
    const start = role === 'bullet' ? (bulletStart(line) ?? 0) : 0;
    const [s, e] = trimRange(line, start, line.length);
    const run = makeRun(line, i, s, e);
    blocks.push({
      kind: role === 'heading' ? 'heading' : role === 'bullet' ? 'bullet' : 'paragraph',
      run,
    });
  });
  return { style: 'original', name: doc.name?.text ?? null, blocks };
}

function sectionBlocks(section: ExportSection): ExportBlock[] {
  const blocks: ExportBlock[] = [];
  if (section.kind !== 'other') {
    const heading: ExportRun = { text: CANONICAL[section.kind], source: null };
    blocks.push({ kind: 'heading', run: heading });
  } else if (section.heading) {
    blocks.push({ kind: 'heading', run: section.heading });
  }
  for (const item of section.items) {
    if (item.type === 'entry') {
      const { title, titleDates, subtitle, subtitleDates, bullets } = item.entry;
      blocks.push({
        kind: 'entry',
        title,
        right: titleDates ?? subtitleDates,
        subtitle,
        subtitleRight: titleDates ? subtitleDates : null,
      });
      for (const run of bullets) blocks.push({ kind: 'bullet', run });
    } else if (item.type === 'skill') {
      blocks.push({ kind: 'skill', label: item.label, items: item.items });
    } else {
      blocks.push({ kind: item.type, run: item.run });
    }
  }
  return blocks;
}

function jakeLayout(doc: ExportDocument): ExportLayout {
  const blocks: ExportBlock[] = [];
  if (doc.name) blocks.push({ kind: 'name', run: doc.name });
  if (doc.contact.length > 0) blocks.push({ kind: 'contact', items: doc.contact });
  const ordered = doc.sections
    .map((section, i) => ({ section, i }))
    .sort((a, b) => jakeSlot(a.section) - jakeSlot(b.section) || a.i - b.i);
  for (const { section } of ordered) blocks.push(...sectionBlocks(section));
  return { style: 'jake', name: doc.name?.text ?? null, blocks };
}

export function buildExportLayout(doc: ExportDocument, style: ExportStyle): ExportLayout {
  return style === 'jake' ? jakeLayout(doc) : originalLayout(doc);
}

/** Parse and lay out in one step. */
export function exportLayoutFor(text: string, style: ExportStyle): ExportLayout {
  return buildExportLayout(parseResumeForExport(text), style);
}

/** Every run of a block, in reading order. */
export function blockRuns(block: ExportBlock): ExportRun[] {
  switch (block.kind) {
    case 'contact':
      return block.items;
    case 'entry':
      return [block.title, block.right, block.subtitle, block.subtitleRight].filter(
        (r): r is ExportRun => r !== null,
      );
    case 'skill':
      return [block.label, block.items];
    default:
      return [block.run];
  }
}

/** Every run in the layout, in document order. */
export function layoutRuns(layout: ExportLayout): ExportRun[] {
  return layout.blocks.flatMap(blockRuns);
}
