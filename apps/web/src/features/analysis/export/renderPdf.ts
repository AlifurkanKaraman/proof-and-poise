/**
 * PDF renderer for an export layout (design §7.7). Loaded with `import()` only on download.
 * Embeds Crimson Text (SIL OFL 1.1) because the standard PDF fonts can't encode ş, ğ or ı,
 * and draws real text (selectable, searchable), never images.
 */
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { ExportBlock, ExportLayout } from '@proof-and-poise/shared';
import boldUrl from '../../../assets/fonts/crimson-text/CrimsonText-Bold.ttf?url';
import italicUrl from '../../../assets/fonts/crimson-text/CrimsonText-Italic.ttf?url';
import regularUrl from '../../../assets/fonts/crimson-text/CrimsonText-Regular.ttf?url';

export interface PdfFonts {
  regular: Uint8Array;
  bold: Uint8Array;
  italic: Uint8Array;
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font request failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

/** The three font files, fetched from this site on demand. */
export async function loadPdfFonts(): Promise<PdfFonts> {
  const [regular, bold, italic] = await Promise.all(
    [regularUrl, boldUrl, italicUrl].map(fetchBytes),
  );
  return { regular: regular!, bold: bold!, italic: italic! };
}

// Points: US Letter with 0.5 in margins.
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;
const WIDTH = PAGE_W - 2 * MARGIN;
const LEADING = 1.25;
const BULLET_INDENT = 14;
const INK = rgb(0, 0, 0);

const SIZES = {
  jake: { name: 22, contact: 9.5, heading: 11, body: 10 },
  original: { name: 16, contact: 10, heading: 11, body: 10.5 },
} as const;

/** Tabs and runs of spaces print as one space (whitespace normalisation only). */
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Greedy word wrap; `first` is the width available on the first line. */
function wrap(text: string, font: PDFFont, size: number, first: number, rest = first): string[] {
  const lines: string[] = [];
  let line = '';
  const max = () => (lines.length === 0 ? first : rest);
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= max();
  for (const word of clean(text).split(' ')) {
    const next = line === '' ? word : `${line} ${word}`;
    if (line !== '' && !fits(next)) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
    // Hard-break a token wider than the line (a long URL) so it stays inside the margin.
    while (!fits(line)) {
      const chars = [...line];
      let n = chars.length - 1;
      while (n > 1 && !fits(chars.slice(0, n).join(''))) n--;
      if (n < 1) break;
      lines.push(chars.slice(0, n).join(''));
      line = chars.slice(n).join('');
    }
  }
  lines.push(line);
  return lines;
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

class Writer {
  private page: PDFPage;
  private y = PAGE_H - MARGIN;

  constructor(
    private readonly pdf: PDFDocument,
    readonly fonts: Fonts,
  ) {
    this.page = pdf.addPage([PAGE_W, PAGE_H]);
  }

  /** Start a new page unless `height` points still fit. */
  need(height: number) {
    if (this.y - height < MARGIN) {
      this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
      this.y = PAGE_H - MARGIN;
    }
  }

  gap(points: number) {
    this.y -= points;
  }

  /** Move to the next baseline for text of `size` and return it. */
  baseline(size: number): number {
    this.need(size * LEADING);
    this.y -= size * LEADING;
    return this.y + size * (LEADING - 1);
  }

  text(text: string, x: number, y: number, font: PDFFont, size: number) {
    if (text !== '') this.page.drawText(text, { x, y, size, font, color: INK });
  }

  right(text: string, y: number, font: PDFFont, size: number) {
    const t = clean(text);
    this.text(t, PAGE_W - MARGIN - font.widthOfTextAtSize(t, size), y, font, size);
  }

  rule() {
    this.page.drawLine({
      start: { x: MARGIN, y: this.y - 2 },
      end: { x: PAGE_W - MARGIN, y: this.y - 2 },
      thickness: 0.5,
      color: INK,
    });
    this.y -= 4;
  }

  /** Wrapped paragraph, left-aligned or centered. */
  para(text: string, font: PDFFont, size: number, opts: { center?: boolean; x?: number } = {}) {
    const x = opts.x ?? MARGIN;
    for (const line of wrap(text, font, size, PAGE_W - MARGIN - x)) {
      const y = this.baseline(size);
      const lx = opts.center ? (PAGE_W - font.widthOfTextAtSize(line, size)) / 2 : x;
      this.text(line, lx, y, font, size);
    }
  }

  /** Left text (wrapped to leave room) with optional right-aligned text on its first line. */
  row(left: string, right: string | null, font: PDFFont, size: number) {
    const rightWidth = right ? font.widthOfTextAtSize(clean(right), size) + 12 : 0;
    wrap(left, font, size, WIDTH - rightWidth, WIDTH).forEach((line, i) => {
      const y = this.baseline(size);
      this.text(line, MARGIN, y, font, size);
      if (i === 0 && right) this.right(right, y, font, size);
    });
  }
}

function draw(w: Writer, block: ExportBlock, layout: ExportLayout) {
  const jake = layout.style === 'jake';
  const size = SIZES[layout.style];
  const { regular, bold, italic } = w.fonts;
  switch (block.kind) {
    case 'name':
      w.para(block.run.text, bold, size.name, { center: jake });
      w.gap(2);
      return;
    case 'contact':
      w.para(block.items.map((r) => clean(r.text)).join(' | '), regular, size.contact, {
        center: jake,
      });
      return;
    case 'heading':
      w.gap(8);
      w.need(size.heading * LEADING * 3); // keep the heading with its first lines
      w.para(jake ? block.run.text.toUpperCase() : block.run.text, bold, size.heading);
      if (jake) w.rule();
      else w.gap(2);
      return;
    case 'entry':
      w.gap(3);
      w.need(size.body * LEADING * 2);
      w.row(block.title.text, block.right?.text ?? null, bold, size.body);
      if (block.subtitle || block.subtitleRight) {
        w.row(block.subtitle?.text ?? '', block.subtitleRight?.text ?? null, italic, size.body);
      }
      return;
    case 'bullet': {
      const lines = wrap(block.run.text, regular, size.body, WIDTH - BULLET_INDENT);
      lines.forEach((line, i) => {
        const y = w.baseline(size.body);
        if (i === 0) w.text('•', MARGIN + 3, y, regular, size.body);
        w.text(line, MARGIN + BULLET_INDENT, y, regular, size.body);
      });
      return;
    }
    case 'skill': {
      const label = clean(block.label.text);
      const indent = bold.widthOfTextAtSize(`${label} `, size.body);
      wrap(block.items.text, regular, size.body, WIDTH - indent, WIDTH).forEach((line, i) => {
        const y = w.baseline(size.body);
        if (i === 0) w.text(label, MARGIN, y, bold, size.body);
        w.text(line, i === 0 ? MARGIN + indent : MARGIN, y, regular, size.body);
      });
      return;
    }
    case 'paragraph':
      w.para(block.run.text, regular, size.body);
      w.gap(1);
      return;
  }
}

export async function renderPdf(layout: ExportLayout, fontBytes: PdfFonts): Promise<Blob> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // No subsetting: pdf-lib's subsetter can drop glyphs, and correctness beats file size.
  // No ligatures: an "ffi" glyph copies or extracts as a stray character, not "ffi".
  const options = { subset: false, features: { liga: false, clig: false, dlig: false } };
  const fonts: Fonts = {
    regular: await pdf.embedFont(fontBytes.regular, options),
    bold: await pdf.embedFont(fontBytes.bold, options),
    italic: await pdf.embedFont(fontBytes.italic, options),
  };
  pdf.setTitle(layout.name ?? 'Resume');
  pdf.setCreator('Proof & Poise');
  pdf.setProducer('Proof & Poise');
  const writer = new Writer(pdf, fonts);
  for (const block of layout.blocks) draw(writer, block, layout);
  const bytes = await pdf.save();
  return new Blob([bytes.slice().buffer], { type: 'application/pdf' });
}
