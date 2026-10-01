/**
 * Converts validated analysis model output into an EvidenceMap (design §4, §6, §7.4).
 * Every rule here is deterministic shared code; the model only supplied language:
 *
 * - Resume quotes that aren't normalized substrings of the resume are discarded (Req 5.4).
 * - Strengths are capped by the evidence that survived (design §6.1); no evidence → `none`.
 * - Competencies whose `jobQuote` isn't grounded in the job, and keywords that don't appear
 *   in the job, are dropped (design §7.4).
 * - Recommendations must have `originalText` in the resume (Req 7.2), add no unsupported
 *   numbers or terms (Req 7.3), and carry a label that passes validation (design §7.4).
 *   Trivial `rewording_only` cards are dropped. At most 10 are kept (Req 7.8).
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
  type JobInput,
  type Recommendation,
} from '@proof-and-poise/shared';
import { isJobKeyword, jobSources } from '../ai/prompts/analyze';
import { ApiError } from '../lib/errors';

export interface BuildEvidenceMapInput {
  output: AnalysisModelOutput;
  /** The (possibly truncated) resume text the model saw. */
  resumeText: string;
  /** The job the model saw; competencies and keywords must come from it. */
  job: Pick<JobInput, 'description' | 'role'>;
  inputKind: 'pdf' | 'text';
}

export interface BuildEvidenceMapResult {
  evidenceMap: EvidenceMap;
  /** Counts only; safe to log (design §7.4). */
  stats: {
    discardedQuotes: number;
    discardedRecommendations: number;
    discardedCompetencies: number;
    discardedKeywords: number;
  };
}

/** Words added plus words removed, counted as multisets of normalized tokens. */
export function changedWordCount(original: string, proposed: string): number {
  const count = (t: string) => {
    const m = new Map<string, number>();
    for (const w of normalize(t).split(' ').filter(Boolean)) m.set(w, (m.get(w) ?? 0) + 1);
    return m;
  };
  const a = count(original);
  const b = count(proposed);
  let changed = 0;
  for (const w of new Set([...a.keys(), ...b.keys()])) {
    changed += Math.abs((a.get(w) ?? 0) - (b.get(w) ?? 0));
  }
  return changed;
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
  job,
  inputKind,
}: BuildEvidenceMapInput): BuildEvidenceMapResult {
  let discardedQuotes = 0;
  let discardedRecommendations = 0;
  let evidenceSeq = 0;

  // --- Competencies: job grounding, evidence grounding, then strength caps -------------
  const fromJob = output.competencies.filter((c) => isGroundedQuote(c.jobQuote, jobSources(job)));
  const discardedCompetencies = output.competencies.length - fromJob.length;
  const competencies: Competency[] = fromJob.map((c) => {
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
  const distinctSpecs = output.keywords.filter((k) => {
    const t = canonicalTerm(k.term);
    if (seenTerms.has(t)) return false;
    seenTerms.add(t);
    return true;
  });
  // Keywords not in the job are dropped; if that would leave fewer than the minimum, the
  // first ungrounded ones are kept so the map stays valid (design §7.4).
  const inJob = distinctSpecs.filter((k) => isJobKeyword(k.term, job));
  const topUp = distinctSpecs
    .filter((k) => !isJobKeyword(k.term, job))
    .slice(0, Math.max(0, LIMITS.analysis.keywords.min - inJob.length));
  const keep = new Set([...inJob, ...topUp]);
  const keywordSpecs = distinctSpecs.filter((k) => keep.has(k));
  const discardedKeywords = distinctSpecs.length - keywordSpecs.length;
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
    const trivial =
      r.trustLabel === 'rewording_only' &&
      r.proposedText !== null &&
      changedWordCount(r.originalText, r.proposedText) < LIMITS.analysis.minRewordingChangedWords;
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
      trivial ||
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
  return {
    evidenceMap: parsed.data,
    stats: { discardedQuotes, discardedRecommendations, discardedCompetencies, discardedKeywords },
  };
}
