/**
 * Builds a small, valid text PDF (Helvetica, one text line per entry) for extraction tests.
 * Byte offsets in the xref table are computed, so pdf.js parses it without repair.
 */
/** ASCII only (non-ASCII becomes `-`), so string length equals byte length for offsets. */
const escapePdf = (s: string) =>
  s.replace(/[^\x20-\x7e]/g, '-').replace(/[\\()]/g, (c) => `\\${c}`);

export function makePdf(pages: readonly (readonly string[])[]): Uint8Array {
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pages.forEach((lines, i) => {
    const pageId = pageIds[i] ?? 0;
    const body = [
      'BT',
      '/F1 10 Tf',
      // 12 pt leading from y=760 fits ~60 lines on a Letter page; pdf.js drops off-page text.
      '12 TL',
      '50 760 Td',
      ...lines.map((l) => `(${escapePdf(l)}) Tj T*`),
      'ET',
    ].join('\n');
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
    objects[pageId + 1] = `<< /Length ${body.length} >>\nstream\n${body}\nendstream`;
  });

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
