/**
 * Session token auth (Req 2.1–2.2, design §11).
 * Tokens are 256-bit CSPRNG values; only their SHA-256 hash is stored. Comparison is
 * constant-time, and every failure looks the same (401) whether or not the session exists.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { LIMITS } from '@proof-and-poise/shared';
import type { SessionMeta, SessionRepository } from '../data/sessionRepository';
import { ApiError } from './errors';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BEARER = /^Bearer ([A-Za-z0-9_-]{43,128})$/;
const HEX_SHA256 = /^[0-9a-f]{64}$/;
/** Compared against when no session is found, so the miss path does the same work. */
const DUMMY_HASH = '0'.repeat(64);

/** 32 random bytes, base64url (43 chars). */
export function generateSessionToken(): string {
  return randomBytes(LIMITS.session.tokenBytes).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Constant-time check that `token` hashes to `storedHash`. */
export function tokenMatches(storedHash: string, token: string): boolean {
  const expected = Buffer.from(HEX_SHA256.test(storedHash) ? storedHash : DUMMY_HASH, 'hex');
  const actual = Buffer.from(hashToken(token), 'hex');
  return timingSafeEqual(expected, actual) && HEX_SHA256.test(storedHash);
}

/** Extracts the bearer token from HTTP API v2 headers (names are case-insensitive). */
export function bearerToken(
  headers: Record<string, string | undefined> | undefined,
): string | null {
  if (!headers) return null;
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === 'authorization' && value) {
      return BEARER.exec(value.trim())?.[1] ?? null;
    }
  }
  return null;
}

export const isSessionId = (id: string | undefined): id is string =>
  typeof id === 'string' && UUID_V4.test(id);

/**
 * Resolves the session for a session-scoped request, or throws 401 `UNAUTHORIZED`.
 * Malformed IDs, missing or malformed tokens, unknown sessions, wrong tokens, and expired
 * sessions are indistinguishable to the caller (Req 2.2).
 */
export async function authenticate(
  repo: SessionRepository,
  sessionId: string | undefined,
  headers: Record<string, string | undefined> | undefined,
  nowMs: number,
): Promise<SessionMeta> {
  const token = bearerToken(headers);
  if (!token || !isSessionId(sessionId)) throw new ApiError('UNAUTHORIZED');
  const meta = await repo.getMeta(sessionId);
  const matches = tokenMatches(meta?.tokenHash ?? DUMMY_HASH, token);
  // TTL deletion can lag by hours, so expiry is also checked here (Req 2.4).
  if (!meta || !matches || meta.ttl * 1000 <= nowMs) throw new ApiError('UNAUTHORIZED');
  return meta;
}

/** Salted SHA-256 of the client IP (Req 16.3). The raw IP is never stored or logged. */
export function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${ip}`, 'utf8').digest('hex');
}
