/**
 * Presigned S3 POST policies (Req 4.1). The server picks the key under the session's
 * prefix; the policy pins the key, the content type, a size range, and a ≤300 s expiry.
 */
import { randomUUID } from 'node:crypto';
import type { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { LIMITS, type PresignedPostResponse } from '@proof-and-poise/shared';

export const resumeKeyPrefix = (sessionId: string): string => `resumes/${sessionId}/`;

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
}
