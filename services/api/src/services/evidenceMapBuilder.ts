/**
 * Converts validated analysis model output into an EvidenceMap (design §4, §6, §7.4).
 * Every rule here is deterministic shared code; the model only supplied language:
 *
 * - Resume quotes that aren't normalized substrings of the resume are discarded (Req 5.4).
 * - Strengths are capped by the evidence that survived (design §6.1); no evidence → `none`.
 * - Recommendations must have `originalText` in the resume (Req 7.2), add no unsupported
 *   numbers or terms (Req 7.3), and carry a label that passes validation (design §7.4).
 *   At most 10 are kept (Req 7.8).
 * - Keyword matches, parseability, and scores are computed, never taken from the model
 *   (Req 6.1).
 * The result is parsed with the stored EvidenceMap schema before it can become state.
 */
import {
  canonicalTerm,
  competencyReadiness,
  capStrength,
  EvidenceMapSchema,
  evidenceCoverageScore,
  isGroundedQuote,
  jobMatchScore,
  keywordCoverageScore,
  LIMITS,
  matchKeywords,
  normalize,
  parseabilityScore,
  validateRecommendation,
  type AnalysisModelOutput,
  type Competency,
  type Evidence,
  type EvidenceMap,
  type Recommendation,
} from '@proof-and-poise/shared';
import { ApiError } from '../lib/errors';

export interface BuildEvidenceMapInput {
  output: AnalysisModelOutput;
  /** The (possibly truncated) resume text the model saw. */
  resumeText: string;
  inputKind: 'pdf' | 'text';
}

export interface BuildEvidenceMapResult {
  evidenceMap: EvidenceMap;
  /** Counts only; safe to log (design §7.4). */
  stats: { discardedQuotes: number; discardedRecommendations: number };
}

/** Resolve a cited quote to an existing evidence item (either one containing the other). */
function resolveEvidence(quote: string, all: readonly Evidence[]): Evidence | undefined {
  const q = normalize(quote);
  if (q.length < LIMITS.grounding.minQuoteChars) return undefined;
  return all.find((e) => {
    const n = normalize(e.quote);
    return n === q || n.includes(q) || q.includes(n);
  });
}

export function buildEvidenceMap({
  output,
  resumeText,
  inputKind,
}: BuildEvidenceMapInput): BuildEvidenceMapResult {
  let discardedQuotes = 0;
  let discardedRecommendations = 0;
  let evidenceSeq = 0;

  // --- Competencies: grounding filter, then strength caps -------------------------------
  const competencies: Competency[] = output.competencies.map((c) => {
    const seen = new Set<string>();
    const evidence: Evidence[] = [];
    for (const e of c.evidence) {
      const n = normalize(e.quote);
      if (seen.has(n)) continue;
      seen.add(n);
      if (!isGroundedQuote(e.quote, [resumeText])) {
        discardedQuotes++;
        continue;
      }
      evidence.push({
        id: `e${++evidenceSeq}`,
        source: 'resume',
        quote: e.quote,
        section: e.section,
      });
    }
    const { strength } = capStrength(c.proposedStrength, evidence);
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      importance: c.importance,
      category: c.category,
      evidence,
      strength,
      missingEvidence: c.missingEvidence,
      suggestedInterviewTopic: c.suggestedInterviewTopic,
      confirmationState: 'none',
      recommendationIds: [],
      readiness: competencyReadiness(strength, null),
      interviewPriority: false,
    };
  });

  // --- Keywords: dedupe by canonical term, then deterministic matching -------------------
  const seenTerms = new Set<string>();
  const keywordSpecs = output.keywords.filter((k) => {
    const t = canonicalTerm(k.term);
    if (seenTerms.has(t)) return false;
    seenTerms.add(t);
    return true;
  });
  const keywords = matchKeywords(keywordSpecs, [resumeText]);
  const keywordTerms = keywords.map((k) => k.term);

  // --- Recommendations: grounding + novel-term + label validation ------------------------
  const allEvidence = competencies.flatMap((c) => c.evidence);
  const byId = new Map(competencies.map((c) => [c.id, c]));
  const recommendations: Recommendation[] = [];
  for (const r of output.recommendations) {
    const competency = byId.get(r.competencyId);
    const cited = r.sourceQuotes
      .map((q) => resolveEvidence(q, allEvidence))
      .filter((e): e is Evidence => e !== undefined);
    const sourceEvidence = [...new Map(cited.map((e) => [e.id, e])).values()];
    const unchanged =
      r.proposedText !== null && normalize(r.proposedText) === normalize(r.originalText);
    const check = validateRecommendation(
      {
        trustLabel: r.trustLabel,
        originalText: r.originalText,
        proposedText: r.proposedText,
        sourceEvidence,
      },
      { resumeText, confirmations: [], keywords: keywordTerms },
    );
    if (
      !competency ||
      unchanged ||
      !check.ok ||
      recommendations.length >= LIMITS.analysis.recommendations.max
    ) {
      discardedRecommendations++;
      continue;
    }
    const id = `r${recommendations.length + 1}`;
    recommendations.push({
      id,
      competencyId: r.competencyId,
      originalText: r.originalText,
      proposedText: r.proposedText,
      reason: r.reason,
      sourceEvidenceIds:
        r.trustLabel === 'verified_from_resume' ? sourceEvidence.map((e) => e.id) : [],
      trustLabel: r.trustLabel,
      decision: 'pending',
    });
    competency.recommendationIds.push(id);
  }

  // --- Deterministic scores (design §6.2) ------------------------------------------------
  const parseability = parseabilityScore(resumeText, inputKind);
  const candidate: EvidenceMap = {
    competencies,
    keywords,
    recommendations,
    seniority: output.seniority,
    parseability,
    scores: {
      jobMatch: jobMatchScore(competencies),
      evidenceCoverage: evidenceCoverageScore(competencies),
      keywordCoverage: keywordCoverageScore(keywords),
      parseability: parseability.score,
      interviewReadiness: null,
    },
    scoreEvents: [],
  };

  const parsed = EvidenceMapSchema.safeParse(candidate);
  if (!parsed.success) throw new ApiError('MODEL_OUTPUT_INVALID');
  return { evidenceMap: parsed.data, stats: { discardedQuotes, discardedRecommendations } };
}
