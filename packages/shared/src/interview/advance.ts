/**
 * Pure interview state transitions (design §7.3, §8; Req 9.1, 9.3–9.4, 11). The API service
 * loads the stored state, calls these, validates, and saves. Nothing here touches the model
 * or the network, so the follow-up guarantee and the score maths are property-testable.
 */
import { LIMITS } from '../limits';
import type { Importance } from '../schemas/common';
import type { EvidenceMap, ScoreEvent } from '../schemas/evidenceMap';
import type { DimensionScores, Evaluation, InterviewState, Turn } from '../schemas/interview';
import { createScoreEvent } from '../scoring/events';
import { nextId } from '../scoring/decisions';
import {
  answerScore,
  competencyReadiness,
  interviewPerformance,
  interviewReadiness,
  questionScore,
} from '../scoring/interview';
import { decideFollowUp } from './followUp';
import type { PlannedQuestion } from './plan';

export const PRIMARY_KINDS: readonly Turn['kind'][] = [
  'behavioral',
  'role_specific',
  'evidence_gap',
];

/** The first question of a fresh interview; later turns appear as the candidate progresses. */
export function primaryTurn(planned: PlannedQuestion): Turn {
  return {
    id: `t${planned.index}`,
    index: planned.index,
    label: String(planned.index),
    kind: planned.kind,
    competencyIds: [...planned.competencyIds],
    question: planned.question,
    status: 'asked',
  };
}

export function initialInterview(plan: readonly PlannedQuestion[]): InterviewState {
  const first = plan[0];
  if (!first) throw new Error('initialInterview: empty plan');
  return {
    turns: [primaryTurn(first)],
    total: LIMITS.interview.primaryQuestions,
    followUpsUsed: 0,
    status: 'in_progress',
  };
}

/** The turn waiting for an answer: the first one that isn't evaluated yet. */
export const currentTurn = (state: InterviewState): Turn | undefined =>
  state.turns.find((t) => t.status !== 'evaluated');

/** STAR applies to behavioral primaries only (Req 11.1). */
export const expectsStar = (turn: Pick<Turn, 'kind'>): boolean => turn.kind === 'behavioral';

/** Builds the stored `Evaluation` from validated dimensions; the score is computed, never modeled. */
export function buildEvaluation(input: {
  dimensions: DimensionScores;
  strength: string;
  improvement: string;
  strongerOutline: string[];
  candidateFollowUp: string | null;
  feedbackSource: Evaluation['feedbackSource'];
}): Evaluation {
  return { ...input, weightedScore: answerScore(input.dimensions) };
}

export type AdvanceResult =
  | { ok: true; state: InterviewState; turn: Turn; next: Turn | null }
  | { ok: false; error: 'not_found' | 'already_evaluated' | 'not_current' };

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Records an evaluation on a turn and decides what comes next: a follow-up (the rule in
 * `decideFollowUp`), the next planned primary, or the end of the interview. Practice turns
 * never advance the plan. The input state is not mutated.
 */
export function advanceInterview(input: {
  state: InterviewState;
  plan: readonly PlannedQuestion[];
  turnId: string;
  answer: NonNullable<Turn['answer']>;
  evaluation: Evaluation;
}): AdvanceResult {
  const state = clone(input.state);
  const turn = state.turns.find((t) => t.id === input.turnId);
  if (!turn) return { ok: false, error: 'not_found' };
  if (turn.status === 'evaluated') return { ok: false, error: 'already_evaluated' };
  if (turn.kind !== 'practice' && currentTurn(state)?.id !== turn.id) {
    return { ok: false, error: 'not_current' };
  }

  turn.answer = { ...input.answer };
  turn.evaluation = input.evaluation;
  turn.status = 'evaluated';

  const startPrimary = (afterIndex: number): Turn | null => {
    const planned = input.plan[afterIndex];
    if (afterIndex >= LIMITS.interview.primaryQuestions || !planned) {
      state.status = 'complete';
      return null;
    }
    const t = primaryTurn(planned);
    state.turns.push(t);
    return t;
  };

  let next: Turn | null;
  if (turn.kind === 'practice') {
    next = null;
  } else if (turn.kind === 'follow_up') {
    next = startPrimary(turn.index);
  } else {
    const decision = decideFollowUp({
      followUpsUsed: state.followUpsUsed,
      primaryIndex: turn.index,
      dimensions: input.evaluation.dimensions,
      candidateFollowUp: input.evaluation.candidateFollowUp,
    });
    if (decision.ask) {
      state.followUpsUsed += 1;
      next = {
        id: `${turn.id}a`,
        index: turn.index,
        label: `${turn.index}a`,
        kind: 'follow_up',
        parentTurnId: turn.id,
        competencyIds: [...turn.competencyIds],
        question: decision.text,
        status: 'asked',
      };
      state.turns.push(next);
    } else {
      next = startPrimary(turn.index);
    }
  }
  return { ok: true, state, turn, next };
}

