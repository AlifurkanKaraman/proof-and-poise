/**
 * Resume export model (design §7.7, Req 7.10). Every piece of output text is an `ExportRun`
 * that points back at the exact slice of the input it came from, so "nothing invented,
 * nothing dropped" is machine-checkable (`verifyExportLayout`).
 */
export type ExportStyle = 'original' | 'jake';

export type ExportSectionKind =
  | 'summary'
  | 'education'
  | 'experience'
  | 'projects'
  | 'skills'
  | 'certifications'
  | 'awards'
  | 'leadership'
  | 'volunteer'
  | 'other';

/** Offsets into `lines[line]`; `text === lines[line].slice(start, end)`. */
export interface ExportSource {
  line: number;
  start: number;
  end: number;
}

/** `source` is null only for headings whose text is in `EXPORT_HEADINGS`. */
export interface ExportRun {
  text: string;
  source: ExportSource | null;
}

export interface ExportEntry {
  /** First non-bullet line of the entry (date split off). */
  title: ExportRun;
  titleDates: ExportRun | null;
  /** Second non-bullet line before any bullet. */
  subtitle: ExportRun | null;
  subtitleDates: ExportRun | null;
  /** Bullet text with the marker stripped. */
  bullets: ExportRun[];
}

export type ExportItem =
  | { type: 'entry'; entry: ExportEntry }
  | { type: 'bullet'; run: ExportRun }
  | { type: 'paragraph'; run: ExportRun }
  /** "Label: items"; `label` keeps its colon ("Languages:"). */
  | { type: 'skill'; label: ExportRun; items: ExportRun };

export interface ExportSection {
  kind: ExportSectionKind;
  /** The candidate's own heading line; null for an implicit section. */
  heading: ExportRun | null;
  items: ExportItem[];
}

export type LineRole = 'blank' | 'name' | 'header' | 'heading' | 'bullet' | 'text';

export interface ExportDocument {
  /** `text.split('\n')`. */
  lines: string[];
  /** One role per line. */
  roles: LineRole[];
  /** The first non-blank line. */
  name: ExportRun | null;
  /** Header lines split on `|`, `•` and `·`. */
  contact: ExportRun[];
  /** The same runs grouped by header line (the original style keeps one block per line). */
  contactLines: ExportRun[][];
  /** Sections in original order. */
  sections: ExportSection[];
}

export type ExportBlock =
  | { kind: 'name'; run: ExportRun }
  /** Renderers join items with `' | '`. */
  | { kind: 'contact'; items: ExportRun[] }
  | { kind: 'heading'; run: ExportRun }
  | {
      kind: 'entry';
      title: ExportRun;
      right: ExportRun | null;
      subtitle: ExportRun | null;
      subtitleRight: ExportRun | null;
    }
  | { kind: 'bullet'; run: ExportRun }
  | { kind: 'paragraph'; run: ExportRun }
  | { kind: 'skill'; label: ExportRun; items: ExportRun };

export interface ExportLayout {
  style: ExportStyle;
  name: string | null;
  blocks: ExportBlock[];
}
