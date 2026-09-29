/**
 * `POST/GET /sessions/{id}/turns/{turnId}/transcription` (Req 10.4, 10.6–10.7, 16.4,
 * design §2). Start validates the upload key, spends the per-session quota and the global
 * daily transcribe budget, then starts a batch job that writes to `transcripts/<sessionId>/`.
 * Get polls the job lazily; once it is done the transcript is read and the audio, the
 * transcript object, the job, and its record are deleted. Failures map to a typed
 * `failed` status so the UI keeps the user on the question with the typed fallback.
 */
import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import {
  BadRequestException,
  DeleteTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  NotFoundException,
  StartTranscriptionJobCommand,
  type LanguageCode,
  type MediaFormat,
  type TranscribeClient,
} from '@aws-sdk/client-transcribe';
import {
  LIMITS,
  ShortIdSchema,
  type ErrorCode,
  type TranscriptionStartRequest,
  type TranscriptionStatusResponse,
} from '@proof-and-poise/shared';
import type { QuotaCounters } from '../data/quotas';
import type { SessionMeta } from '../data/sessionRepository';
import type { StoredTranscription, TranscriptionRepository } from '../data/transcriptionRepository';
import { ApiError } from '../lib/errors';
import type { Logger } from '../lib/logger';
import { audioKeyPrefix, transcriptKeyPrefix } from './uploadService';

export interface TranscriptionServiceDeps {
  repo: TranscriptionRepository;
  quotas: Pick<QuotaCounters, 'consumeSession' | 'consumeGlobal'>;
  transcribe: TranscribeClient;
  s3: S3Client;
  bucketName: string;
  log: Logger;
  now: () => number;
}

const isConditionFailure = (err: unknown) =>
  typeof err === 'object' &&
  err !== null &&
  (err as { name?: unknown }).name === 'ConditionalCheckFailedException';

/** The media format Transcribe needs comes from the extension we chose at presign time. */
const mediaFormatOf = (key: string): MediaFormat | null => {
  const ext = key.split('.').pop();
  return ext === 'webm' || ext === 'mp4' || ext === 'ogg' ? ext : null;
};

/** Extracts the transcript text from Transcribe's output JSON, or null if malformed. */
function parseTranscript(json: string): string | null {
  try {
    const parsed = JSON.parse(json) as { results?: { transcripts?: { transcript?: unknown }[] } };
    const text = parsed.results?.transcripts?.[0]?.transcript;
    return typeof text === 'string' ? text.trim() : null;
  } catch {
    return null;
  }
}

export class TranscriptionService {
  constructor(private readonly deps: TranscriptionServiceDeps) {}

  async start(
    meta: SessionMeta,
    turnId: string,
    req: TranscriptionStartRequest,
  ): Promise<{ status: 'transcribing' }> {
    const { repo, quotas, transcribe, bucketName, now } = this.deps;
    const { sessionId } = meta;
    this.assertTurnId(turnId);
    // The key must be one we issued for this session (Req 10.4).
    if (!req.key.startsWith(audioKeyPrefix(sessionId))) {
      throw new ApiError('VALIDATION', undefined, { key: 'invalid_key' });
    }
    const mediaFormat = mediaFormatOf(req.key);
    if (!mediaFormat) throw new ApiError('VALIDATION', undefined, { key: 'invalid_key' });

    const existing = await repo.get(sessionId, turnId);
    if (existing?.status === 'transcribing') throw new ApiError('CONFLICT');

    // Session cap first, then the global daily minute budget (Req 16.4, 10.7).
    await quotas.consumeSession(sessionId, 'transcriptions');
    await quotas.consumeGlobal('transcribeSeconds', req.durationSec, now());

    const jobName = `proof-and-poise-${randomUUID()}`;
    const record: StoredTranscription = {
      status: 'transcribing',
      jobName,
      audioKey: req.key,
      transcriptKey: `${transcriptKeyPrefix(sessionId)}${jobName}.json`,
      startedAt: new Date(now()).toISOString(),
      durationSec: req.durationSec,
    };
    if (existing) {
      await repo.put(sessionId, turnId, meta.ttl, record);
    } else {
      try {
        await repo.create(sessionId, turnId, meta.ttl, record);
      } catch (err) {
        if (isConditionFailure(err)) throw new ApiError('CONFLICT');
        throw err;
      }
    }

    try {
      await transcribe.send(
        new StartTranscriptionJobCommand({
          TranscriptionJobName: jobName,
          Media: { MediaFileUri: `s3://${bucketName}/${req.key}` },
          MediaFormat: mediaFormat,
          // Single language, no identification: faster and predictable on short clips.
          // en-GB / en-IN are the documented alternatives in LIMITS.transcribe.
          LanguageCode: LIMITS.transcribe.languageCode as LanguageCode,
          OutputBucketName: bucketName,
          OutputKey: record.transcriptKey,
        }),
      );
    } catch (err) {
      await repo.delete(sessionId, turnId);
      if (err instanceof BadRequestException) {
        throw new ApiError('VALIDATION', undefined, { key: 'unreadable_audio' });
      }
      this.deps.log.warn('transcription_start_failed', { task: 'transcribe' });
      throw new ApiError('UPSTREAM_UNAVAILABLE');
    }
    return { status: 'transcribing' };
  }

