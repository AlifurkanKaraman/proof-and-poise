/**
 * PDF text extraction with unpdf (Req 4.3–4.4). Checks the magic bytes first, rejects
 * PDFs over the page limit, and fails with the recoverable `EXTRACTION_FAILED` ("paste the
 * text instead") for anything unreadable or with too little text (e.g. scanned PDFs).
 */
import { extractText, getDocumentProxy } from 'unpdf';
import { LIMITS } from '@proof-and-poise/shared';
import { ApiError } from '../lib/errors';

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
/** The PDF spec tolerates leading bytes before the header; readers look in the first 1 KB. */
const MAGIC_SEARCH_BYTES = 1024;

export function hasPdfMagic(bytes: Uint8Array): boolean {
  const end = Math.min(bytes.length, MAGIC_SEARCH_BYTES) - PDF_MAGIC.length;
  for (let i = 0; i <= end; i++) {
    if (PDF_MAGIC.every((b, j) => bytes[i + j] === b)) return true;
  }
  return false;
}

export interface ExtractedPdf {
  text: string;
  pages: number;
}

export async function extractPdfText(bytes: Uint8Array): Promise<ExtractedPdf> {
  if (bytes.length === 0 || bytes.length > LIMITS.resumeUpload.maxBytes || !hasPdfMagic(bytes)) {
    throw new ApiError('EXTRACTION_FAILED');
  }
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
  try {
    // pdf.js may transfer the buffer it's given, so pass a copy.
    pdf = await getDocumentProxy(new Uint8Array(bytes));
    if (pdf.numPages > LIMITS.resumeUpload.maxPages) throw new ApiError('EXTRACTION_FAILED');
    const { text } = await extractText(pdf, { mergePages: true });
    const trimmed = text.trim();
    if (trimmed.length < LIMITS.analysis.minExtractedChars) throw new ApiError('EXTRACTION_FAILED');
    return { text: trimmed, pages: pdf.numPages };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // Corrupt, encrypted, or otherwise unreadable PDFs.
    throw new ApiError('EXTRACTION_FAILED');
  } finally {
    // Frees pdf.js resources (the proxy's own destroy lives on its loading task).
    await pdf?.loadingTask.destroy().catch(() => undefined);
  }
}
