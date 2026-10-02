/**
 * Presigned S3 POST policies (Req 4.1). The server picks the key under the session's
 * prefix; the policy pins the key, the content type, a size range, and a ≤300 s expiry.
 */
import { randomUUID } from 'node:crypto';
import type { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { LIMITS, type AudioContentType, type PresignedPostResponse } from '@proof-and-poise/shared';

export const resumeKeyPrefix = (sessionId: string): string => `resumes/${sessionId}/`;
export const audioKeyPrefix = (sessionId: string): string => `audio/${sessionId}/`;
export const transcriptKeyPrefix = (sessionId: string): string => `transcripts/${sessionId}/`;

/** Key extension per allowed content type; it also tells Transcribe the media format. */
export const AUDIO_EXTENSION: Record<AudioContentType, 'webm' | 'mp4' | 'ogg'> = {
  'audio/webm': 'webm',
  'audio/mp4': 'mp4',
  'audio/ogg': 'ogg',
};

export class UploadService {
  constructor(
    private readonly s3: S3Client,
    private readonly bucketName: string,
  ) {}

  async presignResume(sessionId: string): Promise<PresignedPostResponse> {
    const { contentType, minBytes, maxBytes, presignExpiresSec } = LIMITS.resumeUpload;
    const key = `${resumeKeyPrefix(sessionId)}${randomUUID()}.pdf`;
    // createPresignedPost adds the bucket and `key` equality conditions itself.
    const { url, fields } = await createPresignedPost(this.s3, {
      Bucket: this.bucketName,
      Key: key,
      Conditions: [
        ['content-length-range', minBytes, maxBytes],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: { 'Content-Type': contentType },
      Expires: presignExpiresSec,
    });
    return { url, fields, key, expiresIn: presignExpiresSec };
  }

  /** Audio POST for one answer: ≤ 10 MB, one of the allowed audio types (Req 10.4). */
  async presignAudio(
    sessionId: string,
    contentType: AudioContentType,
  ): Promise<PresignedPostResponse> {
    const { minBytes, maxBytes, presignExpiresSec } = LIMITS.audioUpload;
    const key = `${audioKeyPrefix(sessionId)}${randomUUID()}.${AUDIO_EXTENSION[contentType]}`;
    const { url, fields } = await createPresignedPost(this.s3, {
      Bucket: this.bucketName,
      Key: key,
      Conditions: [
        ['content-length-range', minBytes, maxBytes],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: { 'Content-Type': contentType },
      Expires: presignExpiresSec,
    });
    return { url, fields, key, expiresIn: presignExpiresSec };
  }
}
