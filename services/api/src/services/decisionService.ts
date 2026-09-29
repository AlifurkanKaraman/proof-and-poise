/**
 * `POST …/recommendations/{recId}/decision` and `POST …/confirmations` (Req 6.4, 7.5–7.6,
 * 8.1–8.5, design §6.3, §7). The service loads the evidence map, runs the pure updates from
 * `packages/shared`, validates the result, and saves it under an optimistic lock. The model is
 * used only to phrase one rewrite for a confirmation; grounding and scores stay deterministic.
 */
import {
  applyConfirmation,
  applyDecision,
  confirmedCount,
  EvidenceMapSchema,
  LIMITS,
  type ConfirmationRequest,
  type ConfirmationResponse,
  type DecisionRequest,
  type DecisionResponse,
} from '@proof-and-poise/shared';
import { confirmRewriteRequest } from '../ai/prompts/confirmRewrite';
import { invokeStructured, type ModelDeps } from '../ai/invokeStructured';
import type { AnalysisRepository } from '../data/analysisRepository';
import type { QuotaCounters } from '../data/quotas';
import type { SessionMeta } from '../data/sessionRepository';
import { ApiError } from '../lib/errors';
import type { Logger } from '../lib/logger';

export interface DecisionServiceDeps {
  analyses: Pick<AnalysisRepository, 'getReady' | 'getAnalysis' | 'saveEvidenceMap'>;
  quotas: Pick<QuotaCounters, 'consumeSession'>;
  model: ModelDeps;
  log: Logger;
  now: () => number;
}

export class DecisionService {
  constructor(private readonly deps: DecisionServiceDeps) {}

  async decide(meta: SessionMeta, recId: string, req: DecisionRequest): Promise<DecisionResponse> {
    const { ready, rev } = await this.loadEditable(meta);
    const result = applyDecision({
      map: ready.evidenceMap,
      resumeText: ready.resumeText,
      recId,
      decision: req.decision,
      at: this.at(),
    });
    if (!result.ok) {
      if (result.error === 'not_found') throw new ApiError('NOT_FOUND');
      // Req 7.4: missing-evidence recommendations offer no "Accept".
      throw new ApiError('VALIDATION', undefined, { decision: 'accept_not_allowed' });
    }
    const map = this.validated(result.map);
    await this.deps.analyses.saveEvidenceMap(meta.sessionId, rev, map);
    return {
      recommendation: result.recommendation,
      scores: map.scores,
      scoreEvent: result.scoreEvent,
    };
  }

  async confirm(meta: SessionMeta, req: ConfirmationRequest): Promise<ConfirmationResponse> {
    const { ready, rev } = await this.loadEditable(meta);
    const competency = ready.evidenceMap.competencies.find((c) => c.id === req.competencyId);
    if (!competency) throw new ApiError('NOT_FOUND');
    // Cheap pre-checks so an ineligible request never reaches the model (Req 8.1, 8.4).
    if (competency.confirmationState === 'confirmed') throw new ApiError('CONFLICT');
    if (confirmedCount(ready.evidenceMap) >= LIMITS.confirmation.maxPerSession) {
      throw new ApiError('QUOTA_EXCEEDED');
    }
    if (competency.strength !== 'weak' && competency.strength !== 'none') {
      throw new ApiError('VALIDATION', undefined, { competencyId: 'not_eligible' });
    }

    // Demo sessions never call the model (Req 13.2, budget): the confirmation still counts.
    const rewrite =
      meta.mode === 'demo' ? null : await this.rewrite(ready.resumeText, competency, req.statement);
    const result = applyConfirmation({
      map: ready.evidenceMap,
      resumeText: ready.resumeText,
      competencyId: req.competencyId,
      statement: req.statement,
      rewrite,
      at: this.at(),
    });
    if (!result.ok) {
      switch (result.error) {
        case 'not_found':
          throw new ApiError('NOT_FOUND');
        case 'already_confirmed':
          throw new ApiError('CONFLICT');
        case 'limit_reached':
          throw new ApiError('QUOTA_EXCEEDED');
        case 'not_eligible':
          throw new ApiError('VALIDATION', undefined, { competencyId: 'not_eligible' });
      }
    }
    const map = this.validated(result.map);
    // Atomic per-session counter, taken only once the confirmation is certain to be stored.
    await this.deps.quotas.consumeSession(meta.sessionId, 'confirmations');
    await this.deps.analyses.saveEvidenceMap(meta.sessionId, rev, map);
    return {
      competency: result.competency,
      ...(result.recommendation ? { recommendation: result.recommendation } : {}),
      scores: map.scores,
      scoreEvent: result.scoreEvent,
    };
  }

  /**
   * One model call for the rewrite. A failure never blocks the confirmation itself: the
   * candidate's statement is stored as evidence and the recommendation is simply omitted.
   * A spent daily budget is the exception, so callers see `CAPACITY_REACHED` (Req 16.4).
   */
  private async rewrite(
    resumeText: string,
    competency: { name: string; description: string },
    statement: string,
  ) {
    const { model, now, log } = this.deps;
    try {
      const out = await invokeStructured(
        model,
        confirmRewriteRequest(
          resumeText,
          competency,
          statement,
          now() + LIMITS.confirmation.rewriteTimeoutSec * 1000,
        ),
      );
      return out.recommendation;
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CAPACITY_REACHED') throw err;
      log.warn('confirm_rewrite_skipped', {
        errorCode: err instanceof ApiError ? err.code : 'INTERNAL',
      });
      return null;
    }
  }

  /** Locked once the interview starts (Req 7.5); needs a finished analysis. */
  private async loadEditable(meta: SessionMeta) {
    if (meta.stage === 'interview' || meta.stage === 'report') throw new ApiError('CONFLICT');
    const found = await this.deps.analyses.getReady(meta.sessionId);
    if (found) return found;
    // No analysis yet is "not found"; one that is queued, running, or failed is a conflict.
    throw new ApiError(
      (await this.deps.analyses.getAnalysis(meta.sessionId)) ? 'CONFLICT' : 'NOT_FOUND',
    );
  }

  private validated(map: unknown) {
    const parsed = EvidenceMapSchema.safeParse(map);
    if (!parsed.success) throw new ApiError('INTERNAL');
    return parsed.data;
  }

  private at(): string {
    return new Date(this.deps.now()).toISOString();
  }
}
