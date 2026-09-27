import { ResumeUploadRequestSchema, type PresignedPostResponse } from '@proof-and-poise/shared';
import { parseBody } from '../lib/request';
import { sessionOf, type RouteHandler } from '../lib/router';
import type { UploadService } from '../services/uploadService';

/** POST /sessions/{sessionId}/uploads/resume (Req 4.1). */
export const presignResume =
  (uploads: UploadService): RouteHandler =>
  async (ctx) => {
    const session = sessionOf(ctx);
    // Validates content type and size before issuing a policy.
    parseBody(ctx.event, ResumeUploadRequestSchema);
    const body: PresignedPostResponse = await uploads.presignResume(session.sessionId);
    return { body };
  };
