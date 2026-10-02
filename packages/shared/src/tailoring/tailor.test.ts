import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEMO_EVIDENCE_MAP, DEMO_RESUME_TEXT } from '../fixtures/demo';
import { containsTerm } from '../keywords/match';
import {
  ADDED_SKILLS_LABEL,
  applySkillAdditions,
  findSkillsSection,
  scoreTrail,
  tailoringPlan,
} from './tailor';

describe('findSkillsSection', () => {
  it('finds a Skills heading block and stops at the next heading', () => {
    const text =
      'Jo Example\nTechnical Skills\nLanguages: Java, C#\nTools: Git\n\nEducation\nBS, 2020';
    expect(findSkillsSection(text)?.text).toBe('Technical Skills\nLanguages: Java, C#\nTools: Git');
  });
  it('accepts an inline "Skills:" line and returns null without one', () => {
    expect(findSkillsSection('Skills: Java, Go\nExperience')?.text).toBe('Skills: Java, Go');
    expect(findSkillsSection('Experience\nBuilt things.')).toBeNull();
  });
});

describe('tailoringPlan (design §7.6)', () => {
  const plan = tailoringPlan(DEMO_EVIDENCE_MAP, DEMO_RESUME_TEXT);
  it('suggests only job keywords the resume already shows outside Skills', () => {
    expect(plan.addToSkills.map((s) => s.term)).toEqual([
      'REST APIs',
      'Unit tests',
      'Integration tests',
    ]);
    for (const s of plan.addToSkills) expect(containsTerm(DEMO_RESUME_TEXT, s.term)).toBe(true);
  });
  it('never suggests adding a keyword the resume does not show', () => {
    expect(plan.notShown.map((g) => g.term)).toContain('Kubernetes');
    expect(plan.addToSkills.map((s) => s.term)).not.toContain('Kubernetes');
    expect(plan.notShown.find((g) => g.term === 'Kubernetes')?.competencyId).toBe('c8');
  });
  it('lists required keywords first', () => {
    const req = plan.notShown.map((g) => g.required);
    expect(req).toEqual([...req].sort((a, b) => Number(b) - Number(a)));
  });
  it('counts a confirmation as evidence for a keyword', () => {
    const map = JSON.parse(JSON.stringify(DEMO_EVIDENCE_MAP)) as typeof DEMO_EVIDENCE_MAP;
    map.competencies[7]!.evidence.push({
      id: 'cf1',
      source: 'candidate_confirmation',
      quote: 'I deployed two services on Kubernetes in a university cluster.',
    });
    const p = tailoringPlan(map, DEMO_RESUME_TEXT);
    expect(p.addToSkills).toContainEqual({
      term: 'Kubernetes',
      required: true,
      source: 'confirmation',
    });
  });
});

describe('applySkillAdditions', () => {
  it('adds one labeled line inside the Skills section', () => {
    const out = applySkillAdditions(DEMO_RESUME_TEXT, ['REST APIs', 'Unit tests']);
    expect(findSkillsSection(out)?.text).toContain(`${ADDED_SKILLS_LABEL} REST APIs, Unit tests`);
  });
  it('creates a Skills section when the resume has none', () => {
    expect(applySkillAdditions('Experience\nBuilt APIs.', ['Java'])).toBe(
      `Experience\nBuilt APIs.\n\nSkills\n${ADDED_SKILLS_LABEL} Java\n`,
    );
  });
  it('returns the text unchanged with nothing to add', () => {
    expect(applySkillAdditions(DEMO_RESUME_TEXT, [])).toBe(DEMO_RESUME_TEXT);
  });
  it('never changes or removes an existing line', () => {
    const lineArb = fc.stringMatching(/^[A-Za-z ,.:]{0,30}$/);
    fc.assert(
      fc.property(
        fc.array(lineArb, { maxLength: 12 }),
        fc.boolean(),
        fc.array(fc.stringMatching(/^[A-Za-z]{1,10}$/), { maxLength: 4 }),
        (body, withSkills, terms) => {
          const text = (withSkills ? [...body, 'Skills', 'Tools: Git'] : body).join('\n');
          const out = applySkillAdditions(text, terms).split('\n');
          let i = 0;
          for (const line of text.split('\n')) {
            while (i < out.length && out[i] !== line) i++;
            if (i === out.length) return false;
            i++;
          }
          return true;
        },
      ),
    );
  });
});

describe('scoreTrail', () => {
  it('uses the first event as the analysis-time value', () => {
    const scores = { ...DEMO_EVIDENCE_MAP.scores, keywordCoverage: 70 };
    const trail = scoreTrail(scores, [
      { metric: 'keywordCoverage', before: 60 },
      { metric: 'keywordCoverage', before: 65 },
    ]);
    expect(trail.find((t) => t.metric === 'keywordCoverage')).toEqual({
      metric: 'keywordCoverage',
      atAnalysis: 60,
      now: 70,
    });
    expect(trail.find((t) => t.metric === 'jobMatch')?.atAnalysis).toBe(scores.jobMatch);
  });
});
