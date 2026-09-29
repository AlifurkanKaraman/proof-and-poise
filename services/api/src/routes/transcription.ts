import {
  AudioUploadRequestSchema,
  TranscriptionStartRequestSchema,
  type PresignedPostResponse,
  type TranscriptionStatusResponse,
} from '@proof-and-poise/shared';
import { ApiError } from '../lib/errors';
import { parseBody } from '../lib/request';
import { sessionOf, type RequestContext, type RouteHandler } from '../lib/router';
import type { TranscriptionService } from '../services/transcriptionService';
import type { UploadService } from '../services/uploadService';

const turnIdOf = (ctx: RequestContext): string => {
  const id = ctx.params['turnId'];
  if (!id) throw new ApiError('NOT_FOUND');
  return id;
};

/** POST /sessions/{sessionId}/turns/{turnId}/uploads/audio (Req 10.4). */
export const presignAudio =
  (uploads: UploadService): RouteHandler =>
  async (ctx) => {
    const session = sessionOf(ctx);
    turnIdOf(ctx);
    const req = parseBody(ctx.event, AudioUploadRequestSchema);
    const body: PresignedPostResponse = await uploads.presignAudio(
      session.sessionId,
      req.contentType,
    );
    return { body };
  };

/** POST /sessions/{sessionId}/turns/{turnId}/transcription → 202 (Req 10.4, 16.4). */
export const startTranscription =
  (transcription: TranscriptionService): RouteHandler =>
  async (ctx) => {
    const session = sessionOf(ctx);
    const req = parseBody(ctx.event, TranscriptionStartRequestSchema);
    const body: { status: 'transcribing' } = await transcription.start(session, turnIdOf(ctx), req);
    return { body };
  };

/** GET /sessions/{sessionId}/turns/{turnId}/transcription: poll, then cleanup (Req 10.6). */
export const getTranscription =
  (transcription: TranscriptionService): RouteHandler =>
  async (ctx) => {
    const body: TranscriptionStatusResponse = await transcription.get(
      sessionOf(ctx),
      turnIdOf(ctx),
    );
    return { body };
  };
