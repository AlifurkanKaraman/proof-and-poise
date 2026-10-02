import { z } from 'zod';
import { CreateSessionResponseSchema, type CreateSessionResponse } from '@proof-and-poise/shared';

/**
 * Anonymous session credentials (Req 2.3, design §10). Kept in `sessionStorage` only:
 * never `localStorage`, cookies, or URLs. The tab keeps the session across reloads
 * (Req 2.6) and forgets it when closed.
 */
export const SESSION_STORAGE_KEY = 'proof-and-poise.session';

// Field schemas come from the shared contract; only the stored key names differ.
const StoredSessionSchema = z.object({
  sessionId: CreateSessionResponseSchema.shape.sessionId,
  token: CreateSessionResponseSchema.shape.sessionToken,
});
export type StoredSession = z.infer<typeof StoredSessionSchema>;

/** sessionStorage can throw (disabled storage, some private modes); treat that as "no session". */
function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveSession(created: Pick<CreateSessionResponse, 'sessionId' | 'sessionToken'>) {
  const value: StoredSession = StoredSessionSchema.parse({
    sessionId: created.sessionId,
    token: created.sessionToken,
  });
  storage()?.setItem(SESSION_STORAGE_KEY, JSON.stringify(value));
}

/** The stored session, or null when missing or malformed (a malformed entry is removed). */
export function loadSession(): StoredSession | null {
  const store = storage();
  const raw = store?.getItem(SESSION_STORAGE_KEY);
  if (raw == null) return null;
  try {
    const parsed = StoredSessionSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {
    // fall through: not JSON
  }
  store?.removeItem(SESSION_STORAGE_KEY);
  return null;
}

export function clearSession() {
  storage()?.removeItem(SESSION_STORAGE_KEY);
}

/**
 * Bearer token for a session-scoped request. Returns null unless the stored session is
 * the one being addressed, so a token is never sent for another session's ID.
 */
export function getSessionToken(sessionId: string | undefined): string | null {
  const session = loadSession();
  if (!session || sessionId === undefined || session.sessionId !== sessionId) return null;
  return session.token;
}
