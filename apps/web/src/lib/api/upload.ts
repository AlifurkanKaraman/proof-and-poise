import type { PresignedPostResponse } from '@proof-and-poise/shared';
import { ApiError } from './errors';

/**
 * Send a file to a presigned S3 POST (Req 4.1). The policy fields go first and the file
 * last, as S3 requires. Failures reject with `ApiError` like every other API call.
 */
export async function uploadToPresignedPost(
  presigned: Pick<PresignedPostResponse, 'url' | 'fields'>,
  file: Blob,
  doFetch: typeof fetch = (...args) => fetch(...args),
): Promise<void> {
  const form = new FormData();
  for (const [name, value] of Object.entries(presigned.fields)) form.append(name, value);
  form.append('file', file);

  let res: Response;
  try {
    res = await doFetch(presigned.url, { method: 'POST', body: form });
  } catch {
    throw new ApiError({
      kind: 'network',
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'The resume upload failed.',
      route: 'presignResume',
    });
  }
  if (!res.ok) {
    // An expired or rejected policy: getting a fresh one (Retry) is the recovery.
    throw new ApiError({
      kind: 'http',
      code: 'UPSTREAM_UNAVAILABLE',
      message: `The resume upload failed with status ${res.status}.`,
      route: 'presignResume',
      status: res.status,
    });
  }
}
