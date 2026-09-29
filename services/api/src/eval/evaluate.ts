/**
 * Scoring for the analysis prompt evaluation (task 9). Pure: takes validated model output
 * and reports how much of it survives the server's truthfulness rules. Only counts and
 * pass/fail flags come out, never resume or model text.
 */
import { type AnalysisModelOutput, type EvidenceMap } from '@proof-and-poise/shared';
import { ApiError } from '../lib/errors';
import { buildEvidenceMap } from '../services/evidenceMapBuilder';
import type { EvalCase } from './samples';

/** Pass thresholds. A case passes only when every check holds. */
export const EVAL_THRESHOLDS = {
  /** Share of model evidence quotes that are verbatim (normalized) resume substrings. */
  minGroundedQuoteRate: 0.8,
  /** Share of model recommendations that pass grounding and label validation. */
  minKeptRecommendationRate: 0.5,
} as const;

export interface EvalResult {
  caseId: string;
  pass: boolean;
  checks: {
    mapValid: boolean;
    groundedQuoteRate: number;
    keptRecommendationRate: number;
    /** A competency for the known gap (a job requirement) was listed. */
    gapListed: boolean;
    /** The known gap isn't rated moderate or strong after server caps. */
    gapNotOverstated: boolean;
    /** At least one competency has grounded evidence. */
    hasEvidence: boolean;
  };
  counts: { competencies: number; quotes: number; recommendations: number; keywords: number };
}

export function evaluateAnalysis(c: EvalCase, output: AnalysisModelOutput): EvalResult {
  const quotes = output.competencies.reduce((n, comp) => n + comp.evidence.length, 0);
  const recs = output.recommendations.length;
  let map: EvidenceMap | null = null;
  let discardedQuotes = quotes;
  let discardedRecommendations = recs;
  try {
    const built = buildEvidenceMap({ output, resumeText: c.resumeText, inputKind: 'text' });
    map = built.evidenceMap;
    ({ discardedQuotes, discardedRecommendations } = built.stats);
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
  }
  const rate = (kept: number, total: number) => (total === 0 ? 1 : kept / total);
  const groundedQuoteRate = rate(quotes - discardedQuotes, quotes);
  const keptRecommendationRate = rate(recs - discardedRecommendations, recs);
  const gaps = map?.competencies.filter((comp) => c.expectedGap.test(comp.name)) ?? [];
  const checks = {
    mapValid: map !== null,
    groundedQuoteRate,
    keptRecommendationRate,
    gapListed: gaps.length > 0,
    gapNotOverstated: gaps.every((g) => g.strength === 'weak' || g.strength === 'none'),
    hasEvidence: map?.competencies.some((comp) => comp.evidence.length > 0) ?? false,
  };
  return {
    caseId: c.id,
    pass:
      checks.mapValid &&
      checks.hasEvidence &&
      checks.gapListed &&
      checks.gapNotOverstated &&
      groundedQuoteRate >= EVAL_THRESHOLDS.minGroundedQuoteRate &&
      keptRecommendationRate >= EVAL_THRESHOLDS.minKeptRecommendationRate,
    checks,
    counts: {
      competencies: output.competencies.length,
      quotes,
      recommendations: recs,
      keywords: output.keywords.length,
    },
  };
}
