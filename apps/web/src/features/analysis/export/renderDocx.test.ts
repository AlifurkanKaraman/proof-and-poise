// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  applySkillAdditions,
  DEMO_RESUME_TEXT,
  exportLayoutFor,
  layoutRuns,
  verifyExportLayout,
  type ExportStyle,
} from '@proof-and-poise/shared';
import { renderDocx } from './renderDocx';

const STYLES: ExportStyle[] = ['original', 'jake'];

/** One entry of a zip file, found through the central directory (no zip library needed). */
async function unzipEntry(bytes: Uint8Array, name: string): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = bytes.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  let p = view.getUint32(eocd + 16, true);
  const count = view.getUint16(eocd + 10, true);
  for (let i = 0; i < count; i++) {
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extra = view.getUint16(p + 30, true);
    const comment = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const entry = new TextDecoder().decode(bytes.slice(p + 46, p + 46 + nameLen));
    if (entry === name) {
      const start =
        local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const data = bytes.slice(start, start + size);
      if (method === 0) return new TextDecoder().decode(data);
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(stream).text();
    }
    p += 46 + nameLen + extra + comment;
  }
  throw new Error(`${name} not found`);
}

/** Body text of a .docx: the unescaped text of every `<w:t>` element. */
async function documentText(blob: Blob): Promise<string> {
  const xml = await unzipEntry(new Uint8Array(await blob.arrayBuffer()), 'word/document.xml');
  return [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)]
    .map((m) => m[1] ?? '')
    .join('\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

describe('renderDocx (design §7.7)', () => {
  it.each(STYLES)('%s: contains every input line, the added skills and Unicode', async (style) => {
    const text = applySkillAdditions(
      `Ayşe Yıldız (fictional)\nİstanbul | ayse@example.com\n\n${DEMO_RESUME_TEXT.split('\n').slice(3).join('\n')}`,
      ['Kubernetes'],
    );
    const blob = await renderDocx(exportLayoutFor(text, style));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(bytes[0]!, bytes[1]!)).toBe('PK');
    const body = (await documentText(blob)).replace(/\s+/g, '');
    const squash = (s: string) => s.replace(/\s+/g, '');
    const layout = exportLayoutFor(text, style);
    // verifyExportLayout proves the runs cover every line; here every run must reach the file.
    expect(verifyExportLayout(text, layout)).toEqual([]);
    for (const run of layoutRuns(layout)) expect(body).toContain(squash(run.text));
    if (style === 'original') {
      // Original order keeps each line whole (bullet marker and "|" spacing aside).
      for (const line of text.split('\n')) {
        expect(body).toContain(squash(line.replace(/^\s*[-•*]\s+/, '')));
      }
    }
    expect(body).toContain('Additionalskills:Kubernetes');
    expect(body).toContain('AyşeYıldız(fictional)');
  });
});
