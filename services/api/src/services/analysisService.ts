/**
 * `POST/GET /sessions/{id}/analysis` (Req 5.1, 4.3, 16.2, design §2). Starting an analysis
 * validates ownership of the upload key, consumes the per-session quota, stores the input,
 * queues the analysis, and invokes the worker asynchronously. Only the session ID is sent
 * to the worker; content stays in DynamoDB.
 */
import { InvokeCommand, type LambdaClient } from '@aws-sdk/client-lambda';
import { LIMITS, type AnalysisRequest, type AnalysisStatusResponse } from '@proof-and-poise/shared';
import type { AnalysisRepository, StoredAnalysis } from '../data/analysisRepository';
import type { QuotaCounters } from '../data/quotas';
import type { SessionMeta, SessionRepository } from '../data/sessionRepository';
import { ApiError } from '../lib/errors';
import type { Logger } from '../lib/logger';
import { resumeKeyPrefix } from './uploadService';

export interface AnalysisServiceDeps {
  analyses: AnalysisRepository;
  sessions: Pick<SessionRepository, 'setStage'>;
  quotas: Pick<QuotaCounters, 'consumeSession'>;
  lambda: LambdaClient;
  workerFunctionName: string;
  log: Logger;
  now: () => number;
}

/** Payload of the async worker invocation. Identifiers only, never content. */
export interface AnalysisWorkerEvent {
  sessionId: string;
}

const inProgress = (a: StoredAnalysis | null) => a?.status === 'queued' || a?.status === 'running';

export class AnalysisService {
  constructor(private readonly deps: AnalysisServiceDeps) {}

  async start(meta: SessionMeta, req: AnalysisRequest): Promise<{ status: 'queued' }> {
    const { analyses, sessions, quotas, now } = this.deps;
    const { sessionId } = meta;
    // Demo sessions use the precomputed fixture (Req 13.2); the interview locks the map.
    if (meta.mode === 'demo' || meta.stage === 'interview' || meta.stage === 'report') {
      throw new ApiError('CONFLICT');
    }
    // The key must be one we issued for this session (Req 4.3).
    if (req.resume.kind === 'upload' && !req.resume.key.startsWith(resumeKeyPrefix(sessionId))) {
      throw new ApiError('VALIDATION', undefined, { 'resume.key': 'invalid_key' });
    }
    // Cheap pre-check so a double submit doesn't burn a quota unit.
    if (inProgress(await analyses.getAnalysis(sessionId))) throw new ApiError('CONFLICT');
    await quotas.consumeSession(sessionId, 'analyses');
    await analyses.queue(sessionId, meta.ttl, new Date(now()).toISOString());
    await analyses.putInput(
      sessionId,
      meta.ttl,
      req.resume.kind === 'text'
        ? { resumeKind: 'text', resumeText: req.resume.text, job: req.job }
        : { resumeKind: 'pdf', resumeKey: req.resume.key, job: req.job },
    );
    await sessions.setStage(sessionId, 'analysis');
    await this.invokeWorker(meta);
    return { status: 'queued' };
  }

  async get(meta: SessionMeta): Promise<AnalysisStatusResponse> {
    const stored = await this.deps.analyses.getAnalysis(meta.sessionId);
    if (!stored) throw new ApiError('NOT_FOUND');
    switch (stored.status) {
      case 'queued':
      case 'running': {
        // A lost invoke or a worker that hit its timeout never finishes (Req 5.5).
        const age = this.deps.now() - Date.parse(stored.startedAt);
        if (!(age <= LIMITS.analysis.staleAfterSec * 1000)) {
          return { status: 'failed', errorCode: 'UPSTREAM_UNAVAILABLE' };
        }
        return stored.status === 'queued'
          ? { status: 'queued' }
          : { status: 'running', stage: stored.stage };
      }
      case 'failed':
        return { status: 'failed', errorCode: stored.errorCode };
      case 'ready':
        return {
          status: 'ready',
          evidenceMap: stored.evidenceMap,
          resumeText: stored.resumeText,
          truncated: stored.truncated,
          precomputed: stored.precomputed,
        };
    }
  }

  private async invokeWorker(meta: SessionMeta): Promise<void> {
    const payload: AnalysisWorkerEvent = { sessionId: meta.sessionId };
    try {
      await this.deps.lambda.send(
        new InvokeCommand({
          FunctionName: this.deps.workerFunctionName,
          InvocationType: 'Event',
          Payload: new TextEncoder().encode(JSON.stringify(payload)),
        }),
      );
    } catch (err) {
      this.deps.log.error('worker_invoke_failed', err);
      await this.deps.analyses.putFailed(meta.sessionId, meta.ttl, 'UPSTREAM_UNAVAILABLE');
      throw new ApiError('UPSTREAM_UNAVAILABLE');
    }
  }
}
