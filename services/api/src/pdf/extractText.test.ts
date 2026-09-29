import { describe, expect, it } from 'vitest';
import { DEMO_RESUME_TEXT } from '@proof-and-poise/shared';
import { makePdf } from '../test/pdf';
import { extractPdfText, hasPdfMagic } from './extractText';

const resumeLines = DEMO_RESUME_TEXT.split('\n').filter((l) => l.trim() !== '');

describe('extractPdfText (Req 4.3–4.4)', () => {
  it('extracts text across pages and keeps line structure', async () => {
    const half = Math.ceil(resumeLines.length / 2);
    const { text, pages } = await extractPdfText(
      makePdf([resumeLines.slice(0, half), resumeLines.slice(half)]),
    );
    expect(pages).toBe(2);
    expect(text).toContain('Built a Python AWS Lambda function that validates shipment events');
    expect(text).toContain('Tools: Git, GitHub Actions, Docker, Postman, Linux');
    expect(text.split('\n').length).toBeGreaterThan(10);
  });

  it('rejects files without PDF magic bytes', async () => {
    const notPdf = new TextEncoder().encode('<html>'.padEnd(400, 'x'));
    expect(hasPdfMagic(notPdf)).toBe(false);
    await expect(extractPdfText(notPdf)).rejects.toMatchObject({ code: 'EXTRACTION_FAILED' });
    await expect(extractPdfText(new Uint8Array())).rejects.toMatchObject({
      code: 'EXTRACTION_FAILED',
    });
  });

  it('rejects PDFs with more than 4 pages', async () => {
    const page = resumeLines.slice(0, 10);
    await expect(extractPdfText(makePdf([page, page, page, page, page]))).rejects.toMatchObject({
      code: 'EXTRACTION_FAILED',
    });
  });

  it('rejects PDFs with too little text, like scanned resumes', async () => {
    await expect(extractPdfText(makePdf([['Scanned page']]))).rejects.toMatchObject({
      code: 'EXTRACTION_FAILED',
    });
  });

  it('rejects corrupt PDFs', async () => {
    const corrupt = new TextEncoder().encode('%PDF-1.4\n'.padEnd(500, 'garbage '));
    await expect(extractPdfText(corrupt)).rejects.toMatchObject({ code: 'EXTRACTION_FAILED' });
  });
});
