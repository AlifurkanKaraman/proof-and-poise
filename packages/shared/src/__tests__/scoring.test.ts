/**
 * scoring.test.ts
 * Unit tests for scoring functions.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateJobMatch,
  calculateEvidenceCoverage,
  calculateKeywordCoverage,
  calculateParseability,
  calculateAnswerScore,
  calculateQuestionScore,
  applyStrengthRules,
  strengthValue,
  importanceWeight,
} from '../scoring/index.js';
import type { Competency } from '../schemas/competency.js';
import type { Keyword } from '../schemas/keywords.js';

describe('Scoring - Strength Rules', () => {
  it('should return "none" for competency with no evidence', () => {
    const result = applyStrengthRules('strong', []);
    expect(result.strength).toBe('none');
    expect(result.reason).toContain('No evidence');
  });

  it('should cap strength to "moderate" for confirmation-only evidence', () => {
    const evidence = [{ id: 'e1', source: 'candidate_confirmation' as const, quote: 'I have AWS experience' }];
    const result = applyStrengthRules('strong', evidence);
    expect(result.strength).toBe('moderate');
  });

  it('should cap strength to "weak" for skills-section-only evidence', () => {
    const evidence = [
      { id: 'e1', source: 'resume' as const, quote: 'AWS, Python, Docker', section: 'skills' as const },
    ];
    const result = applyStrengthRules('strong', evidence);
    expect(result.strength).toBe('weak');
  });

  it('should allow proposed strength for substantive evidence', () => {
    const evidence = [
      {
        id: 'e1',
        source: 'resume' as const,
        quote: 'Led migration to AWS, reducing costs by 30%',
        section: 'experience' as const,
      },
    ];
    const result = applyStrengthRules('strong', evidence);
    expect(result.strength).toBe('strong');
  });
});

describe('Scoring - Job Match', () => {
  it('should return 0 for empty competencies', () => {
    expect(calculateJobMatch([])).toBe(0);
  });

  it('should calculate weighted average correctly', () => {
    const competencies: Partial<Competency>[] = [
      { importance: 'required', strength: 'strong' }, // w=3, s=1.0 → 3.0
      { importance: 'preferred', strength: 'moderate' }, // w=2, s=0.6 → 1.2
      { importance: 'contextual', strength: 'weak' }, // w=1, s=0.3 → 0.3
    ];
    // Total: (3.0 + 1.2 + 0.3) / (3 + 2 + 1) = 4.5 / 6 = 0.75 → 75
    const score = calculateJobMatch(competencies as Competency[]);
    expect(score).toBe(75);
  });

  it('should round to nearest integer', () => {
    const competencies: Partial<Competency>[] = [
      { importance: 'required', strength: 'moderate' }, // 3 * 0.6 = 1.8
      { importance: 'required', strength: 'weak' }, // 3 * 0.3 = 0.9
    ];
    // Total: 2.7 / 6 = 0.45 → 45
    const score = calculateJobMatch(competencies as Competency[]);
    expect(score).toBe(45);
  });
});

describe('Scoring - Evidence Coverage', () => {
  it('should return 0 for empty competencies', () => {
    expect(calculateEvidenceCoverage([])).toBe(0);
  });

  it('should calculate weighted share with evidence', () => {
    const competencies: Partial<Competency>[] = [
      { importance: 'required', strength: 'strong' }, // Has evidence
      { importance: 'preferred', strength: 'none' }, // No evidence
      { importance: 'contextual', strength: 'weak' }, // Has evidence
    ];
    // Covered: 3 + 1 = 4, Total: 3 + 2 + 1 = 6 → 4/6 = 0.667 → 67
    const score = calculateEvidenceCoverage(competencies as Competency[]);
    expect(score).toBe(67);
  });
});

describe('Scoring - Keyword Coverage', () => {
  it('should return 100 for no keywords', () => {
    expect(calculateKeywordCoverage([])).toBe(100);
  });

  it('should weight required keywords 2x', () => {
    const keywords: Keyword[] = [
      { term: 'python', required: true, matched: true }, // weight 2
      { term: 'docker', required: false, matched: true }, // weight 1
      { term: 'kubernetes', required: true, matched: false }, // weight 2, not matched
    ];
    // Matched: 2 + 1 = 3, Total: 2 + 1 + 2 = 5 → 3/5 = 0.6 → 60
    const score = calculateKeywordCoverage(keywords);
    expect(score).toBe(60);
  });
});

describe('Scoring - Parseability', () => {
  it('should return 0 for text below minimum length', () => {
    const result = calculateParseability('Short text', false);
    expect(result.score).toBe(0);
    expect(result.details.hasMinLength).toBe(false);
  });

  it('should score based on checklist', () => {
    const resumeText = `
      John Doe
      john@example.com | (555) 123-4567

      Experience
      Software Engineer at TechCo | 2020-2023
      • Developed microservices using Python and AWS
      • Led team of 3 engineers
      • Reduced deployment time by 50%

      Education
      BS Computer Science, University of XYZ | 2016-2020

      Skills
      Python, JavaScript, AWS, Docker, Kubernetes
    `.repeat(5); // Make it long enough

    const result = calculateParseability(resumeText, false);
    expect(result.score).toBeGreaterThan(50);
    expect(result.details.hasStandardHeadings).toBe(true);
    expect(result.details.hasContact).toBe(true);
    expect(result.details.hasDates).toBe(true);
    expect(result.details.hasBulletStructure).toBe(true);
  });
});

describe('Scoring - Answer Score', () => {
  it('should calculate weighted mean of dimensions', () => {
    const dimensions = {
      relevance: { score: 4 },
      specificity: { score: 3 },
      evidence: { score: 4 },
      star: { score: 2 },
      clarity: { score: 3 },
      ownership: { score: 4 },
      role_connection: { score: 3 },
    };
    const score = calculateAnswerScore(dimensions, true);
    // Weighted: (20*4 + 15*3 + 20*4 + 10*2 + 10*3 + 15*4 + 10*3) / 100
    // = (80 + 45 + 80 + 20 + 30 + 60 + 30) / 100 = 345 / 100 = 3.45
    expect(score).toBeCloseTo(3.45, 1);
  });

  it('should redistribute STAR weight for non-behavioral', () => {
    const dimensions = {
      relevance: { score: 4 },
      specificity: { score: 3 },
      evidence: { score: 4 },
      clarity: { score: 3 },
      ownership: { score: 4 },
      role_connection: { score: 3 },
    };
    const score = calculateAnswerScore(dimensions, false);
    expect(score).toBeGreaterThan(3);
    expect(score).toBeLessThan(4);
  });
});

describe('Scoring - Question Score', () => {
  it('should return primary score if no follow-up', () => {
    expect(calculateQuestionScore(3.5)).toBe(3.5);
  });

  it('should take max of primary and average with follow-up', () => {
    expect(calculateQuestionScore(3.0, 4.0)).toBe(3.5); // (3+4)/2 = 3.5 > 3
    expect(calculateQuestionScore(4.0, 2.0)).toBe(4.0); // (4+2)/2 = 3 < 4
  });
});

describe('Scoring - Strength and Importance Values', () => {
  it('should return correct strength values', () => {
    expect(strengthValue('strong')).toBe(1.0);
    expect(strengthValue('moderate')).toBe(0.6);
    expect(strengthValue('weak')).toBe(0.3);
    expect(strengthValue('none')).toBe(0.0);
  });

  it('should return correct importance weights', () => {
    expect(importanceWeight('required')).toBe(3);
    expect(importanceWeight('preferred')).toBe(2);
    expect(importanceWeight('contextual')).toBe(1);
  });
});
