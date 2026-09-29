/**
 * Analysis worker pipeline (design §2, §7; Req 4.3–4.5, 5.1–5.5, 6.1, 7.2–7.3, 7.8):
 * fetch the PDF → check magic bytes → extract (≤ 4 pages) → delete the object (always) →
 * truncate → model call → grounding filters, strength caps, label validation →
 * parseability, keywords, scores → persist.
 *
 * The worker never throws for expected failures: it records `failed` with a recoverable
 * error code, so Lambda's async retries don't re-run a half-finished analysis. Only a
 * `queued` analysis is picked up, which also makes duplicate deliveries harmless.
 */
import { DeleteObjectCommand, GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { LIMITS } from '@proof-and-poise/shared';
import { analyzeRequest } from '../ai/prompts/analyze';
import { invokeStructured, type ModelDeps } from '../ai/invokeStructured';
import type { AnalysisRepository, StoredInput } from '../data/analysisRepository';
import type { SessionRepository } from '../data/sessionRepository';
import { ApiError } from '../lib/errors';
import type { Logger } from '../lib/logger';
import { extractPdfText } from '../pdf/extractText';
import { buildEvidenceMap } from './evidenceMapBuilder';
import { resumeKeyPrefix } from './uploadService';

export interface AnalysisWorkerDeps {
  analyses: AnalysisRepository;
  sessions: Pick<SessionRepository, 'getMeta'>;
  s3: S3Client;
  bucketName: string;
  model: ModelDeps;
  log: Logger;
  now: () => number;
}

export function truncateResume(text: string): { text: string; truncated: boolean } {
  const max = LIMITS.resumeText.max;
  return text.length > max
    ? { text: text.slice(0, max), truncated: true }
    : { text, truncated: false };
}

export class AnalysisWorker {
  constructor(private readonly deps: AnalysisWorkerDeps) {}

  async run(sessionId: string): Promise<void> {
    const { analyses, sessions, log, now } = this.deps;
    const started = now();
    const meta = await sessions.getMeta(sessionId);
    if (!meta) return;
    const current = await analyses.getAnalysis(sessionId);
    if (current?.status !== 'queued') return;

    try {
      const input = await analyses.getInput(sessionId);
      if (!input) throw new ApiError('INTERNAL');
      // End-to-end budget from the start of the worker (Req 5.5).
      const deadlineMs = started + LIMITS.analysis.timeoutSec * 1000;

      await analyses.setStage(sessionId, 'reading_resume');
      const extracted = await this.resumeText(sessionId, input);
      const { text, truncated } = truncateResume(extracted);
      if (input.resumeKind === 'pdf') await analyses.saveExtractedText(sessionId, text);

      await analyses.setStage(sessionId, 'mapping_competencies');
      const output = await invokeStructured(
        this.deps.model,
        analyzeRequest(text, input.job, deadlineMs),
      );

      await analyses.setStage(sessionId, 'checking_evidence');
      const { evidenceMap, stats } = buildEvidenceMap({
        output,
        resumeText: text,
        inputKind: input.resumeKind,
      });
      log.info('analysis_grounding', stats);

      await analyses.setStage(sessionId, 'drafting_recommendations');
      await analyses.putReady(sessionId, meta.ttl, {
        status: 'ready',
        evidenceMap,
        resumeText: text,
        truncated,
        precomputed: false,
      });
      log.info('analysis_ready', { durationMs: now() - started });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL';
      log.error('analysis_failed', err, { errorCode: code, durationMs: now() - started });
      await analyses.putFailed(sessionId, meta.ttl, code);
    }
  }

  private async resumeText(sessionId: string, input: StoredInput): Promise<string> {
    if (input.resumeKind === 'text') {
      if (!input.resumeText) throw new ApiError('INTERNAL');
      return input.resumeText;
    }
    if (!input.resumeKey) throw new ApiError('EXTRACTION_FAILED');
    const bytes = await this.fetchAndDelete(sessionId, input.resumeKey);
    return (await extractPdfText(bytes)).text;
  }

  /**
   * Reads the upload, then deletes it whether or not the read succeeded (Req 4.3). A failed
   * delete is logged; the 1-day lifecycle rule is the backstop (Req 4.2).
   */
  private async fetchAndDelete(sessionId: string, key: string): Promise<Uint8Array> {
    const { s3, bucketName, log } = this.deps;
    // Never touch an object outside this session's prefix (Req 4.3).
    if (!key.startsWith(resumeKeyPrefix(sessionId)) || key.includes('..')) {
      throw new ApiError('VALIDATION');
    }
    try {
      const res = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
      if (!res.Body || (res.ContentLength ?? 0) > LIMITS.resumeUpload.maxBytes) {
        throw new ApiError('EXTRACTION_FAILED');
      }
      return await res.Body.transformToByteArray();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // Missing object (upload never completed) or an unreadable body.
      log.warn('resume_fetch_failed', { errorCode: 'EXTRACTION_FAILED' });
      throw new ApiError('EXTRACTION_FAILED');
    } finally {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
      } catch (err) {
        log.error('resume_delete_failed', err);
      }
    }
  }
}
