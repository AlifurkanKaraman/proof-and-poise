import { describe, expect, it } from 'vitest';
import type { DimensionScores } from '../schemas/interview';
import { createScoreEvent, diffScoreSets, formatScoreEvent } from './events';
import {
  answerLevel,
  answerScore,
  competencyReadiness,
  interviewPerformance,
  interviewReadiness,
  questionScore,
} from './interview';
import { parseabilityScore } from './parseability';
import { buildWorkingResume } from './recompute';
import {
  coverageBreakdown,
  evidenceCoverageScore,
  jobMatchScore,
  keywordCoverageScore,
} from './scores';
import { capStrength } from './strength';

describe('jobMatchScore / evidenceCoverageScore', () => {
  const comps = [
    { importance: 'required', strength: 'strong' },
    { importance: 'required', strength: 'none' },
    { importance: 'preferred', strength: 'moderate' },
    { importance: 'contextual', strength: 'weak' },
  ] as const;

  it('applies 100 × Σ(w·s) / Σ(w)', () => {
    // (3·1 + 3·0 + 2·0.6 + 1·0.3) / 9 = 4.5 / 9 = 50
    expect(jobMatchScore(comps)).toBe(50);
  });
  it('applies 100 × Σ(w·[s>0]) / Σ(w)', () => {
    // (3 + 2 + 1) / 9 = 66.67 → 67
    expect(evidenceCoverageScore(comps)).toBe(67);
  });
  it('returns 0 for empty input', () => {
    expect(jobMatchScore([])).toBe(0);
    expect(evidenceCoverageScore([])).toBe(0);
  });
  it('breaks coverage down for the explanation', () => {
    expect(coverageBreakdown(comps)[0]).toEqual({
      importance: 'required',
      total: 2,
      withEvidence: 1,
    });
  });
});

describe('keywordCoverageScore', () => {
  it('counts required keywords twice', () => {
    // matched: required (2) + preferred (1) = 3 of 2+2+1 = 5 → 60
    expect(
      keywordCoverageScore([
        { required: true, matched: true },
        { required: true, matched: false },
        { required: false, matched: true },
      ]),
    ).toBe(60);
  });
});

describe('capStrength', () => {
  it('sets none with no evidence', () => {
    expect(capStrength('strong', [])).toEqual({ strength: 'none', cap: 'no_evidence' });
  });
  it('caps confirmation-only at moderate', () => {
    expect(capStrength('strong', [{ source: 'candidate_confirmation' }])).toEqual({
      strength: 'moderate',
      cap: 'confirmation_only',
    });
  });
  it('caps a single Skills-section quote at weak', () => {
    expect(capStrength('strong', [{ source: 'resume', section: 'skills' }])).toEqual({
      strength: 'weak',
      cap: 'skills_only',
    });
  });
  it('does not raise a weaker proposal', () => {
    expect(capStrength('weak', [{ source: 'candidate_confirmation' }])).toEqual({
      strength: 'weak',
      cap: null,
    });
  });
  it('caps a single experience quote at moderate; strong needs two (design §6.1)', () => {
    expect(capStrength('strong', [{ source: 'resume', section: 'experience' }])).toEqual({
      strength: 'moderate',
      cap: 'single_quote',
    });
    expect(capStrength('moderate', [{ source: 'resume', section: 'experience' }])).toEqual({
      strength: 'moderate',
      cap: null,
    });
  });
  it('lets a single Education line prove a credential', () => {
    expect(capStrength('strong', [{ source: 'resume', section: 'education' }])).toEqual({
      strength: 'strong',
      cap: null,
    });
  });
  it('leaves strength backed by two resume quotes alone', () => {
    expect(
      capStrength('strong', [
        { source: 'resume', section: 'experience' },
        { source: 'resume', section: 'projects' },
      ]),
    ).toEqual({ strength: 'strong', cap: null });
  });
});

const RESUME = `Amara Example
amara@example.com | github.com/example
EXPERIENCE
Cloud Intern, Example Co  Jun 2024 - Aug 2024
- Built a serverless API
- Wrote integration tests
EDUCATION
MS Computer Science 2023 - 2025
SKILLS
Python, TypeScript
${'word '.repeat(300)}`;

describe('parseabilityScore', () => {
  it('scores a well-formed resume at 100', () => {
    const r = parseabilityScore(RESUME, 'pdf');
    expect(r.score).toBe(100);
    expect(r.checks.every((c) => c.passed)).toBe(true);
  });
  it('fails the gate below 200 characters', () => {
    const r = parseabilityScore('EXPERIENCE\nEDUCATION\na@b.co', 'text');
    expect(r.score).toBe(0);
    expect(r.checks.find((c) => c.id === 'extractable')?.passed).toBe(false);
  });
  it('penalizes garbled text', () => {
    const r = parseabilityScore(RESUME + '\uFFFD'.repeat(100), 'pdf');
    expect(r.checks.find((c) => c.id === 'clean_characters')?.passed).toBe(false);
    expect(r.score).toBe(85);
  });
});

