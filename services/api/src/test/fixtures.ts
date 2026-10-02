/**
 * The fictional demo analysis (design §15) expressed as the model output that would
 * produce it. Used by unit tests and the offline prompt evaluation baseline.
 */
import {
  DEMO_EVIDENCE_MAP,
  DEMO_PROPOSED_STRENGTHS,
  type AnalysisModelOutput,
} from '@proof-and-poise/shared';

/** Verbatim phrases from DEMO_JOB each demo competency comes from (design §7.4). */
export const DEMO_JOB_QUOTES: Record<string, string> = {
  c1: 'Experience writing production-quality code in Python or TypeScript',
  c2: 'Experience building REST APIs',
  c3: 'serverless functions on AWS (AWS Lambda, API Gateway, DynamoDB)',
  c4: 'CI/CD pipelines (GitHub Actions or similar)',
  c5: 'A habit of writing automated tests',
  c6: 'Infrastructure as code (AWS CDK, Terraform, or CloudFormation)',
  c7: 'Monitoring and on-call experience with CloudWatch or similar tools',
  c8: 'Working knowledge of containers (Docker) and Kubernetes',
};

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
      jobQuote: DEMO_JOB_QUOTES[c.id] ?? '',
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