export interface QuestionRow {
  primary: Turn;
  originalScore: number | null;
  bestScore: number | null;
}

/** Per-primary scores: follow-up can only help; the best practice attempt replaces it (design §6.2). */
export function questionRows(state: InterviewState): QuestionRow[] {
  return state.turns
    .filter((t) => PRIMARY_KINDS.includes(t.kind))
    .map((primary) => {
      const p = primary.evaluation?.weightedScore;
      if (p === undefined) return { primary, originalScore: null, bestScore: null };
      const followUp = state.turns.find(
        (t) => t.kind === 'follow_up' && t.parentTurnId === primary.id,
      )?.evaluation?.weightedScore;
      const practice = state.turns.flatMap((t) =>
        t.kind === 'practice' && t.parentTurnId === primary.id && t.evaluation
          ? [t.evaluation.weightedScore]
          : [],
      );
      return {
        primary,
        originalScore: questionScore(p, followUp ?? null),
        bestScore: questionScore(p, followUp ?? null, practice),
      };
    });
}

/** Interview performance P ∈ [0, 1] over the scored primaries, or null before any answer. */
export function performanceOf(
  state: InterviewState,
  importanceById: Readonly<Record<string, Importance>>,
): number | null {
  const rows = questionRows(state).flatMap((r) =>
    r.bestScore === null ? [] : [{ score: r.bestScore, competencyIds: r.primary.competencyIds }],
  );
  return interviewPerformance(rows, importanceById);
}

/**
 * Applies the interview state to the evidence map: per-competency best score and readiness,
 * the Interview Readiness score, and one score event when it changed (design §6.2–6.3).
 * The input map is not mutated.
 */
export function applyInterviewToMap(input: {
  map: EvidenceMap;
  state: InterviewState;
  reason: string;
  sourceRef: string;
  at: string;
}): { map: EvidenceMap; scoreEvent: ScoreEvent | null } {
  const map = clone(input.map);
  const rows = questionRows(input.state);
  for (const c of map.competencies) {
    const mine = rows.filter((r) => r.primary.competencyIds.includes(c.id));
    const scored = mine.flatMap((r) => (r.bestScore === null ? [] : [r.bestScore]));
    const best = scored.length > 0 ? Math.max(...scored) : null;
    if (mine.length > 0) {
      c.interview = { turnIds: mine.map((r) => r.primary.id), bestScore: best };
    }
    c.readiness = competencyReadiness(c.strength, best);
  }
  const importance = Object.fromEntries(map.competencies.map((c) => [c.id, c.importance]));
  const p = performanceOf(input.state, importance);
  const before = map.scores;
  const after = {
    ...before,
    interviewReadiness: p === null ? null : interviewReadiness(p, before.jobMatch),
  };
  map.scores = after;
  const scoreEvent = createScoreEvent({
    id: nextId(
      'ev',
      map.scoreEvents.map((e) => e.id),
    ),
    metric: 'interviewReadiness',
    before: before.interviewReadiness,
    after: after.interviewReadiness,
    reason: input.reason,
    sourceRef: input.sourceRef,
    at: input.at,
  });
  if (scoreEvent) map.scoreEvents.push(scoreEvent);
  return { map, scoreEvent };
}
