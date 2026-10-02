import type { PresignedPostResponse, RouteName } from '@proof-and-poise/shared';
import { ApiError } from './errors';

/**
 * Send a file to a presigned S3 POST (Req 4.1, 10.4). The policy fields go first and the file
 * last, as S3 requires. Failures reject with `ApiError` like every other API call, tagged
 * with the presign route that issued the policy.
 */
export async function uploadToPresignedPost(
  presigned: Pick<PresignedPostResponse, 'url' | 'fields'>,
  file: Blob,
  doFetch: typeof fetch = (...args) => fetch(...args),
  route: Extract<RouteName, 'presignResume' | 'presignAudio'> = 'presignResume',
): Promise<void> {
  const what = route === 'presignAudio' ? 'recording' : 'resume';
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
      message: `The ${what} upload failed.`,
      route,
    });
  }
  if (!res.ok) {
    // An expired or rejected policy: getting a fresh one (Retry) is the recovery.
    throw new ApiError({
      kind: 'http',
      code: 'UPSTREAM_UNAVAILABLE',
      message: `The ${what} upload failed with status ${res.status}.`,
      route,
      status: res.status,
    });
  }
}