const dims = (score: 1 | 2 | 3 | 4, star: boolean): DimensionScores => {
  const d = { score, rationale: 'r' };
  return {
    relevance: d,
    specificity: d,
    evidence: d,
    star: star ? d : null,
    clarity: d,
    ownership: d,
    roleConnection: d,
  };
};

describe('answerScore', () => {
  it('is the weighted mean of dimensions', () => {
    expect(answerScore(dims(3, true))).toBe(3);
    const mixed: DimensionScores = { ...dims(4, true), relevance: { score: 1, rationale: 'r' } };
    // (20·1 + 80·4) / 100 = 3.4
    expect(answerScore(mixed)).toBe(3.4);
  });
  it('redistributes STAR weight for non-behavioral questions', () => {
    const d: DimensionScores = { ...dims(4, false), relevance: { score: 1, rationale: 'r' } };
    // (20·1 + 70·4) / 90 = 3.333…
    expect(answerScore(d)).toBe(3.33);
  });
});

describe('questionScore', () => {
  it('uses the follow-up only when it helps', () => {
    expect(questionScore(2, 4)).toBe(3);
    expect(questionScore(3, 1)).toBe(3);
  });
  it('lets a higher practice attempt replace the score', () => {
    expect(questionScore(2, null, [3.5, 2.5])).toBe(3.5);
    expect(questionScore(3, null, [2])).toBe(3);
  });
});

describe('interviewPerformance and interviewReadiness', () => {
  it('weights questions by the highest targeted importance', () => {
    const p = interviewPerformance(
      [
        { score: 4, competencyIds: ['c1', 'c2'] }, // w = 3 (required)
        { score: 1, competencyIds: ['c2'] }, // w = 1 (contextual)
      ],
      { c1: 'required', c2: 'contextual' },
    );
    expect(p).toBeCloseTo(0.75);
  });
  it('returns null without questions', () => {
    expect(interviewPerformance([], {})).toBeNull();
  });
  it('combines 0.7·P and 0.3·JobMatch', () => {
    expect(interviewReadiness(0.5, 80)).toBe(59);
  });
});

describe('competencyReadiness', () => {
  it.each([
    ['strong', 3.2, 'ready'],
    ['moderate', 2.6, 'developing'],
    ['weak', 3.5, 'developing'],
    ['strong', null, 'developing'],
    ['weak', 2.0, 'needs_practice'],
    ['weak', null, 'not_assessed'],
  ] as const)('%s with best %s → %s', (strength, best, expected) => {
    expect(competencyReadiness(strength, best)).toBe(expected);
  });
});

describe('answerLevel', () => {
  it('maps scores to levels', () => {
    expect([1.5, 2.5, 3.2, 3.8].map(answerLevel)).toEqual([
      'beginning',
      'developing',
      'proficient',
      'strong',
    ]);
  });
});

describe('score events', () => {
  const at = '2026-09-27T12:00:00.000Z';
  it('returns null when nothing changed', () => {
    expect(
      createScoreEvent({
        id: 'e1',
        metric: 'jobMatch',
        before: 5,
        after: 5,
        reason: 'x',
        sourceRef: 'y',
        at,
      }),
    ).toBeNull();
  });
  it('diffs score sets and formats the change', () => {
    const before = {
      jobMatch: 60,
      evidenceCoverage: 70,
      keywordCoverage: 50,
      parseability: 90,
      interviewReadiness: null,
    };
    const after = { ...before, jobMatch: 66, evidenceCoverage: 80 };
    const events = diffScoreSets(before, after, {
      reason: 'you confirmed Kubernetes experience.',
      sourceRef: 'confirmation:c8',
      at,
      makeId: (m) => `e-${m}`,
    });
    expect(events.map((e) => e.metric)).toEqual(['jobMatch', 'evidenceCoverage']);
    expect(formatScoreEvent(events[0]!)).toBe('+6 Job Match: you confirmed Kubernetes experience.');
  });
});

describe('buildWorkingResume', () => {
  it('applies only accepted recommendations, tolerating whitespace and case differences', () => {
    const text = 'Built   a Serverless API\nWrote tests';
    const r = buildWorkingResume(text, [
      {
        id: 'r1',
        originalText: 'built a serverless api',
        proposedText: 'Designed a serverless API',
        decision: 'accepted',
      },
      {
        id: 'r2',
        originalText: 'Wrote tests',
        proposedText: 'Wrote unit tests',
        decision: 'rejected',
      },
      { id: 'r3', originalText: 'not present anywhere', proposedText: 'x', decision: 'accepted' },
    ]);
    expect(r.text).toBe('Designed a serverless API\nWrote tests');
    expect(r.applied).toEqual(['r1']);
    expect(r.unapplied).toEqual(['r3']);
  });
});
