import {
  AnalysisStageSchema,
  canPracticeAgain,
  capStrength,
  competencyReadiness,
  decideFollowUp,
  DEMO_EVIDENCE_MAP,
  DEMO_INTERVIEW_PLAN,
  DEMO_RESUME_TEXT,
  DEMO_SAMPLE_ANSWERS,
  DEMO_SAMPLE_FEEDBACK,
  diffScoreSets,
  gapWeight,
  interviewPerformance,
  interviewReadiness,
  LIMITS,
  questionScore,
  READINESS_WEIGHTS,
  recomputeScores,
  STRENGTH_ORDER,
  toScore100,
  type AnalysisRequest,
  type AudioContentType,
  type AnalysisStatusResponse,
  type AnswerRequest,
  type AnswerResponse,
  type ConfirmationRequest,
  type ConfirmationResponse,
  type CreateSessionResponse,
  type DecisionRequest,
  type DecisionResponse,
  type DemoTurnLabel,
  type ErrorCode,
  type Evaluation,
  type EvidenceMap,
  type Importance,
  type InterviewState,
  type PresignedPostResponse,
  type Report,
  type ScoreEvent,
  type ScoreSet,
  type SessionMode,
  type SessionStage,
  type SessionSummary,
  type Strength,
  type TranscriptionStatusResponse,
  type Turn,
} from '@proof-and-poise/shared';
import { MOCK_ACTIONS, MOCK_REPORT_SUMMARY, MOCK_STAR_OUTLINES } from './reportContent';

/**
 * In-memory backend for the mock API, backed by the fictional demo fixtures (design §15).
 * It follows the contract and the shared deterministic rules (scores, strength caps, the
 * follow-up rule) so screens behave like the real API. Every analysis returns the demo map.
 */

/** Thrown by mock operations; handlers turn it into `{ error: { code, message } }`. */
export class MockApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** Presigned uploads in mock mode go here; a handler accepts them with 204. */
export const MOCK_UPLOAD_URL = 'https://uploads.mock.invalid/';

export interface MockSession {
  id: string;
  token: string;
  mode: SessionMode;
  expiresAt: string;
  stage: SessionStage;
  /** Null until analysis starts. */
  analysisStartedAt: number | null;
  map: EvidenceMap;
  resumeText: string;
  interview: InterviewState | null;
  /** Transcription polls per turn ID. */
  transcriptions: Record<string, number>;
  report: Report | null;
  counters: {
    analyses: number;
    events: number;
    evidence: number;
    practice: number;
    evaluations: number;
    reports: number;
  };
}

export interface MockDbOptions {
  now?: () => number;
  /** Mock analysis duration across its stages (standard sessions). Default 4 s. */
  analysisMs?: number;
  /** Persist sessions (browser mock mode) so a reload keeps them, like the real API. */
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
}

const DB_STORAGE_KEY = 'proof-and-poise.mockDb';
const PRIMARY_KINDS: readonly Turn['kind'][] = ['behavioral', 'role_specific', 'evidence_gap'];
const ANALYSIS_STEPS = ['queued', ...AnalysisStageSchema.options] as const;

const clone = <T>(v: T): T => structuredClone(v);

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(LIMITS.session.tokenBytes));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const isDemoLabel = (label: string): label is DemoTurnLabel =>
  Object.hasOwn(DEMO_SAMPLE_ANSWERS, label);

const maxStrength = (a: Strength, b: Strength): Strength =>
  STRENGTH_ORDER.indexOf(a) >= STRENGTH_ORDER.indexOf(b) ? a : b;

export interface ScoredQuestionRow {
  primary: Turn;
  followUps: Turn[];
  practiceAttempts: Turn[];
  originalScore: number | null;
  bestScore: number | null;
}

