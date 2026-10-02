import { describe, expect, it } from 'vitest';
import type { DimensionScores } from '../schemas/interview';
import { DEFAULT_DEEPENING_FOLLOW_UP, decideFollowUp } from './followUp';
import { type PlanCompetency, selectGapCompetency, selectPlan } from './plan';

const comp = (
  id: string,
  importance: PlanCompetency['importance'],
  strength: PlanCompetency['strength'],
  extra: Partial<PlanCompetency> = {},
): PlanCompetency => ({
  id,
  importance,
  strength,
  interviewPriority: false,
  confirmationState: 'none',
  ...extra,
});

const COMPETENCIES = [
  comp('c1', 'required', 'strong'), // gap 0
  comp('c2', 'required', 'weak'), // gap 2.1
  comp('c3', 'preferred', 'none'), // gap 2
  comp('c4', 'required', 'none'), // gap 3
  comp('c5', 'contextual', 'moderate'), // gap 0.4
  comp('c6', 'preferred', 'moderate', { interviewPriority: true }), // gap 0.8 + 0.5
];

describe('selectGapCompetency', () => {
  it('targets argmax w × (1 − s)', () => {
    expect(selectGapCompetency(COMPETENCIES).id).toBe('c4');
  });
  it('breaks ties by interview priority', () => {
    const tied = [
      comp('c1', 'required', 'none'),
      comp('c2', 'required', 'none', { interviewPriority: true }),
    ];
    expect(selectGapCompetency(tied).id).toBe('c2');
  });
});

describe('selectPlan', () => {
  it('keeps the top 2 of each kind and orders B1, R1, GAP, B2, R2', () => {
    const plan = selectPlan({
      competencies: COMPETENCIES,
      behavioral: [
        { competencyIds: ['c1'], question: 'B-c1' },
        { competencyIds: ['c2'], question: 'B-c2' },
        { competencyIds: ['c6'], question: 'B-c6' },
      ],
      roleSpecific: [
        { competencyIds: ['c5'], question: 'R-c5' },
        { competencyIds: ['c3'], question: 'R-c3' },
        { competencyIds: ['c1', 'c2'], question: 'R-c1c2' },
      ],
      gap: { competencyId: 'c4', question: 'GAP-c4' },
    });
    expect(plan.map((q) => q.question)).toEqual(['B-c2', 'R-c1c2', 'GAP-c4', 'B-c6', 'R-c3']);
    expect(plan.map((q) => q.kind)).toEqual([
      'behavioral',
      'role_specific',
      'evidence_gap',
      'behavioral',
      'role_specific',
    ]);
    expect(plan.map((q) => q.index)).toEqual([1, 2, 3, 4, 5]);
  });
  it('throws with too few candidates', () => {
    expect(() =>
      selectPlan({
        competencies: COMPETENCIES,
        behavioral: [],
        roleSpecific: [],
        gap: { competencyId: 'c4', question: 'q' },
      }),
    ).toThrow();
  });
});

const dims = (score: 1 | 2 | 3 | 4): DimensionScores => {
  const d = { score, rationale: 'r' };
  return {
    relevance: d,
    specificity: d,
    evidence: d,
    star: null,
    clarity: d,
    ownership: d,
    roleConnection: d,
  };
};

describe('decideFollowUp', () => {
  it('never asks after 2 follow-ups', () => {
    expect(
      decideFollowUp({
        followUpsUsed: 2,
        primaryIndex: 4,
        dimensions: dims(1),
        candidateFollowUp: 'Why?',
      }),
    ).toEqual({
      ask: false,
    });
  });
  it('asks the candidate follow-up when a trigger dimension is ≤ 2', () => {
    expect(
      decideFollowUp({
        followUpsUsed: 0,
        primaryIndex: 1,
        dimensions: dims(2),
        candidateFollowUp: ' What did you own? ',
      }),
    ).toEqual({
      ask: true,
      text: 'What did you own?',
      reason: 'weak_dimensions',
    });
  });
  it('ignores weakness in non-trigger dimensions', () => {
    const d = { ...dims(4), clarity: { score: 1 as const, rationale: 'r' } };
    expect(
      decideFollowUp({
        followUpsUsed: 0,
        primaryIndex: 1,
        dimensions: d,
        candidateFollowUp: 'Why?',
      }),
    ).toEqual({ ask: false });
  });
  it('does not ask without a usable candidate outside the GAP question', () => {
    expect(
      decideFollowUp({
        followUpsUsed: 0,
        primaryIndex: 2,
        dimensions: dims(1),
        candidateFollowUp: 'x'.repeat(301),
      }),
    ).toEqual({
      ask: false,
    });
  });
  it('guarantees a deepening follow-up on question 3 when none were used', () => {
    expect(
      decideFollowUp({
        followUpsUsed: 0,
        primaryIndex: 3,
        dimensions: dims(4),
        candidateFollowUp: null,
      }),
    ).toEqual({
      ask: true,
      text: DEFAULT_DEEPENING_FOLLOW_UP,
      reason: 'guaranteed_deepening',
    });
  });
  it('skips the guaranteed follow-up when one was already used', () => {
    expect(
      decideFollowUp({
        followUpsUsed: 1,
        primaryIndex: 3,
        dimensions: dims(4),
        candidateFollowUp: 'Tell me more',
      }),
    ).toEqual({
      ask: false,
    });
  });
});
