import { matchKeywords } from '../keywords/match';
import type { EvidenceMap, Keyword, Recommendation, ScoreSet } from '../schemas/evidenceMap';
import { evidenceCoverageScore, jobMatchScore, keywordCoverageScore } from './scores';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Replace `original` in `text` with `replacement`. Tries an exact match first, then a
 * case-insensitive match with flexible whitespace (since `originalText` is only
 * guaranteed to be a *normalized* substring). Returns null when not found.
 */
function replaceOnce(text: string, original: string, replacement: string): string | null {
  const exact = text.indexOf(original);
  if (exact >= 0) return text.slice(0, exact) + replacement + text.slice(exact + original.length);
  const pattern = original.trim().split(/\s+/).map(escapeRe).join('\\s+');
  if (pattern === '') return null;
  const m = new RegExp(pattern, 'i').exec(text);
  if (!m) return null;
  return text.slice(0, m.index) + replacement + text.slice(m.index + m[0].length);
}

export interface WorkingResume {
  text: string;
  /** IDs of accepted recommendations that were applied, in order. */
  applied: string[];
  /** IDs of accepted recommendations whose original text couldn't be located. */
  unapplied: string[];
}

/**
 * The working resume: the original resume with every accepted recommendation applied
 * (Req 7.6–7.7). Nothing is applied without `decision === 'accepted'`.
 */
export function buildWorkingResume(
  resumeText: string,
  recommendations: readonly Pick<
    Recommendation,
    'id' | 'originalText' | 'proposedText' | 'decision'
  >[],
): WorkingResume {
  let text = resumeText;
  const applied: string[] = [];
  const unapplied: string[] = [];
  for (const r of recommendations) {
    if (r.decision !== 'accepted' || r.proposedText === null) continue;
    const next = replaceOnce(text, r.originalText, r.proposedText);
    if (next === null) unapplied.push(r.id);
    else {
      text = next;
      applied.push(r.id);
    }
  }
  return { text, applied, unapplied };
}

/** Candidate confirmation statements stored on the map. */
export function confirmationStatements(map: Pick<EvidenceMap, 'competencies'>): string[] {
  return map.competencies.flatMap((c) =>
    c.evidence.filter((e) => e.source === 'candidate_confirmation').map((e) => e.quote),
  );
}

/**
 * Recompute keyword matches and all evidence-map scores from the working resume and
 * confirmations. Interview Readiness is carried over; it is computed from turns.
 * Job Match and Evidence Coverage depend only on competency strengths, so accepting a
 * recommendation can never change them (design §6.3).
 */
export function recomputeScores(
  map: Pick<
    EvidenceMap,
    'competencies' | 'keywords' | 'recommendations' | 'parseability' | 'scores'
  >,
  resumeText: string,
): { scores: ScoreSet; keywords: Keyword[]; workingResume: WorkingResume } {
  const workingResume = buildWorkingResume(resumeText, map.recommendations);
  const keywords = matchKeywords(map.keywords, [
    workingResume.text,
    ...confirmationStatements(map),
  ]);
  return {
    keywords,
    workingResume,
    scores: {
      jobMatch: jobMatchScore(map.competencies),
      evidenceCoverage: evidenceCoverageScore(map.competencies),
      keywordCoverage: keywordCoverageScore(keywords),
      parseability: map.parseability.score,
      interviewReadiness: map.scores.interviewReadiness,
    },
  };
}
