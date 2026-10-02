/**
 * Anonymous sessions (Req 2.1–2.5, 13.2, 16.3): create with IP-hash rate limit, summarize,
 * and delete everything (DynamoDB items first, then best-effort S3 prefixes).
 */
import { randomUUID } from 'node:crypto';
import { DeleteObjectsCommand, ListObjectsV2Command, type S3Client } from '@aws-sdk/client-s3';
import {
  DEMO_EVIDENCE_MAP,
  DEMO_RESUME_TEXT,
  LIMITS,
  type CreateSessionResponse,
  type SessionMode,
  type SessionSummary,
} from '@proof-and-poise/shared';
import type { QuotaCounters } from '../data/quotas';
import type { ReadyAnalysis, SessionMeta, SessionRepository } from '../data/sessionRepository';
import { generateSessionToken, hashIp, hashToken } from '../lib/auth';
import type { Logger } from '../lib/logger';
import type { SaltProvider } from '../lib/salt';

/** Session-scoped S3 prefixes removed on delete (Req 2.5). */
export const SESSION_S3_PREFIXES = ['resumes', 'audio', 'transcripts'] as const;

export interface SessionServiceDeps {
  repo: SessionRepository;
  quotas: QuotaCounters;
  s3: S3Client;
  bucketName: string;
  salt: SaltProvider;
  log: Logger;
  now: () => number;
}

/** Demo sessions start from the precomputed fictional analysis (Req 13.2, design §15). */
export function demoAnalysis(): ReadyAnalysis {
  return {
    status: 'ready',
    evidenceMap: DEMO_EVIDENCE_MAP,
    resumeText: DEMO_RESUME_TEXT,
    truncated: false,
    precomputed: true,
  };
}

export class SessionService {
  constructor(private readonly deps: SessionServiceDeps) {}

  async create(mode: SessionMode, sourceIp: string | undefined): Promise<CreateSessionResponse> {
    const { repo, quotas, salt, now } = this.deps;
    const nowMs = now();
    // Only the salted hash reaches storage (Req 16.3).
    await quotas.consumeIpRate(hashIp(sourceIp ?? 'unknown', await salt()), nowMs);

    const sessionId = randomUUID();
    const sessionToken = generateSessionToken();
    const ttlSeconds = LIMITS.session.ttlHours * 3600;
    const expiresMs = nowMs + ttlSeconds * 1000;
    const meta: SessionMeta = {
      sessionId,
      tokenHash: hashToken(sessionToken),
      mode,
      stage: mode === 'demo' ? 'analysis' : 'setup',
      createdAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(expiresMs).toISOString(),
      ttl: Math.floor(expiresMs / 1000),
    };
    await repo.create(meta, mode === 'demo' ? demoAnalysis() : undefined);
    return { sessionId, sessionToken, expiresAt: meta.expiresAt };
  }

  summary(meta: SessionMeta): SessionSummary {
    return {
      sessionId: meta.sessionId,
      mode: meta.mode,
      stage: meta.stage,
      expiresAt: meta.expiresAt,
    };
  }

  /** Deletes all session items, then best-effort deletes the session's S3 objects. */
  async delete(meta: SessionMeta): Promise<void> {
    await this.deps.repo.deleteAll(meta.sessionId);
    await Promise.all(SESSION_S3_PREFIXES.map((p) => this.deletePrefix(`${p}/${meta.sessionId}/`)));
  }

  private async deletePrefix(prefix: string): Promise<void> {
    const { s3, bucketName, log } = this.deps;
    try {
      let token: string | undefined;
      do {
        const page = await s3.send(
          new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix,
            ContinuationToken: token,
          }),
        );
        const objects = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
        if (objects.length > 0) {
          await s3.send(
            new DeleteObjectsCommand({
              Bucket: bucketName,
              Delete: { Objects: objects, Quiet: true },
            }),
          );
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
    } catch (err) {
      // Best effort: the 1-day lifecycle rule removes anything left behind (Req 4.2).
      log.error('s3_prefix_delete_failed', err);
    }
  }
}
