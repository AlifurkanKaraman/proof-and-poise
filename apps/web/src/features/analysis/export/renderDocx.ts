/**
 * DOCX renderer for an export layout (design §7.7). Loaded with `import()` only when the
 * candidate downloads, so `docx` stays out of the main bundle. Prints run text as is; the only
 * additions are separators (" | ", a tab before dates, list bullets).
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
} from 'docx';
import type { ExportBlock, ExportLayout, ExportRun } from '@proof-and-poise/shared';

/** Tabs and runs of spaces print as one space (whitespace normalisation only). */
const t = (run: ExportRun) => run.text.replace(/\s+/g, ' ').trim();

// Twips (1/1440 in): US Letter with 0.5 in margins; the right tab stop sits on the margin.
// Word, Google Docs and LibreOffice honour it; macOS Quick Look/TextEdit ignore tab stops.
const PAGE = { width: 12240, height: 15840, margin: 720 };
const RIGHT_TAB = PAGE.width - 2 * PAGE.margin;
const FONT = 'Times New Roman';

/** Half-point sizes per style. */
const SIZES = {
  jake: { name: 44, contact: 19, heading: 22, body: 20 },
  original: { name: 32, contact: 20, heading: 22, body: 21 },
} as const;

function paragraphFor(block: ExportBlock, layout: ExportLayout): Paragraph {
  const jake = layout.style === 'jake';
  const size = SIZES[layout.style];
  const tabStops = [{ type: TabStopType.RIGHT, position: RIGHT_TAB }];
  switch (block.kind) {
    case 'name':
      return new Paragraph({
        alignment: jake ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: 40 },
        children: [new TextRun({ text: t(block.run), bold: true, size: size.name })],
      });
    case 'contact':
      return new Paragraph({
        alignment: jake ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: jake ? 80 : 0 },
        children: [new TextRun({ text: block.items.map(t).join(' | '), size: size.contact })],
      });
    case 'heading':
      return new Paragraph({
        spacing: { before: 160, after: 60 },
        keepNext: true,
        ...(jake && {
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: 'auto' } },
        }),
        children: [
          new TextRun({ text: t(block.run), bold: true, allCaps: jake, size: size.heading }),
        ],
      });
    case 'entry': {
      const rows: TextRun[] = [new TextRun({ text: t(block.title), bold: true, size: size.body })];
      if (block.right) {
        rows.push(new TextRun({ children: [new Tab(), t(block.right)], size: size.body }));
      }
      if (block.subtitle || block.subtitleRight) {
        rows.push(
          new TextRun({
            break: 1,
            text: block.subtitle ? t(block.subtitle) : '',
            italics: true,
            size: size.body,
          }),
        );
        if (block.subtitleRight) {
          rows.push(
            new TextRun({
              children: [new Tab(), t(block.subtitleRight)],
              italics: true,
              size: size.body,
            }),
          );
        }
      }
      return new Paragraph({ tabStops, spacing: { before: 80 }, keepNext: true, children: rows });
    }
    case 'bullet':
      return new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: t(block.run), size: size.body })],
      });
    case 'skill':
      return new Paragraph({
        children: [
          new TextRun({ text: t(block.label), bold: true, size: size.body }),
          new TextRun({ text: ` ${t(block.items)}`, size: size.body }),
        ],
      });
    case 'paragraph':
      return new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: t(block.run), size: size.body })],
      });
  }
}

export async function renderDocx(layout: ExportLayout): Promise<Blob> {
  const doc = new Document({
    creator: 'Proof & Poise',
    title: layout.name ?? 'Resume',
    styles: { default: { document: { run: { font: FONT } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: {
              top: PAGE.margin,
              right: PAGE.margin,
              bottom: PAGE.margin,
              left: PAGE.margin,
            },
          },
        },
        children: layout.blocks.map((b) => paragraphFor(b, layout)),
      },
    ],
  });
  return Packer.toBlob(doc);
}
