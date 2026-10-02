import type { TrustLabel } from '../schemas/common';
import { addedTerms, addedTermsSupportedBy, isEmptyNovelTerms, novelTerms } from './novelTerms';
import { isGroundedQuote } from './quotes';

export type RecommendationRejection =
  | 'original_not_in_resume'
  | 'missing_proposed_text'
  | 'unexpected_proposed_text'
  | 'novel_terms'
  | 'rewording_adds_terms'
  | 'missing_source_evidence'
  | 'source_evidence_not_grounded'
  | 'unsupported_added_terms';

export type RecommendationCheck =
  { ok: true } | { ok: false; reason: RecommendationRejection; novelCount?: number };

export interface RecommendationCandidate {
  trustLabel: TrustLabel;
  originalText: string;
  proposedText: string | null;
  /** Evidence the recommendation cites (resolved from `sourceEvidenceIds`). */
  sourceEvidence: readonly { source: 'resume' | 'candidate_confirmation'; quote: string }[];
}

export interface GroundingContext {
  resumeText: string;
  /** Candidate confirmation statements in this session. */
  confirmations: readonly string[];
  /** Job keywords (terms only). */
  keywords: readonly string[];
}

/**
 * Validate a recommendation and its trust label (design §7.4, Req 7.2–7.3, 8.3).
 * Returns a rejection reason code only; callers log the code/count, never the content.
 */
export function validateRecommendation(
  rec: RecommendationCandidate,
  ctx: GroundingContext,
): RecommendationCheck {
  if (!isGroundedQuote(rec.originalText, [ctx.resumeText])) {
    return { ok: false, reason: 'original_not_in_resume' };
  }

  if (rec.trustLabel === 'missing_evidence') {
    return rec.proposedText === null
      ? { ok: true }
      : { ok: false, reason: 'unexpected_proposed_text' };
  }
  if (rec.proposedText === null) return { ok: false, reason: 'missing_proposed_text' };

  const opts = { keywords: ctx.keywords };
  const allowed =
    rec.trustLabel === 'confirmed_by_candidate'
      ? [ctx.resumeText, ...ctx.confirmations]
      : [ctx.resumeText];

  const novel = novelTerms(rec.proposedText, rec.originalText, allowed, opts);
  if (!isEmptyNovelTerms(novel)) {
    return {
      ok: false,
      reason: 'novel_terms',
      novelCount: novel.numbers.length + novel.terms.length,
    };
  }

  const added = addedTerms(rec.proposedText, rec.originalText, opts);

  if (rec.trustLabel === 'rewording_only') {
    return isEmptyNovelTerms(added) ? { ok: true } : { ok: false, reason: 'rewording_adds_terms' };
  }

  // verified_from_resume | confirmed_by_candidate
  const requiredSource =
    rec.trustLabel === 'verified_from_resume' ? 'resume' : 'candidate_confirmation';
  if (!rec.sourceEvidence.some((e) => e.source === requiredSource)) {
    return { ok: false, reason: 'missing_source_evidence' };
  }
  const resumeQuotesGrounded = rec.sourceEvidence
    .filter((e) => e.source === 'resume')
    .every((e) => isGroundedQuote(e.quote, [ctx.resumeText]));
  if (!resumeQuotesGrounded) return { ok: false, reason: 'source_evidence_not_grounded' };

  if (
    rec.trustLabel === 'verified_from_resume' &&
    rec.sourceEvidence.some((e) => e.source !== 'resume')
  ) {
    return { ok: false, reason: 'missing_source_evidence' };
  }

  const quotes = rec.sourceEvidence.map((e) => e.quote);
  return addedTermsSupportedBy(added, quotes)
    ? { ok: true }
    : { ok: false, reason: 'unsupported_added_terms' };
}
