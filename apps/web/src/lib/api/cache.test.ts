import {
  DEMO_EVIDENCE_MAP,
  DEMO_RESUME_TEXT,
  type AnalysisStatusResponse,
} from '@proof-and-poise/shared';
import { describe, expect, it } from 'vitest';
import { applyOptimisticDecision, mergeConfirmation, mergeDecision } from './cache';

const ready: AnalysisStatusResponse = {
  status: 'ready',
  evidenceMap: DEMO_EVIDENCE_MAP,
  resumeText: DEMO_RESUME_TEXT,
  truncated: false,
  precomputed: true,
};
const map = (d: AnalysisStatusResponse | undefined) => {
  if (d?.status !== 'ready') throw new Error('expected ready');
  return d.evidenceMap;
};
const event = {
  id: 'ev1',
  metric: 'jobMatch' as const,
  before: 50,
  after: 56,
  reason: 'You confirmed Kubernetes and containers experience.',
  sourceRef: 'confirmation:c8',
  at: '2026-09-28T10:00:00.000Z',
};

describe('analysis cache updates', () => {
  it('maps decisions to recommendation states without mutating the input', () => {
    const next = applyOptimisticDecision(ready, 'r1', 'reject');
    expect(map(next).recommendations.find((r) => r.id === 'r1')?.decision).toBe('rejected');
    expect(DEMO_EVIDENCE_MAP.recommendations[0]?.decision).toBe('pending');
    expect(map(applyOptimisticDecision(next, 'r1', 'reset')).recommendations[0]?.decision).toBe(
      'pending',
    );
  });

  it('leaves non-ready data untouched', () => {
    const queued: AnalysisStatusResponse = { status: 'queued' };
    expect(applyOptimisticDecision(queued, 'r1', 'accept')).toBe(queued);
    expect(applyOptimisticDecision(undefined, 'r1', 'accept')).toBeUndefined();
  });

  it('merges a decision result and appends its score event once', () => {
    const rec = { ...DEMO_EVIDENCE_MAP.recommendations[0]!, decision: 'accepted' as const };
    const scores = { ...DEMO_EVIDENCE_MAP.scores, keywordCoverage: 99 };
    const res = {
      recommendation: rec,
      scores,
      scoreEvent: { ...event, metric: 'keywordCoverage' as const },
    };
    const once = mergeDecision(ready, res);
    const twice = mergeDecision(once, res);
    expect(map(twice).scores).toEqual(scores);
    expect(map(twice).scoreEvents).toHaveLength(1);
    expect(map(twice).recommendations[0]).toEqual(rec);
  });

  it('merges a confirmation result into the competency, recommendation, and scores', () => {
    const competency = {
      ...DEMO_EVIDENCE_MAP.competencies[7]!,
      strength: 'moderate' as const,
      confirmationState: 'confirmed' as const,
    };
    const scores = { ...DEMO_EVIDENCE_MAP.scores, jobMatch: 56 };
    const next = mergeConfirmation(ready, { competency, scores, scoreEvent: event });
    expect(map(next).competencies[7]).toEqual(competency);
    expect(map(next).recommendations).toEqual(DEMO_EVIDENCE_MAP.recommendations);
    expect(map(next).scores.jobMatch).toBe(56);
    expect(map(next).scoreEvents).toEqual([event]);
  });
});
