/**
 * `POST/GET /interview` and `POST …/turns/{turnId}/answer` (Req 9.1, 9.3–9.4, 11.1–11.5,
 * 13.4; design §7.3, §8). The model writes questions and rubric feedback only. The plan
 * composition, the weighted score, the follow-up rule, quotas, and score events are
 * deterministic code from `packages/shared`. Demo sessions never call the model: they use the
 * labeled sample plan and feedback (Req 13.4).
 */
import {
  advanceInterview,
  applyInterviewToMap,
  buildEvaluation,
  DEMO_INTERVIEW_PLAN,
  DEMO_SAMPLE_FEEDBACK,
  EvidenceMapSchema,
  expectsStar,
  initialInterview,
  InterviewStateSchema,
  LIMITS,
  selectGapCompetency,
  selectPlan,
  type AnswerRequest,
  type AnswerResponse,
  type Competency,
  type DemoTurnLabel,
  type Evaluation,
  type InterviewState,
  type PlannedQuestion,
  type Turn,
} from '@proof-and-poise/shared';
import { evaluateAnswerRequest } from '../ai/prompts/evaluateAnswer';
import { generateQuestionsRequest } from '../ai/prompts/generateQuestions';
import { invokeStructured, type ModelDeps } from '../ai/invokeStructured';
import type { AnalysisRepository } from '../data/analysisRepository';
import type { InterviewRepository, StoredInterview } from '../data/interviewRepository';
import type { QuotaCounters } from '../data/quotas';
import type { SessionMeta, SessionRepository } from '../data/sessionRepository';
import { ApiError } from '../lib/errors';
import type { Logger } from '../lib/logger';

export interface InterviewServiceDeps {
  interviews: Pick<InterviewRepository, 'get' | 'create' | 'save'>;
  analyses: Pick<AnalysisRepository, 'getReady' | 'getAnalysis' | 'getInput' | 'saveEvidenceMap'>;
  sessions: Pick<SessionRepository, 'setStage'>;
  quotas: Pick<QuotaCounters, 'consumeSession'>;
  model: ModelDeps;
  log: Logger;
  now: () => number;
}

const DEMO_LABELS: readonly string[] = Object.keys(DEMO_SAMPLE_FEEDBACK);

/** Which per-session quota an answer on this turn counts against (design §5, Req 16). */
const quotaFor = (kind: Turn['kind']) =>
  kind === 'follow_up'
    ? 'followUpEvaluations'
    : kind === 'practice'
      ? 'practiceEvaluations'
      : 'primaryEvaluations';

export class InterviewService {
  constructor(private readonly deps: InterviewServiceDeps) {}

  /** Idempotent: a second call returns the stored plan's state (design §8). Locks decisions. */
  async start(meta: SessionMeta): Promise<InterviewState> {
    const existing = await this.deps.interviews.get(meta.sessionId);
    if (existing) {
      await this.lockDecisions(meta);
      return existing.state;
    }

    const { ready } = await this.loadReady(meta);
    const plan = meta.mode === 'demo' ? [...DEMO_INTERVIEW_PLAN] : await this.plan(meta, ready);
    const state = initialInterview(plan);
    const created = await this.deps.interviews.create(meta.sessionId, meta.ttl, { state, plan });
    // Lost a race with a concurrent start: return what the winner stored.
    const stored = created ? { state } : await this.deps.interviews.get(meta.sessionId);
    if (!stored) throw new ApiError('CONFLICT');
    await this.lockDecisions(meta);
    return this.validState(stored.state);
  }

  async get(meta: SessionMeta): Promise<InterviewState> {
    const stored = await this.deps.interviews.get(meta.sessionId);
    if (!stored) throw new ApiError('NOT_FOUND');
    return stored.state;
  }

  async answer(meta: SessionMeta, turnId: string, req: AnswerRequest): Promise<AnswerResponse> {
    const stored = await this.deps.interviews.get(meta.sessionId);
    if (!stored) throw new ApiError('NOT_FOUND');
    const turn = stored.state.turns.find((t) => t.id === turnId);
    if (!turn) throw new ApiError('NOT_FOUND');
    // Idempotent per turn: a second submission is a 409, and the client refetches (design §8).
    if (turn.status === 'evaluated') throw new ApiError('CONFLICT');

    const { ready, rev: mapRev } = await this.loadReady(meta);
    const evaluation =
      meta.mode === 'demo' ? this.sample(turn) : await this.evaluate(turn, req, ready);

    const advanced = advanceInterview({
      state: stored.state,
      plan: stored.plan,
      turnId,
      answer: { text: req.text, source: req.source, edited: req.edited },
      evaluation,
    });
    if (!advanced.ok) {
      throw new ApiError(advanced.error === 'not_found' ? 'NOT_FOUND' : 'CONFLICT');
    }

    const state = this.validState(advanced.state);
    const { map } = applyInterviewToMap({
      map: ready.evidenceMap,
      state,
      reason: 'Your interview answer was scored.',
      sourceRef: `turn:${turnId}`,
      at: new Date(this.deps.now()).toISOString(),
    });
    const parsedMap = EvidenceMapSchema.safeParse(map);
    if (!parsedMap.success) throw new ApiError('INTERNAL');

    // Quotas are taken once the evaluation is certain to be stored (a failed model call
    // never burns the candidate's attempts), then the state is saved under its revision lock.
    await this.deps.quotas.consumeSession(meta.sessionId, 'evaluations');
    await this.deps.quotas.consumeSession(meta.sessionId, quotaFor(turn.kind));
    await this.deps.interviews.save(meta.sessionId, meta.ttl, stored.rev, {
      state,
      plan: stored.plan,
    });
    await this.deps.analyses.saveEvidenceMap(meta.sessionId, mapRev, parsedMap.data);
    return { evaluation, next: advanced.next };
  }

