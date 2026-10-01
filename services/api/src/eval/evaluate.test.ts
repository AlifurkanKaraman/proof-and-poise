/** Offline checks for the evaluation harness and its fictional samples (no network). */
import { describe, expect, it } from 'vitest';
import { AnalysisRequestSchema, LIMITS } from '@proof-and-poise/shared';
import { demoModelOutput } from '../test/fixtures';
import { evaluateAnalysis } from './evaluate';
import { DEMO_CASE, EVAL_CASES } from './samples';

describe('prompt evaluation samples', () => {
  it('has the demo fixture plus 3 varied cases that pass the production input schema', () => {
    expect(EVAL_CASES).toHaveLength(5);
    expect(new Set(EVAL_CASES.map((c) => c.id)).size).toBe(5);
    for (const c of EVAL_CASES) {
      const req = { resume: { kind: 'text', text: c.resumeText }, job: c.job };
      expect(AnalysisRequestSchema.safeParse(req).success, c.id).toBe(true);
      expect(c.resumeText.length).toBeLessThanOrEqual(LIMITS.resumeText.max);
    }
  });

  it('uses fictional labels and placeholder contact details only', () => {
    for (const c of EVAL_CASES) {
      expect(c.resumeText, c.id).toContain('(fictional)');
      expect(c.job.company, c.id).toMatch(/\(fictional company\)$/);
      for (const [email] of c.resumeText.matchAll(/[\w.+-]+@[\w.-]+/g)) {
        expect(email).toMatch(/@example\.com$/);
      }
      expect(c.resumeText).not.toMatch(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/);
    }
  });
});

describe('evaluateAnalysis (offline baseline)', () => {
  it('passes the demo fixture expressed as model output', () => {
    const result = evaluateAnalysis(DEMO_CASE, demoModelOutput());
    expect(result.pass).toBe(true);
    expect(result.checks).toMatchObject({
      mapValid: true,
      groundedQuoteRate: 1,
      keptRecommendationRate: 1,
      gapListed: true,
      gapNotOverstated: true,
    });
  });

  it('fails output with invented quotes or an overstated gap', () => {
    const invented = demoModelOutput();
    for (const comp of invented.competencies) {
      comp.evidence = comp.evidence.map((e) => ({
        ...e,
        quote: `${e.quote} at a Fortune 500 bank`,
      }));
    }
    expect(evaluateAnalysis(DEMO_CASE, invented).checks.groundedQuoteRate).toBe(0);
    expect(evaluateAnalysis(DEMO_CASE, invented).pass).toBe(false);

    const overstated = demoModelOutput();
    const k8s = overstated.competencies.find((c) => c.id === 'c8')!;
    k8s.evidence = [
      { quote: 'Tools: Git, GitHub Actions, Docker, Postman, Linux', section: 'experience' },
    ];
    k8s.proposedStrength = 'strong';
    const result = evaluateAnalysis(DEMO_CASE, overstated);
    expect(result.checks.gapNotOverstated).toBe(false);
    expect(result.pass).toBe(false);
  });
});
