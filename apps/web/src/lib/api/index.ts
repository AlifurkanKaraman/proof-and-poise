import { env } from '../env';
import { getSessionToken } from '../session';
import { createApiClient } from './client';

export { createApiClient, type ApiClient, type RouteBody, type RouteResponse } from './client';
export {
  ApiError,
  codeMessage,
  isApiError,
  isRetryable,
  userMessage,
  type ApiErrorKind,
} from './errors';
export { uploadToPresignedPost } from './upload';

/** App-wide client: base URL from the validated env, token from sessionStorage. */
export const api = createApiClient({ baseUrl: env.apiBaseUrl, getToken: getSessionToken });
