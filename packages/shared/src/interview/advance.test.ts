import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEMO_EVIDENCE_MAP, DEMO_INTERVIEW_PLAN } from '../fixtures/demo';
import { LIMITS } from '../limits';
import type { DimensionScores, InterviewState } from '../schemas/interview';
import { candidateFollowUpArb, dimensionsArb } from '../test/arbitraries';
import {
  advanceInterview,
  applyInterviewToMap,
  buildEvaluation,
  currentTurn,
  initialInterview,
  questionRows,
} from './advance';

const ANSWER = { text: 'x'.repeat(40), source: 'typed', edited: false } as const;
const STRONG = { score: 4, rationale: 'Clear.' } as const;
const strongDims: DimensionScores = {
  relevance: STRONG,
  specificity: STRONG,
  evidence: STRONG,
  star: STRONG,
  clarity: STRONG,
  ownership: STRONG,
  roleConnection: STRONG,
};

const evaluationOf = (dimensions: DimensionScores, candidateFollowUp: string | null) =>
  buildEvaluation({
    dimensions,
    strength: 'A specific strength.',
    improvement: 'A specific improvement.',
    strongerOutline: ['First point', 'Second point'],
    candidateFollowUp,
    feedbackSource: 'live',
  });

/** Answers every question in order with the given evaluations until the interview completes. */
function runInterview(evals: readonly { dims: DimensionScores; fu: string | null }[]) {
  let state: InterviewState = initialInterview(DEMO_INTERVIEW_PLAN);
  for (let i = 0; state.status === 'in_progress'; i++) {
    const turn = currentTurn(state);
    if (!turn) break;
    const e = evals[i % evals.length]!;
    const res = advanceInterview({
      state,
      plan: DEMO_INTERVIEW_PLAN,
      turnId: turn.id,
      answer: ANSWER,
      evaluation: evaluationOf(e.dims, e.fu),
    });
    if (!res.ok) throw new Error(res.error);
    state = res.state;
  }
  return state;
}

describe('advanceInterview (property)', () => {
  it('always completes with 5 primaries and 1–2 follow-ups, GAP guaranteed', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ dims: dimensionsArb, fu: candidateFollowUpArb }), {
          minLength: 1,
          maxLength: 12,
        }),
        (evals) => {
          const state = runInterview(evals);
          const primaries = state.turns.filter((t) => t.kind !== 'follow_up');
          const followUps = state.turns.filter((t) => t.kind === 'follow_up');
          expect(state.status).toBe('complete');
          expect(primaries).toHaveLength(LIMITS.interview.primaryQuestions);
          expect(followUps.length).toBeGreaterThanOrEqual(LIMITS.interview.minFollowUps);
          expect(followUps.length).toBeLessThanOrEqual(LIMITS.interview.maxFollowUps);
          expect(state.followUpsUsed).toBe(followUps.length);
          expect(state.turns.every((t) => t.status === 'evaluated')).toBe(true);
          // With none asked before question 3 (GAP), the GAP is always followed up.
          const before = state.turns.filter((t) => t.index < 3 && t.kind === 'follow_up');
          if (before.length === 0) {
            expect(followUps.some((t) => t.index === 3)).toBe(true);
          }
        },
      ),
    );
  });

  it('does not mutate its input and rejects duplicates and unknown turns', () => {
    const state = initialInterview(DEMO_INTERVIEW_PLAN);
    const snapshot = JSON.stringify(state);
    const evaluation = evaluationOf(strongDims, null);
    const base = { plan: DEMO_INTERVIEW_PLAN, answer: ANSWER, evaluation };
    const ok = advanceInterview({ ...base, state, turnId: 't1' });
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(ok.ok && ok.next?.id).toBe('t2');
    if (!ok.ok) return;
    expect(advanceInterview({ ...base, state: ok.state, turnId: 't1' })).toEqual({
      ok: false,
      error: 'already_evaluated',
    });
    expect(advanceInterview({ ...base, state: ok.state, turnId: 'nope' })).toEqual({
      ok: false,
      error: 'not_found',
    });
  });

  it('asks the weak-answer follow-up, then continues to the next primary', () => {
    const weak: DimensionScores = { ...strongDims, specificity: { score: 1, rationale: 'Vague.' } };
    const res = advanceInterview({
      state: initialInterview(DEMO_INTERVIEW_PLAN),
      plan: DEMO_INTERVIEW_PLAN,
      turnId: 't1',
      answer: ANSWER,
      evaluation: evaluationOf(weak, 'You said you led it. What exactly did you decide?'),
    });
    expect(res.ok && res.next).toMatchObject({ id: 't1a', kind: 'follow_up', label: '1a' });
  });
});

describe('applyInterviewToMap', () => {
  it('sets Interview Readiness and one score event, without mutating the input', () => {
    const state = runInterview([{ dims: strongDims, fu: null }]);
    const before = JSON.stringify(DEMO_EVIDENCE_MAP);
    const { map, scoreEvent } = applyInterviewToMap({
      map: DEMO_EVIDENCE_MAP,
      state,
      reason: 'Your interview answer was scored.',
      sourceRef: 'turn:t5',
      at: '2026-01-01T00:00:00.000Z',
    });
    expect(JSON.stringify(DEMO_EVIDENCE_MAP)).toBe(before);
    expect(map.scores.interviewReadiness).not.toBeNull();
    expect(scoreEvent?.metric).toBe('interviewReadiness');
    expect(questionRows(state).every((r) => r.bestScore === 4)).toBe(true);
  });
});
