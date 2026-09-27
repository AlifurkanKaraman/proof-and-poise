import { describe, expect, it } from 'vitest';
import { buildPath, matchPath, routes } from '../contracts/routes';
import { ERROR_CODES, ERROR_STATUS } from '../contracts/errors';
import {
  AnalysisRequestSchema,
  AnswerRequestSchema,
  ConfirmationRequestSchema,
  EvaluationModelOutputSchema,
  ResumeUploadRequestSchema,
  TurnSchema,
} from './index';

const text = (n: number) => 'a'.repeat(n);

describe('input schemas', () => {
  const job = { description: text(200), role: 'Cloud Software Engineer I' };

  it('accepts valid analysis input and defaults the interview type', () => {
    const r = AnalysisRequestSchema.parse({ resume: { kind: 'text', text: text(200) }, job });
    expect(r.job.interviewType).toBe('behavioral_mixed');
  });
  it('enforces resume and job length bounds', () => {
    expect(
      AnalysisRequestSchema.safeParse({ resume: { kind: 'text', text: text(199) }, job }).success,
    ).toBe(false);
    expect(
      AnalysisRequestSchema.safeParse({ resume: { kind: 'text', text: text(12_001) }, job })
        .success,
    ).toBe(false);
    expect(
      AnalysisRequestSchema.safeParse({
        resume: { kind: 'text', text: text(200) },
        job: { ...job, description: text(8_001) },
      }).success,
    ).toBe(false);
    expect(
      AnalysisRequestSchema.safeParse({
        resume: { kind: 'text', text: text(200) },
        job: { ...job, role: '' },
      }).success,
    ).toBe(false);
  });
  it('rejects non-PDF, empty, and oversized uploads', () => {
    expect(
      ResumeUploadRequestSchema.safeParse({ contentType: 'application/pdf', size: 1000 }).success,
    ).toBe(true);
    expect(
      ResumeUploadRequestSchema.safeParse({ contentType: 'image/png', size: 1000 }).success,
    ).toBe(false);
    expect(
      ResumeUploadRequestSchema.safeParse({ contentType: 'application/pdf', size: 0 }).success,
    ).toBe(false);
    expect(
      ResumeUploadRequestSchema.safeParse({ contentType: 'application/pdf', size: 5_242_881 })
        .success,
    ).toBe(false);
  });
  it('requires attestation and 30–500 characters for confirmations', () => {
    const ok = { competencyId: 'c8', statement: text(30), attested: true };
    expect(ConfirmationRequestSchema.safeParse(ok).success).toBe(true);
    expect(ConfirmationRequestSchema.safeParse({ ...ok, attested: false }).success).toBe(false);
    expect(ConfirmationRequestSchema.safeParse({ ...ok, statement: text(29) }).success).toBe(false);
    expect(ConfirmationRequestSchema.safeParse({ ...ok, competencyId: 'c13' }).success).toBe(false);
  });
  it('bounds typed answers to 20–3000 characters', () => {
    expect(
      AnswerRequestSchema.safeParse({ text: text(19), source: 'typed', edited: false }).success,
    ).toBe(false);
    expect(
      AnswerRequestSchema.safeParse({ text: text(3_000), source: 'typed', edited: false }).success,
    ).toBe(true);
  });
});

describe('model-output schemas are strict', () => {
  const dim = { score: 3, rationale: 'Mentions the migration.' };
  const valid = {
    dimensions: {
      relevance: dim,
      specificity: dim,
      evidence: dim,
      star: null,
      clarity: dim,
      ownership: dim,
      roleConnection: dim,
    },
    strength: 's',
    improvement: 'i',
    strongerOutline: ['a', 'b'],
    candidateFollowUp: null,
  };
  it('accepts a valid evaluation', () => {
    expect(EvaluationModelOutputSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects unknown keys (no room for inferred traits)', () => {
    expect(EvaluationModelOutputSchema.safeParse({ ...valid, confidence: 'nervous' }).success).toBe(
      false,
    );
  });
  it('rejects out-of-range rubric scores', () => {
    const bad = {
      ...valid,
      dimensions: { ...valid.dimensions, relevance: { score: 5, rationale: 'x' } },
    };
    expect(EvaluationModelOutputSchema.safeParse(bad).success).toBe(false);
  });
});

describe('TurnSchema', () => {
  it('accepts a follow-up label', () => {
    expect(
      TurnSchema.safeParse({
        id: 't3a',
        index: 3,
        label: '3a',
        kind: 'follow_up',
        parentTurnId: 't3',
        competencyIds: ['c4'],
        question: 'q',
        status: 'asked',
      }).success,
    ).toBe(true);
  });
});

describe('route contracts', () => {
  it('builds and matches paths', () => {
    const path = buildPath(routes.submitAnswer.path, { sessionId: 'abc-1', turnId: 't3a' });
    expect(path).toBe('/v1/sessions/abc-1/turns/t3a/answer');
    expect(matchPath(routes.submitAnswer.path, '/sessions/abc-1/turns/t3a/answer')).toEqual({
      sessionId: 'abc-1',
      turnId: 't3a',
    });
    expect(matchPath(routes.submitAnswer.path, '/sessions/abc-1/answer')).toBeNull();
  });
  it('throws on a missing path param', () => {
    expect(() => buildPath(routes.getSession.path, {})).toThrow();
  });
  it('requires auth on every session route', () => {
    for (const r of Object.values(routes)) {
      expect(r.auth).toBe(r.path.startsWith('/sessions/'));
    }
  });
  it('maps every error code to an HTTP status', () => {
    for (const c of ERROR_CODES) expect(ERROR_STATUS[c]).toBeGreaterThanOrEqual(400);
  });
});
