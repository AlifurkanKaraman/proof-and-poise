import { describe, expect, it } from 'vitest';
import { CreateSessionResponseSchema } from '@proof-and-poise/shared';
import {
  bearerToken,
  generateSessionToken,
  hashIp,
  hashToken,
  isSessionId,
  tokenMatches,
} from './auth';

describe('session tokens (Req 2.1–2.2)', () => {
  it('generates 256-bit base64url tokens that fit the contract and differ each time', () => {
    const tokens = new Set(Array.from({ length: 50 }, generateSessionToken));
    expect(tokens.size).toBe(50);
    for (const t of tokens) {
      expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(t, 'base64url')).toHaveLength(32);
      expect(CreateSessionResponseSchema.shape.sessionToken.safeParse(t).success).toBe(true);
    }
  });

  it('stores a SHA-256 hex hash, never the token, and matches only the right token', () => {
    const token = generateSessionToken();
    const hash = hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(tokenMatches(hash, token)).toBe(true);
    expect(tokenMatches(hash, generateSessionToken())).toBe(false);
    expect(tokenMatches('not-a-hash', token)).toBe(false);
    expect(tokenMatches('0'.repeat(64), token)).toBe(false);
  });

  it('parses only well-formed Bearer headers, case-insensitively by header name', () => {
    const token = generateSessionToken();
    expect(bearerToken({ authorization: `Bearer ${token}` })).toBe(token);
    expect(bearerToken({ Authorization: `Bearer ${token}` })).toBe(token);
    expect(bearerToken({ authorization: token })).toBeNull();
    expect(bearerToken({ authorization: 'Bearer short' })).toBeNull();
    expect(bearerToken({ authorization: `Basic ${token}` })).toBeNull();
    expect(bearerToken({})).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
  });

  it('accepts only UUID v4 session IDs', () => {
    expect(isSessionId('3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f')).toBe(true);
    expect(isSessionId('3f1c2a4e-8b7d-1c1a-9e2f-0a1b2c3d4e5f')).toBe(false);
    expect(isSessionId('S#x')).toBe(false);
    expect(isSessionId(undefined)).toBe(false);
  });
});

describe('hashIp (Req 16.3)', () => {
  it('is deterministic per salt, salt-dependent, and never contains the raw IP', () => {
    const salt = 'a'.repeat(64);
    const ip = '198.51.100.7';
    expect(hashIp(ip, salt)).toBe(hashIp(ip, salt));
    expect(hashIp(ip, salt)).not.toBe(hashIp(ip, 'b'.repeat(64)));
    expect(hashIp(ip, salt)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp(ip, salt)).not.toContain(ip);
  });
});
