import { afterEach, describe, expect, it } from 'vitest';
import {
  clearSession,
  getSessionToken,
  loadSession,
  saveSession,
  SESSION_STORAGE_KEY,
} from './session';

const created = {
  sessionId: '0b6f1f7e-2d3c-4a5b-8c9d-0e1f2a3b4c5d',
  sessionToken: 'Tk_'.padEnd(43, 'x'),
};

afterEach(() => {
  sessionStorage.clear();
});

describe('session storage (Req 2.3)', () => {
  it('stores {sessionId, token} in sessionStorage only', () => {
    saveSession(created);
    expect(JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY) ?? 'null')).toEqual({
      sessionId: created.sessionId,
      token: created.sessionToken,
    });
    // Not in localStorage (optional chaining: Node 25 can shadow jsdom's localStorage with
    // a non-functional global), and no cookie was set.
    const local = window.localStorage as Partial<Storage> | undefined;
    expect(local?.getItem?.(SESSION_STORAGE_KEY) ?? null).toBeNull();
    expect(document.cookie).toBe('');
    expect(window.location.href).not.toContain(created.sessionToken);
  });

  it('loads the stored session and clears it', () => {
    saveSession(created);
    expect(loadSession()).toEqual({ sessionId: created.sessionId, token: created.sessionToken });
    clearSession();
    expect(loadSession()).toBeNull();
  });

  it('drops a malformed entry instead of using it', () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, '{"sessionId":"nope","token":"short"}');
    expect(loadSession()).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'not json');
    expect(loadSession()).toBeNull();
  });

  it('rejects invalid credentials on save', () => {
    expect(() => saveSession({ sessionId: 'x', sessionToken: 'y' })).toThrow();
    expect(sessionStorage.length).toBe(0);
  });

  it('returns the token only for the stored session ID', () => {
    saveSession(created);
    expect(getSessionToken(created.sessionId)).toBe(created.sessionToken);
    expect(getSessionToken('11111111-2222-4333-8444-555555555555')).toBeNull();
    expect(getSessionToken(undefined)).toBeNull();
  });
});
