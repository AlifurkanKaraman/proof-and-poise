/**
 * score-formulas.ts
 * Deterministic scoring formulas. All results are integers [0, 100].
 */

import type { Competency } from '../schemas/competency.js';
import type { Keyword } from '../schemas/keywords.js';
import type { Dimension } from '../schemas/base.js';
import { strengthValue, importanceWeight } from './strength-rules.js';
import { LIMITS } from '../limits.js';

/**
 * Job Match Score = 100 × Σ(w·s) / Σ(w)
 * Weighted average of competency strengths by importance.
 */
export function calculateJobMatch(competencies: Competency[]): number {
  if (competencies.length === 0) return 0;

  let weightedSum = 0;
  let weightSum = 0;

  for (const comp of competencies) {
    const w = importanceWeight(comp.importance);
    const s = strengthValue(comp.strength);
    weightedSum += w * s;
    weightSum += w;
  }

  return weightSum > 0 ? Math.round((100 * weightedSum) / weightSum) : 0;
}

/**
 * Evidence Coverage = 100 × Σ(w · [s > 0]) / Σ(w)
 * Weighted share of competencies with ANY verified evidence.
 */
export function calculateEvidenceCoverage(competencies: Competency[]): number {
  if (competencies.length === 0) return 0;

  let weightedCovered = 0;
  let weightSum = 0;

  for (const comp of competencies) {
    const w = importanceWeight(comp.importance);
    const hasEvidence = strengthValue(comp.strength) > 0 ? 1 : 0;
    weightedCovered += w * hasEvidence;
    weightSum += w;
  }

  return weightSum > 0 ? Math.round((100 * weightedCovered) / weightSum) : 0;
}

/**
 * Keyword Coverage = 100 × matched / total
 * Required keywords count twice.
 */
export function calculateKeywordCoverage(keywords: Keyword[]): number {
  if (keywords.length === 0) return 100; // No keywords required

  let totalWeight = 0;
  let matchedWeight = 0;

  for (const kw of keywords) {
    const weight = kw.required ? 2 : 1;
    totalWeight += weight;
    if (kw.matched) {
      matchedWeight += weight;
    }
  }

  return totalWeight > 0 ? Math.round((100 * matchedWeight) / totalWeight) : 100;
}

/**
 * Resume Parseability Score (deterministic checklist, max 100).
 */
export interface ParseabilityDetails {
  hasMinLength: boolean;
  hasStandardHeadings: boolean;
  hasContact: boolean;
  hasDates: boolean;
  hasBulletStructure: boolean;
  lowGarbledRatio: boolean;
  wordCountInRange: boolean;
}

export function calculateParseability(
  resumeText: string,
  isPasted: boolean
): { score: number; details: ParseabilityDetails } {
  // Gate: must have minimum length
  if (resumeText.length < LIMITS.RESUME_TEXT_MIN_CHARS) {
    return {
      score: 0,
      details: {
        hasMinLength: false,
        hasStandardHeadings: false,
        hasContact: false,
        hasDates: false,
        hasBulletStructure: false,
        lowGarbledRatio: false,
        wordCountInRange: false,
      },
    };
  }

  const normalized = resumeText.toLowerCase();
  const words = resumeText.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  const details: ParseabilityDetails = {
    hasMinLength: true, // Passed gate
    hasStandardHeadings: hasResumeHeadings(normalized),
    hasContact: hasContactInfo(normalized),
    hasDates: hasDatePatterns(resumeText),
    hasBulletStructure: hasBulletPoints(resumeText),
    lowGarbledRatio: checkGarbledRatio(resumeText),
    wordCountInRange:
      wordCount >= LIMITS.PARSEABILITY_MIN_WORD_COUNT && wordCount <= LIMITS.PARSEABILITY_MAX_WORD_COUNT,
  };

  // Each check worth points (total 100)
  let score = 0;
  if (details.hasStandardHeadings) score += 25;
  if (details.hasContact) score += 15;
  if (details.hasDates) score += 15;
  if (details.hasBulletStructure) score += 15;
  if (details.lowGarbledRatio) score += 15;
  if (details.wordCountInRange) score += 15;

  return { score, details };
}

function hasResumeHeadings(text: string): boolean {
  const headings = ['experience', 'education', 'skills', 'projects', 'work history'];
  return headings.some((h) => text.includes(h));
}

