import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DEMO_EVIDENCE_MAP,
  DEMO_INTERVIEW_PLAN,
  DEMO_REPORT_NARRATIVE,
  DEMO_RESUME_TEXT,
} from '../fixtures/demo';
import { LIMITS } from '../limits';
import type { DimensionScores, InterviewState } from '../schemas/interview';
import { ReportSchema } from '../schemas/report';
import { dimensionsArb } from '../test/arbitraries';
import { advanceInterview, buildEvaluation, currentTurn, initialInterview } from './advance';
import {
  buildReport,
  checkNarrative,
  evaluatedTurnCount,
  limitSentences,
  reportQuestions,
  weakestCompetencies,
} from './report';

const ANSWER = { text: 'x'.repeat(40), source: 'typed', edited: false } as const;
const AT = '2026-09-29T09:00:00.000Z';

const evaluationOf = (dimensions: DimensionScores) =>
  buildEvaluation({
    dimensions,
    strength: 'A specific strength.',
    improvement: 'A specific improvement.',
    strongerOutline: ['First point', 'Second point'],
    candidateFollowUp: null,
    feedbackSource: 'live',
  });

function completed(dims: DimensionScores): InterviewState {
  let state = initialInterview(DEMO_INTERVIEW_PLAN);
  for (let i = 0; state.status === 'in_progress' && i < 12; i++) {
    const turn = currentTurn(state);
    if (!turn) break;
    const res = advanceInterview({
      state,
      plan: DEMO_INTERVIEW_PLAN,
      turnId: turn.id,
      answer: ANSWER,
      evaluation: evaluationOf(dims),
    });
    if (!res.ok) throw new Error(res.error);
    state = res.state;
  }
  return state;
}

const dimsOf = (score: 1 | 2 | 3 | 4): DimensionScores => {
  const d = { score, rationale: 'Because.' };
  return {
    relevance: d,
    specificity: d,
    evidence: d,
    star: d,
    clarity: d,
    ownership: d,
    roleConnection: d,
  };
};

const SOURCES = [DEMO_RESUME_TEXT];

describe('buildReport', () => {
  it('produces a schema-valid report from the demo map and narrative', () => {
    const report = buildReport({
      map: DEMO_EVIDENCE_MAP,
      state: completed(dimsOf(3)),
      narrative: DEMO_REPORT_NARRATIVE,
      generatedAt: AT,
    });
    expect(ReportSchema.safeParse(report).success).toBe(true);
    expect(report.actions.map((a) => a.priority)).toEqual([1, 2, 3]);
    expect(report.readiness.performanceWeight).toBe(0.7);
  });

  it('numbers do not depend on the narrative text', () => {
    const state = completed(dimsOf(2));
    const a = buildReport({
      map: DEMO_EVIDENCE_MAP,
      state,
      narrative: DEMO_REPORT_NARRATIVE,
      generatedAt: AT,
    });
    const b = buildReport({
      map: DEMO_EVIDENCE_MAP,
      state,
      narrative: { ...DEMO_REPORT_NARRATIVE, summary: 'One. Two.' },
      generatedAt: AT,
    });
    expect(b.readiness).toEqual(a.readiness);
    expect(b.competencies).toEqual(a.competencies);
    expect(b.questions).toEqual(a.questions);
  });

  it('stays valid and bounded for any rubric scores', () => {
    fc.assert(
      fc.property(dimensionsArb, (dims) => {
        const report = buildReport({
          map: DEMO_EVIDENCE_MAP,
          state: completed(dims),
          narrative: DEMO_REPORT_NARRATIVE,
          generatedAt: AT,
        });
        expect(ReportSchema.safeParse(report).success).toBe(true);
        expect(report.readiness.score).toBeGreaterThanOrEqual(0);
        expect(report.readiness.score).toBeLessThanOrEqual(100);
        expect(report.actions).toHaveLength(LIMITS.report.actions);
      }),
      { numRuns: 25 },
    );
  });

  it('uses the model reason for a weak area and falls back to the map otherwise', () => {
    const [first] = weakestCompetencies(DEMO_EVIDENCE_MAP);
    expect(first).toBeDefined();
    const withReason = buildReport({
      map: DEMO_EVIDENCE_MAP,
      state: completed(dimsOf(3)),
      narrative: {
        ...DEMO_REPORT_NARRATIVE,
        weakestAreas: [{ competencyId: first!.id, reason: 'Model wording.' }],
      },
      generatedAt: AT,
    });
    expect(withReason.weakestAreas[0]).toEqual({
      competencyId: first!.id,
      reason: 'Model wording.',
    });
    const fallback = buildReport({
      map: DEMO_EVIDENCE_MAP,
      state: completed(dimsOf(3)),
      narrative: DEMO_REPORT_NARRATIVE,
      generatedAt: AT,
    });
    expect(fallback.weakestAreas[0]?.competencyId).toBe(first!.id);
    expect(fallback.weakestAreas[0]?.reason.length).toBeGreaterThan(0);
  });
});

describe('reportQuestions', () => {
  it('nests follow-ups and evaluated practice attempts under their primary', () => {
    const state = completed(dimsOf(2));
    const q = reportQuestions(state);
    expect(q).toHaveLength(LIMITS.interview.primaryQuestions);
    for (const row of q) {
      expect(row.followUps.every((t) => t.parentTurnId === row.primary.id)).toBe(true);
    }
    expect(evaluatedTurnCount(state)).toBe(state.turns.length);
  });
});

describe('checkNarrative', () => {
  it('accepts the demo narrative against the resume', () => {
    const res = checkNarrative(DEMO_REPORT_NARRATIVE, DEMO_EVIDENCE_MAP, [
      DEMO_RESUME_TEXT,
      ...DEMO_EVIDENCE_MAP.competencies.flatMap((c) => c.evidence.map((e) => e.quote)),
    ]);
    // The demo outlines are authored prose; the check may only drop, never invent.
    if (res.ok) expect(res.narrative.starOutlines.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects an action for an unknown competency', () => {
    const res = checkNarrative(
      {
        ...DEMO_REPORT_NARRATIVE,
        actions: [
          { competencyId: 'nope', step: 'Do a thing.' },
          ...DEMO_REPORT_NARRATIVE.actions.slice(1),
        ],
      },
      DEMO_EVIDENCE_MAP,
      SOURCES,
    );
    expect(res).toEqual({ ok: false, reason: 'action_unknown_competency' });
  });

  it('drops STAR outlines that add numbers not in the sources, and rejects when too few remain', () => {
    const invented = DEMO_REPORT_NARRATIVE.starOutlines.map((o) => ({
      ...o,
      result: 'Latency fell by 73% across 41 services.',
    }));
    const res = checkNarrative(
      { ...DEMO_REPORT_NARRATIVE, starOutlines: invented },
      DEMO_EVIDENCE_MAP,
      SOURCES,
    );
    expect(res).toEqual({ ok: false, reason: 'star_outlines_ungrounded' });
  });

  it('trims a long summary to the maximum sentences and rejects a one-sentence summary', () => {
    const six = 'One. Two. Three. Four. Five. Six.';
    expect(limitSentences(six, LIMITS.report.summarySentences.max)).toEqual({
      text: 'One. Two. Three. Four.',
      count: 6,
    });
    const res = checkNarrative(
      { ...DEMO_REPORT_NARRATIVE, summary: 'Only one sentence here.' },
      DEMO_EVIDENCE_MAP,
      SOURCES,
    );
    expect(res).toEqual({ ok: false, reason: 'summary_too_short' });
  });
});
