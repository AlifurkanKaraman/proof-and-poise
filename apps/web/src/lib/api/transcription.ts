import { LIMITS, type AudioContentType } from '@proof-and-poise/shared';
import { ApiError } from './errors';
import { api } from './index';
import { uploadToPresignedPost } from './upload';

/** Backoff for transcription polling: 1 s, ×1.5 per poll, capped at 4 s (design §10). */
export const TRANSCRIPTION_POLL = { initialMs: 1_000, factor: 1.5, maxMs: 4_000, maxPolls: 40 };

export function transcriptionPollDelay(pollsSoFar: number): number {
  const n = Math.max(0, pollsSoFar);
  return Math.min(
    TRANSCRIPTION_POLL.maxMs,
    Math.round(TRANSCRIPTION_POLL.initialMs * TRANSCRIPTION_POLL.factor ** n),
  );
}

/** Recording length for `startTranscription`: positive and within the recording cap. */
export function recordingDurationSec(durationMs: number): number {
  const sec = Math.ceil(Math.max(0, durationMs) / 1000);
  return Math.min(LIMITS.recording.maxSeconds, Math.max(1, sec));
}

export interface TranscribeInput {
  sessionId: string;
  turnId: string;
  blob: Blob;
  contentType: AudioContentType;
  durationMs: number;
  signal?: AbortSignal | undefined;
  /** Injected in tests to skip real waiting. */
  sleep?: ((ms: number, signal?: AbortSignal) => Promise<void>) | undefined;
}

const abortError = () =>
  new ApiError({
    kind: 'network',
    code: 'UPSTREAM_UNAVAILABLE',
    message: 'Transcription was cancelled.',
    route: 'getTranscription',
  });

const defaultSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(abortError());
      },
      { once: true },
    );
  });

/**
 * Recorded answer → transcript (Req 10.4, design §8): presign the audio upload (contentType
 * and size checked against `AudioUploadRequestSchema` by the client), POST the blob, start
 * the transcription job, then poll with backoff until it is ready or failed. Resolves with
 * the transcript text for the candidate to review; any failure rejects with `ApiError`.
 */
export async function transcribeRecording(input: TranscribeInput): Promise<string> {
  const { sessionId, turnId, blob, contentType, signal } = input;
  const sleep = input.sleep ?? defaultSleep;
  const params = { sessionId, turnId };
  const opts = signal ? { signal } : {};

  const presigned = await api.request('presignAudio', {
    params,
    body: { contentType, size: blob.size },
    ...opts,
  });
  await uploadToPresignedPost(presigned, blob, undefined, 'presignAudio');
  await api.request('startTranscription', {
    params,
    body: { key: presigned.key, durationSec: recordingDurationSec(input.durationMs) },
    ...opts,
  });

  for (let poll = 0; poll < TRANSCRIPTION_POLL.maxPolls; poll++) {
    await sleep(transcriptionPollDelay(poll), signal);
    if (signal?.aborted) throw abortError();
    const status = await api.request('getTranscription', { params, ...opts });
    if (status.status === 'ready') return status.text;
    if (status.status === 'failed') {
      throw new ApiError({
        kind: 'http',
        code: status.errorCode,
        message: 'The transcription failed.',
        route: 'getTranscription',
      });
    }
  }
  throw new ApiError({
    kind: 'http',
    code: 'UPSTREAM_UNAVAILABLE',
    message: 'The transcription took too long.',
    route: 'getTranscription',
  });
}
