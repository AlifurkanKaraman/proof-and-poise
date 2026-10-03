// @vitest-environment node
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { DEMO_RESUME_TEXT, exportLayoutFor, type ExportStyle } from '@proof-and-poise/shared';
import { readPdfFonts } from '../../../test/readBytes';
import { renderPdf } from './renderPdf';

const TURKISH = [
  'Ayşe Yıldız (fictional)',
  'İstanbul | ayse@example.com',
  '',
  'EXPERIENCE',
  'Yazılım Stajyeri, Jun 2024 – Aug 2024',
  'Müller & José Muñoz Ltd (fictional)',
  '- Ağ izleme için çözüm geliştirdim, hızlı ve güvenli.',
].join('\n');

const fonts = readPdfFonts();
const STYLES: ExportStyle[] = ['original', 'jake'];

async function bytesOf(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

describe('renderPdf (design §7.7)', () => {
  it.each(STYLES)('%s: renders the demo and a Turkish resume as real PDFs', async (style) => {
    for (const text of [DEMO_RESUME_TEXT, TURKISH]) {
      const bytes = await bytesOf(await renderPdf(exportLayoutFor(text, style), fonts));
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
      expect(doc.getTitle()).toBe(text.split('\n')[0]);
    }
  });

  it('hard-breaks a token wider than the page instead of running past the margin', async () => {
    const url = `https://example.com/${'a'.repeat(400)}`;
    const text = `Ayşe Yıldız (fictional)\nSKILLS\nLinks: ${url}\n- ${url}`;
    const bytes = await bytesOf(await renderPdf(exportLayoutFor(text, 'jake'), fonts));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it('embeds fonts that cover Turkish and Spanish letters, en dashes and bullets', () => {
    for (const bytes of Object.values(fonts)) {
      const font = fontkit.create(bytes);
      for (const ch of 'şğıİçöüéñŞĞÇÖÜ–•') {
        expect(font.hasGlyphForCodePoint(ch.codePointAt(0)!), ch).toBe(true);
      }
    }
  });
});