/** Group turns per primary question and apply the question-score rule (design §6.2). */
export function questionRows(state: InterviewState): ScoredQuestionRow[] {
  return state.turns
    .filter((t) => PRIMARY_KINDS.includes(t.kind))
    .map((primary) => {
      const followUps = state.turns.filter(
        (t) => t.kind === 'follow_up' && t.parentTurnId === primary.id,
      );
      const practiceAttempts = state.turns.filter(
        // Only answered attempts, as in shared `reportQuestions`.
        (t) => t.kind === 'practice' && t.parentTurnId === primary.id && t.evaluation !== undefined,
      );
      const p = primary.evaluation?.weightedScore;
      if (p === undefined) {
        return { primary, followUps, practiceAttempts, originalScore: null, bestScore: null };
      }
      const fu = followUps[0]?.evaluation?.weightedScore ?? null;
      const practice = practiceAttempts.flatMap((t) =>
        t.evaluation ? [t.evaluation.weightedScore] : [],
      );
      return {
        primary,
        followUps,
        practiceAttempts,
        originalScore: questionScore(p, fu),
        bestScore: questionScore(p, fu, practice),
      };
    });
}

export function createMockDb(options: MockDbOptions = {}) {
  const now = options.now ?? (() => Date.now());
  const analysisMs = options.analysisMs ?? 4_000;
  const sessions = new Map<string, MockSession>();

  if (options.storage) {
    try {
      const saved = JSON.parse(options.storage.getItem(DB_STORAGE_KEY) ?? '[]') as MockSession[];
      for (const s of saved) sessions.set(s.id, s);
    } catch {
      // Ignore a corrupt snapshot; start empty.
    }
  }
  const persist = () =>
    options.storage?.setItem(DB_STORAGE_KEY, JSON.stringify([...sessions.values()]));

  const iso = () => new Date(now()).toISOString();
  const nextId = (s: MockSession, key: keyof MockSession['counters'], prefix: string) =>
    `${prefix}${++s.counters[key]}`;

  function recordEvents(
    s: MockSession,
    before: ScoreSet,
    after: ScoreSet,
    reason: string,
    sourceRef: string,
  ): ScoreEvent[] {
    const events = diffScoreSets(before, after, {
      reason,
      sourceRef,
      at: iso(),
      makeId: () => nextId(s, 'events', 'ev'),
    });
    s.map.scoreEvents.push(...events);
    return events;
  }

  function requireReady(s: MockSession) {
    if (analysisStatus(s).status !== 'ready') {
      throw new MockApiError('CONFLICT', 'The analysis is not ready yet.');
    }
  }

  function requireInterview(s: MockSession): InterviewState {
    if (!s.interview) throw new MockApiError('NOT_FOUND', 'The interview has not started.');
    return s.interview;
  }

  function findTurn(state: InterviewState, turnId: string): Turn {
    const turn = state.turns.find((t) => t.id === turnId);
    if (!turn) throw new MockApiError('NOT_FOUND', 'Turn not found.');
    return turn;
  }

  function primaryTurn(index: number): Turn {
    const planned = DEMO_INTERVIEW_PLAN[index - 1];
    if (!planned) throw new MockApiError('INTERNAL', 'No planned question.');
    return {
      id: `t${index}`,
      index,
      label: String(index),
      kind: planned.kind,
      competencyIds: planned.competencyIds,
      question: planned.question,
      status: 'asked',
    };
  }

  function sampleEvaluation(turn: Turn): Evaluation {
    // Practice on the vague first answer uses the improved sample, so practice can help.
    const label = turn.kind === 'practice' && turn.label === '1' ? '1a' : turn.label;
    return clone(DEMO_SAMPLE_FEEDBACK[isDemoLabel(label) ? label : '1a']);
  }

  function importanceById(s: MockSession): Record<string, Importance> {
    return Object.fromEntries(s.map.competencies.map((c) => [c.id, c.importance]));
  }

  function performance(s: MockSession): number | null {
    const rows = questionRows(requireInterview(s)).flatMap((r) =>
      r.bestScore === null ? [] : [{ score: r.bestScore, competencyIds: r.primary.competencyIds }],
    );
    return interviewPerformance(rows, importanceById(s));
  }

  // --- Sessions ----------------------------------------------------------------

  function createSession(mode: SessionMode): CreateSessionResponse {
    const id = crypto.randomUUID();
    const session: MockSession = {
      id,
      token: randomToken(),
      mode,
      expiresAt: new Date(now() + LIMITS.session.ttlHours * 3_600_000).toISOString(),
      // Demo sessions are seeded with the precomputed analysis (Req 13.2).
      stage: mode === 'demo' ? 'analysis' : 'setup',
      analysisStartedAt: mode === 'demo' ? now() : null,
      map: clone(DEMO_EVIDENCE_MAP),
      resumeText: DEMO_RESUME_TEXT,
      interview: null,
      transcriptions: {},
      report: null,
      counters: { analyses: 0, events: 0, evidence: 0, practice: 0, evaluations: 0, reports: 0 },
    };
    sessions.set(id, session);
    persist();
    return { sessionId: id, sessionToken: session.token, expiresAt: session.expiresAt };
  }

  /** The session when the bearer token matches; null otherwise (never reveals existence, Req 2.2). */
  function authorize(sessionId: string | undefined, token: string | null): MockSession | null {
    const s = sessionId === undefined ? undefined : sessions.get(sessionId);
    if (!s || token === null || s.token !== token || Date.parse(s.expiresAt) <= now()) return null;
    return s;
  }

  function summary(s: MockSession): SessionSummary {
    return { sessionId: s.id, mode: s.mode, stage: s.stage, expiresAt: s.expiresAt };
  }

  function deleteSession(s: MockSession) {
    sessions.delete(s.id);
    persist();
  }

  function presignResume(s: MockSession): PresignedPostResponse {
    const key = `resumes/${s.id}/resume.pdf`;
    return {
      url: MOCK_UPLOAD_URL,
      fields: { key, 'Content-Type': LIMITS.resumeUpload.contentType },
      key,
      expiresIn: LIMITS.resumeUpload.presignExpiresSec,
    };
  }

  // --- Analysis ------------------------------------------------------------------

  function analysisStatus(s: MockSession): AnalysisStatusResponse {
    if (s.analysisStartedAt === null) {
      throw new MockApiError('NOT_FOUND', 'No analysis has been started.');
    }
    const precomputed = s.mode === 'demo';
    const step = precomputed
      ? ANALYSIS_STEPS.length
      : Math.floor((now() - s.analysisStartedAt) / (analysisMs / ANALYSIS_STEPS.length));
    const current = ANALYSIS_STEPS[step];
    if (current === 'queued') return { status: 'queued' };
    if (current !== undefined) return { status: 'running', stage: current };
    return {
      status: 'ready',
      evidenceMap: s.map,
      resumeText: s.resumeText,
      truncated: false,
      precomputed,
    };
  }

  function startAnalysis(s: MockSession, _req: AnalysisRequest): { status: 'queued' } {
    if (s.interview) throw new MockApiError('CONFLICT', 'The interview has already started.');
    if (s.counters.analyses >= LIMITS.quotas.analyses) {
      throw new MockApiError('QUOTA_EXCEEDED', 'You have used all analyses for this session.');
    }
    s.counters.analyses++;
    // The mock ignores the submitted inputs and always returns the demo map.
    s.map = clone(DEMO_EVIDENCE_MAP);
    s.resumeText = DEMO_RESUME_TEXT;
    s.analysisStartedAt = now();
    s.stage = 'analysis';
    persist();
    return { status: 'queued' };
  }

  // --- Decisions and confirmations ---------------------------------------------------

  const DECISION_STATE = { accept: 'accepted', reject: 'rejected', reset: 'pending' } as const;

  function decide(s: MockSession, recId: string, req: DecisionRequest): DecisionResponse {
    requireReady(s);
    if (s.interview) {
      throw new MockApiError('CONFLICT', 'Decisions are locked once the interview starts.');
    }
    const rec = s.map.recommendations.find((r) => r.id === recId);
    if (!rec) throw new MockApiError('NOT_FOUND', 'Recommendation not found.');
    rec.decision = DECISION_STATE[req.decision];

    const before = s.map.scores;
    const { scores, keywords } = recomputeScores(s.map, s.resumeText);
    s.map.keywords = keywords;
    s.map.scores = scores;
    const reason =
      rec.trustLabel === 'rewording_only'
        ? "Rewording improves clarity. It doesn't add evidence."
        : `You ${rec.decision === 'pending' ? 'undid a decision on' : rec.decision} a suggested change.`;
    const events = recordEvents(s, before, scores, reason, `recommendation:${rec.id}`);
    persist();
    return { recommendation: rec, scores, scoreEvent: events[0] ?? null };
  }

  function confirm(s: MockSession, req: ConfirmationRequest): ConfirmationResponse {
    requireReady(s);
    const confirmed = s.map.competencies.filter((c) => c.confirmationState === 'confirmed').length;
    if (confirmed >= LIMITS.confirmation.maxPerSession) {
      throw new MockApiError('QUOTA_EXCEEDED', 'You have used all confirmations for this session.');
    }
    const competency = s.map.competencies.find((c) => c.id === req.competencyId);
    if (!competency) throw new MockApiError('NOT_FOUND', 'Competency not found.');
    if (competency.confirmationState === 'confirmed') {
      throw new MockApiError('CONFLICT', 'You already confirmed this competency.');
    }

    const evidenceId = nextId(s, 'evidence', 'k');
    competency.evidence.push({
      id: evidenceId,
      source: 'candidate_confirmation',
      quote: req.statement,
    });
    // The server caps confirmation-only evidence at moderate (Req 8.2, design §6.1).
    competency.strength = capStrength(
      maxStrength(competency.strength, 'moderate'),
      competency.evidence,
    ).strength;
    competency.confirmationState = 'confirmed';
    competency.interviewPriority = true;
    competency.readiness = competencyReadiness(competency.strength, null);

    const rec = s.map.recommendations.find(
      (r) => r.competencyId === competency.id && r.trustLabel === 'missing_evidence',
    );
    if (rec) {
      rec.trustLabel = 'confirmed_by_candidate';
      rec.proposedText = req.statement;
      rec.sourceEvidenceIds = [evidenceId];
    }

    const before = s.map.scores;
    const { scores, keywords } = recomputeScores(s.map, s.resumeText);
    s.map.keywords = keywords;
    s.map.scores = scores;
    const events = recordEvents(
      s,
      before,
      scores,
      `You confirmed ${competency.name} experience.`,
      `confirmation:${competency.id}`,
    );
    persist();
    return {
      competency,
      ...(rec ? { recommendation: rec } : {}),
      scores,
      scoreEvent: events.find((e) => e.metric === 'jobMatch') ?? events[0] ?? null,
    };
  }

  // --- Interview ---------------------------------------------------------------------

  function startInterview(s: MockSession): InterviewState {
    requireReady(s);
    // Idempotent: a second call returns the existing plan (design §8).
    s.interview ??= {
      turns: [primaryTurn(1)],
      total: LIMITS.interview.primaryQuestions,
      followUpsUsed: 0,
      status: 'in_progress',
    };
    s.stage = s.stage === 'report' ? 'report' : 'interview';
    persist();
    return s.interview;
  }

  function nextPrimary(state: InterviewState, afterIndex: number): Turn | null {
    if (afterIndex >= LIMITS.interview.primaryQuestions) {
      state.status = 'complete';
      return null;
    }
    const turn = primaryTurn(afterIndex + 1);
    state.turns.push(turn);
    return turn;
  }

  function submitAnswer(s: MockSession, turnId: string, answer: AnswerRequest): AnswerResponse {
    const state = requireInterview(s);
    const turn = findTurn(state, turnId);
    if (turn.status === 'evaluated') {
      throw new MockApiError('CONFLICT', 'This answer was already evaluated.');
    }
    if (s.counters.evaluations >= LIMITS.quotas.evaluations) {
      throw new MockApiError('QUOTA_EXCEEDED', 'You have used all answer evaluations.');
    }
    s.counters.evaluations++;
    const evaluation = sampleEvaluation(turn);
    turn.answer = { ...answer };
    turn.evaluation = evaluation;
    turn.status = 'evaluated';

    let next: Turn | null = null;
    if (turn.kind === 'follow_up') {
      next = nextPrimary(state, turn.index);
    } else if (turn.kind !== 'practice') {
      const decision = decideFollowUp({
        followUpsUsed: state.followUpsUsed,
        primaryIndex: turn.index,
        dimensions: evaluation.dimensions,
        candidateFollowUp: evaluation.candidateFollowUp,
      });
      if (decision.ask) {
        state.followUpsUsed++;
        next = {
          id: `${turn.id}a`,
          index: turn.index,
          label: `${turn.index}a`,
          kind: 'follow_up',
          parentTurnId: turn.id,
          competencyIds: turn.competencyIds,
          question: decision.text,
          status: 'asked',
        };
        state.turns.push(next);
      } else {
        next = nextPrimary(state, turn.index);
      }
    } else {
      // A new best attempt can change the report; regenerate it on the next request.
      s.report = null;
    }

    const p = performance(s);
    const before = s.map.scores;
    const after: ScoreSet = {
      ...before,
      interviewReadiness: p === null ? null : interviewReadiness(p, before.jobMatch),
    };
    s.map.scores = after;
    recordEvents(s, before, after, 'Your interview answer was scored.', `turn:${turn.id}`);
    persist();
    return { evaluation, next };
  }

  function startPractice(s: MockSession, turnId: string): { turn: Turn } {
    const state = requireInterview(s);
    const parent = findTurn(state, turnId);
    if (!PRIMARY_KINDS.includes(parent.kind) || parent.status !== 'evaluated') {
      throw new MockApiError('CONFLICT', 'Practice is available for evaluated primary questions.');
    }
    // Same rules as the API (Req 12.3): an open attempt is reused, and only questions still
    // below Proficient can be practiced.
    const open = state.turns.find(
      (t) => t.kind === 'practice' && t.parentTurnId === parent.id && t.status === 'asked',
    );
    if (open) return { turn: open };
    const best = questionRows(state).find((r) => r.primary.id === parent.id)?.bestScore ?? null;
    if (best === null || !canPracticeAgain(best)) {
      throw new MockApiError('CONFLICT', 'This question is already at Proficient or above.');
    }
    if (s.counters.practice >= LIMITS.quotas.practiceEvaluations) {
      throw new MockApiError('QUOTA_EXCEEDED', 'You have used all practice attempts.');
    }
    const turn: Turn = {
      id: nextId(s, 'practice', 'p'),
      index: parent.index,
      label: parent.label,
      kind: 'practice',
      parentTurnId: parent.id,
      competencyIds: parent.competencyIds,
      question: parent.question,
      status: 'asked',
    };
    state.turns.push(turn);
    persist();
    return { turn };
  }

  function presignAudio(
    s: MockSession,
    turnId: string,
    contentType: AudioContentType = 'audio/webm',
  ): PresignedPostResponse {
    findTurn(requireInterview(s), turnId);
    // Same key shape as the real API: the extension carries the media format (Req 10.4).
    const key = `audio/${s.id}/${turnId}.${contentType.slice('audio/'.length)}`;
    return {
      url: MOCK_UPLOAD_URL,
      fields: { key, 'Content-Type': contentType },
      key,
      expiresIn: LIMITS.audioUpload.presignExpiresSec,
    };
  }

  function startTranscription(s: MockSession, turnId: string): { status: 'transcribing' } {
    findTurn(requireInterview(s), turnId);
    s.transcriptions[turnId] = 0;
    persist();
    return { status: 'transcribing' };
  }

  /** First poll reports `transcribing`; the next returns the turn's fictional sample answer. */
  function getTranscription(s: MockSession, turnId: string): TranscriptionStatusResponse {
    const turn = findTurn(requireInterview(s), turnId);
    const polls = s.transcriptions[turnId];
    if (polls === undefined) throw new MockApiError('NOT_FOUND', 'No transcription was started.');
    s.transcriptions[turnId] = polls + 1;
    persist();
    if (polls === 0) return { status: 'transcribing' };
    return {
      status: 'ready',
      text: DEMO_SAMPLE_ANSWERS[isDemoLabel(turn.label) ? turn.label : '1a'],
    };
  }

  // --- Report ------------------------------------------------------------------------

  function buildReport(s: MockSession): Report {
    const state = requireInterview(s);
    const rows = questionRows(state);
    const p = performance(s) ?? 0;
    const { jobMatch } = s.map.scores;
    const bestFor = (competencyId: string) => {
      const scores = rows.flatMap((r) =>
        r.bestScore !== null && r.primary.competencyIds.includes(competencyId) ? [r.bestScore] : [],
      );
      return scores.length > 0 ? Math.max(...scores) : null;
    };
    return {
      readiness: {
        score: interviewReadiness(p, jobMatch),
        interviewPerformance: toScore100(100 * p),
        jobMatch,
        performanceWeight: READINESS_WEIGHTS.performance,
        jobMatchWeight: READINESS_WEIGHTS.jobMatch,
      },
      summary: MOCK_REPORT_SUMMARY,
      competencies: s.map.competencies.map((c) => {
        const bestScore = bestFor(c.id);
        return {
          competencyId: c.id,
          name: c.name,
          readiness: competencyReadiness(c.strength, bestScore),
          bestScore,
        };
      }),
      questions: rows,
      strongestEvidence: s.map.competencies
        .filter((c) => c.strength === 'strong')
        .flatMap((c) => {
          const e = c.evidence.find((x) => x.source === 'resume');
          return e
            ? [{ competencyId: c.id, evidenceId: e.id, source: e.source, quote: e.quote }]
            : [];
        })
        .slice(0, 5),
      weakestAreas: s.map.competencies
        .filter((c) => c.strength === 'weak' || c.strength === 'none')
        .sort((a, b) => gapWeight(b) - gapWeight(a))
        .slice(0, 5)
        .map((c) => ({
          competencyId: c.id,
          reason: c.missingEvidence ?? `Evidence for ${c.name} is limited.`,
        })),
      starOutlines: MOCK_STAR_OUTLINES,
      actions: MOCK_ACTIONS,
      scoreEvents: s.map.scoreEvents,
      generatedAt: iso(),
    };
  }

  function createReport(s: MockSession): Report {
    // Same errors as the API's ReportService.create (design §8).
    if (!s.interview) throw new MockApiError('NOT_FOUND', 'The interview has not started.');
    if (s.interview.status !== 'complete') {
      throw new MockApiError('CONFLICT', 'Finish the interview before creating the report.');
    }
    if (!s.report) {
      // Demo reports use fixed narrative text and don't count against the quota.
      if (s.mode !== 'demo') {
        if (s.counters.reports >= LIMITS.quotas.reports) {
          throw new MockApiError('QUOTA_EXCEEDED', 'You have used all reports for this session.');
        }
        s.counters.reports++;
      }
      s.report = buildReport(s);
    }
    s.stage = 'report';
    persist();
    return s.report;
  }

  function getReport(s: MockSession): Report {
    if (!s.report) throw new MockApiError('NOT_FOUND', 'No report has been created.');
    return s.report;
  }

  return {
    createSession,
    authorize,
    summary,
    deleteSession,
    presignResume,
    analysisStatus,
    startAnalysis,
    decide,
    confirm,
    startInterview,
    submitAnswer,
    startPractice,
    presignAudio,
    startTranscription,
    getTranscription,
    createReport,
    getReport,
    /** Test helper: the raw session record. */
    peek: (id: string) => sessions.get(id),
  };
}

export type MockDb = ReturnType<typeof createMockDb>;