  /** One `generateQuestions` call; the server picks the 2+2+GAP plan (Req 9.1). */
  private async plan(
    meta: SessionMeta,
    ready: NonNullable<Awaited<ReturnType<AnalysisRepository['getReady']>>>['ready'],
  ): Promise<PlannedQuestion[]> {
    const { model, now } = this.deps;
    const competencies = ready.evidenceMap.competencies;
    const gap = selectGapCompetency(competencies);
    const input = await this.deps.analyses.getInput(meta.sessionId);
    const out = await invokeStructured(
      model,
      generateQuestionsRequest(
        {
          role: input?.job.role ?? 'the target role',
          company: input?.job.company,
          interviewType: input?.job.interviewType ?? 'behavioral_mixed',
          competencies,
          gap,
        },
        now() + LIMITS.interview.modelTimeoutSec * 1000,
      ),
    );
    try {
      return selectPlan({
        competencies,
        behavioral: out.behavioral,
        roleSpecific: out.roleSpecific,
        gap: out.evidenceGap,
      });
    } catch {
      throw new ApiError('MODEL_OUTPUT_INVALID');
    }
  }

  private async evaluate(
    turn: Turn,
    req: AnswerRequest,
    ready: NonNullable<Awaited<ReturnType<AnalysisRepository['getReady']>>>['ready'],
  ): Promise<Evaluation> {
    const { model, now } = this.deps;
    const targets: Competency[] = ready.evidenceMap.competencies.filter((c) =>
      turn.competencyIds.includes(c.id),
    );
    // The outline may use the resume and what the candidate confirmed (Req 11.5).
    const confirmed = ready.evidenceMap.competencies.flatMap((c) =>
      c.evidence.filter((e) => e.source === 'candidate_confirmation').map((e) => e.quote),
    );
    const resumeText =
      confirmed.length > 0
        ? `${ready.resumeText}\n\nConfirmed by the candidate:\n${confirmed.join('\n')}`
        : ready.resumeText;

    const out = await invokeStructured(
      model,
      evaluateAnswerRequest(
        { turn, competencies: targets, answer: req.text, resumeText },
        now() + LIMITS.interview.modelTimeoutSec * 1000,
      ),
    );
    return buildEvaluation({
      // STAR is scored on behavioral primaries only; drop a stray value elsewhere.
      dimensions: { ...out.dimensions, star: expectsStar(turn) ? out.dimensions.star : null },
      strength: out.strength,
      improvement: out.improvement,
      strongerOutline: out.strongerOutline,
      candidateFollowUp: out.candidateFollowUp,
      feedbackSource: 'live',
    });
  }

  /** Labeled sample feedback for demo sessions (Req 13.4); follow-ups reuse the "1a" sample. */
  private sample(turn: Turn): Evaluation {
    const label = turn.kind === 'practice' && turn.label === '1' ? '1a' : turn.label;
    const key = (DEMO_LABELS.includes(label) ? label : '1a') as DemoTurnLabel;
    return JSON.parse(JSON.stringify(DEMO_SAMPLE_FEEDBACK[key])) as Evaluation;
  }

  /** The interview needs a finished analysis; a missing one is "not found", a busy one 409. */
  private async loadReady(meta: SessionMeta) {
    const found = await this.deps.analyses.getReady(meta.sessionId);
    if (found) return found;
    throw new ApiError(
      (await this.deps.analyses.getAnalysis(meta.sessionId)) ? 'CONFLICT' : 'NOT_FOUND',
    );
  }

  /** Starting the interview locks accept/reject/confirm (Req 7.5). */
  private async lockDecisions(meta: SessionMeta): Promise<void> {
    if (meta.stage === 'interview' || meta.stage === 'report') return;
    await this.deps.sessions.setStage(meta.sessionId, 'interview');
  }

  private validState(state: InterviewState): InterviewState {
    const parsed = InterviewStateSchema.safeParse(state);
    if (!parsed.success) throw new ApiError('INTERNAL');
    return parsed.data;
  }
}

export type { StoredInterview };
