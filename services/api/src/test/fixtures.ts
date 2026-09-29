/**
 * The fictional demo analysis (design §15) expressed as the model output that would
 * produce it. Used by unit tests and the offline prompt evaluation baseline.
 */
import {
  DEMO_EVIDENCE_MAP,
  DEMO_PROPOSED_STRENGTHS,
  type AnalysisModelOutput,
} from '@proof-and-poise/shared';

export function demoModelOutput(): AnalysisModelOutput {
  const map = DEMO_EVIDENCE_MAP;
  const quoteById = new Map(
    map.competencies.flatMap((c) => c.evidence.map((e) => [e.id, e.quote] as const)),
  );
  return {
    seniority: map.seniority,
    competencies: map.competencies.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      importance: c.importance,
      category: c.category,
      evidence: c.evidence.map((e) => ({ quote: e.quote, section: e.section ?? 'other' })),
      proposedStrength: DEMO_PROPOSED_STRENGTHS[c.id] ?? 'none',
      missingEvidence: c.missingEvidence,
      suggestedInterviewTopic: c.suggestedInterviewTopic,
    })),
    keywords: map.keywords.map(({ term, required }) => ({ term, required })),
    recommendations: map.recommendations.map((r) => ({
      competencyId: r.competencyId,
      originalText: r.originalText,
      proposedText: r.proposedText,
      reason: r.reason,
      trustLabel: r.trustLabel as 'verified_from_resume' | 'missing_evidence' | 'rewording_only',
      sourceQuotes: r.sourceEvidenceIds.map((id) => quoteById.get(id) ?? ''),
    })),
  };
}
