import { describe, expect, it } from 'vitest';
import { DEMO_JOB } from '@proof-and-poise/shared';
import { demoModelOutput } from '../../test/fixtures';
import {
  adviseAnalysisOutput,
  ANALYZE_SYSTEM_PROMPT,
  checkAnalysisOutput,
  isJobKeyword,
} from './analyze';

describe('checkAnalysisOutput job grounding (design §7.4)', () => {
  it('accepts output whose competencies and keywords come from the job', () => {
    expect(checkAnalysisOutput(demoModelOutput(), DEMO_JOB)).toEqual([]);
    expect(adviseAnalysisOutput(demoModelOutput(), DEMO_JOB)).toEqual([]);
  });

  it('asks for a repair when too few competencies quote the job', () => {
    const out = demoModelOutput();
    for (const c of out.competencies.slice(0, 3)) c.jobQuote = 'Manage projects and stakeholders';
    const issues = checkAnalysisOutput(out, DEMO_JOB);
    expect(issues).toContainEqual(expect.stringMatching(/^competencies\.jobQuote: .*c1, c2, c3/));
  });

  it('tolerates a single ungrounded competency (the builder drops it)', () => {
    const out = demoModelOutput();
    out.competencies[0]!.jobQuote = 'Manage projects and stakeholders';
    expect(checkAnalysisOutput(out, DEMO_JOB)).toEqual([]);
  });

  it('asks for concrete keywords when they just repeat competency names', () => {
    const out = demoModelOutput();
    out.keywords = out.competencies.map((c) => ({ term: c.name, required: true }));
    expect(checkAnalysisOutput(out, DEMO_JOB)).toEqual([]); // advisory only
    const issues = adviseAnalysisOutput(out, DEMO_JOB);
    expect(issues).toContainEqual(expect.stringMatching(/not competency names/));
  });

  it('asks for a repair when too few keywords appear in the job', () => {
    const out = demoModelOutput();
    out.keywords = out.keywords.map((k, i) => ({ ...k, term: `Invented tool ${i}` }));
    expect(checkAnalysisOutput(out, DEMO_JOB)).toEqual([]); // advisory only
    const issues = adviseAnalysisOutput(out, DEMO_JOB);
    expect(issues).toContainEqual(expect.stringMatching(/copied exactly from the job description/));
  });

  it('never echoes job or resume text in issues', () => {
    const out = demoModelOutput();
    for (const c of out.competencies) c.jobQuote = 'Secret phrase that is not in the job';
    expect(checkAnalysisOutput(out, DEMO_JOB).join('\n')).not.toContain('Secret phrase');
  });
});

describe('isJobKeyword', () => {
  it('matches case- and spacing-insensitively against the job text', () => {
    expect(isJobKeyword('aws  lambda', DEMO_JOB)).toBe(true);
    expect(isJobKeyword('Linux kernel', DEMO_JOB)).toBe(false);
    // Plurals and aliases count, like resume keyword matching.
    expect(isJobKeyword('REST API', DEMO_JOB)).toBe(true);
    expect(isJobKeyword('k8s', DEMO_JOB)).toBe(true);
  });
});

describe('analyze system prompt', () => {
  it('asks for job quotes, concrete keywords, and visible gaps', () => {
    expect(ANALYZE_SYSTEM_PROMPT).toMatch(/jobQuote/);
    expect(ANALYZE_SYSTEM_PROMPT).toMatch(/not use competency names/);
    expect(ANALYZE_SYSTEM_PROMPT).toMatch(/List them even when the resume lacks them/);
  });
});