function hasContactInfo(text: string): boolean {
  const emailPattern = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
  const phonePattern = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  return emailPattern.test(text) || phonePattern.test(text);
}

function hasDatePatterns(text: string): boolean {
  const datePattern = /\b(20\d{2}|19\d{2})\b|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i;
  return datePattern.test(text);
}

function hasBulletPoints(text: string): boolean {
  const bulletPattern = /^[\s]*[•\-\*\u2022\u2023\u25E6\u2043\u2219]/gm;
  const matches = text.match(bulletPattern);
  return matches ? matches.length >= 3 : false;
}

function checkGarbledRatio(text: string): boolean {
  const totalChars = text.length;
  const garbledPattern = /[^\x20-\x7E\n\r\t\u00A0-\u024F]/g;
  const garbledMatches = text.match(garbledPattern);
  const garbledCount = garbledMatches ? garbledMatches.length : 0;
  const ratio = garbledCount / totalChars;
  return ratio < LIMITS.PARSEABILITY_MAX_GARBLED_RATIO;
}

/**
 * Answer Score (1-4) from evaluation dimensions.
 * Weighted mean of dimensions: relevance 20, specificity 15, evidence 20,
 * STAR 10, clarity 10, ownership 15, role_connection 10.
 * For non-behavioral questions, STAR weight redistributed proportionally.
 */
export function calculateAnswerScore(
  dimensions: Partial<Record<Dimension, { score: number } | null>>,
  isBehavioral: boolean
): number {
  const weights: Record<Dimension, number> = {
    relevance: 20,
    specificity: 15,
    evidence: 20,
    star: isBehavioral ? 10 : 0,
    clarity: 10,
    ownership: 15,
    role_connection: 10,
  };

  // If not behavioral, redistribute STAR weight proportionally
  if (!isBehavioral) {
    const totalWithoutStar = 80; // Sum of other weights
    const redistributed = 10 / totalWithoutStar;
    for (const dim in weights) {
      if (dim !== 'star') {
        weights[dim as Dimension] *= 1 + redistributed;
      }
    }
  }

  let weightedSum = 0;
  let weightSum = 0;

  for (const dim in dimensions) {
    const dimScore = dimensions[dim as Dimension];
    if (dimScore && dimScore.score) {
      const weight = weights[dim as Dimension] || 0;
      weightedSum += weight * dimScore.score;
      weightSum += weight;
    }
  }

  return weightSum > 0 ? weightedSum / weightSum : 1;
}

/**
 * Question Score = max(primary, (primary + followUp) / 2)
 * A follow-up can only help, never hurt.
 */
export function calculateQuestionScore(primaryScore: number, followUpScore?: number): number {
  if (!followUpScore) {
    return primaryScore;
  }
  const avgScore = (primaryScore + followUpScore) / 2;
  return Math.max(primaryScore, avgScore);
}

/**
 * Interview Performance P = Σ(qScore_norm × w_q) / Σ w_q
 * qScore_norm = (score − 1) / 3 (normalizes 1-4 to 0-1)
 * w_q = highest importance weight among competencies the question targets
 */
export function calculateInterviewPerformance(
  questionScores: { score: number; competencyIds: string[] }[],
  competenciesById: Map<string, Competency>
): number {
  if (questionScores.length === 0) return 0;

  let weightedSum = 0;
  let weightSum = 0;

  for (const q of questionScores) {
    const qScoreNorm = (q.score - 1) / 3;
    const maxImportance = Math.max(
      ...q.competencyIds.map((id) => {
        const comp = competenciesById.get(id);
        return comp ? importanceWeight(comp.importance) : 1;
      })
    );
    weightedSum += qScoreNorm * maxImportance;
    weightSum += maxImportance;
  }

  return weightSum > 0 ? weightedSum / weightSum : 0;
}

/**
 * Interview Readiness = 100 × (0.7·P + 0.3·JobMatch/100)
 */
export function calculateInterviewReadiness(performanceScore: number, jobMatch: number): number {
  const p = performanceScore; // Already 0-1
  const j = jobMatch / 100; // Normalize to 0-1
  return Math.round(100 * (0.7 * p + 0.3 * j));
}