  async get(meta: SessionMeta, turnId: string): Promise<TranscriptionStatusResponse> {
    const { repo, transcribe } = this.deps;
    const { sessionId } = meta;
    this.assertTurnId(turnId);
    const record = await repo.get(sessionId, turnId);
    if (!record) throw new ApiError('NOT_FOUND');
    if (record.status === 'failed') {
      return { status: 'failed', errorCode: record.errorCode ?? 'UPSTREAM_UNAVAILABLE' };
    }

    let jobStatus: string | undefined;
    try {
      const res = await transcribe.send(
        new GetTranscriptionJobCommand({ TranscriptionJobName: record.jobName }),
      );
      jobStatus = res.TranscriptionJob?.TranscriptionJobStatus;
    } catch (err) {
      // A vanished job can't recover; anything else is transient and worth polling again.
      if (err instanceof NotFoundException || err instanceof BadRequestException) {
        return this.fail(meta, turnId, record, 'UPSTREAM_UNAVAILABLE');
      }
      throw new ApiError('UPSTREAM_UNAVAILABLE');
    }

    if (jobStatus === 'FAILED') return this.fail(meta, turnId, record, 'UPSTREAM_UNAVAILABLE');
    if (jobStatus !== 'COMPLETED') return { status: 'transcribing' };

    const text = await this.readTranscript(record.transcriptKey);
    if (text === null) return this.fail(meta, turnId, record, 'UPSTREAM_UNAVAILABLE');
    if (text === '') return this.fail(meta, turnId, record, 'EXTRACTION_FAILED');

    await this.cleanup(record);
    await repo.delete(sessionId, turnId);
    return { status: 'ready', text: text.slice(0, LIMITS.answer.max) };
  }

  private assertTurnId(turnId: string): void {
    if (!ShortIdSchema.safeParse(turnId).success) throw new ApiError('NOT_FOUND');
  }

  /** Reads the transcript object; null when it is missing or malformed. */
  private async readTranscript(key: string): Promise<string | null> {
    try {
      const res = await this.deps.s3.send(
        new GetObjectCommand({ Bucket: this.deps.bucketName, Key: key }),
      );
      const body = await res.Body?.transformToString();
      return body === undefined ? null : parseTranscript(body);
    } catch {
      return null;
    }
  }

  /** Marks the turn's transcription failed and removes what the failed job left behind. */
  private async fail(
    meta: SessionMeta,
    turnId: string,
    record: StoredTranscription,
    errorCode: ErrorCode,
  ): Promise<TranscriptionStatusResponse> {
    await this.cleanup(record);
    await this.deps.repo.put(meta.sessionId, turnId, meta.ttl, {
      ...record,
      status: 'failed',
      errorCode,
    });
    return { status: 'failed', errorCode };
  }

  /**
   * Deletes the audio, the transcript, and the job (Req 10.6). Each step is best effort:
   * a leftover is still removed by the 1-day S3 lifecycle rule.
   */
  private async cleanup(record: StoredTranscription): Promise<void> {
    const { s3, transcribe, bucketName, log } = this.deps;
    const steps: (() => Promise<unknown>)[] = [
      () => s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: record.audioKey })),
      () => s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: record.transcriptKey })),
      () =>
        transcribe.send(
          new DeleteTranscriptionJobCommand({ TranscriptionJobName: record.jobName }),
        ),
    ];
    for (const step of steps) {
      try {
        await step();
      } catch {
        log.warn('transcription_cleanup_failed', { task: 'transcribe' });
      }
    }
  }
}
