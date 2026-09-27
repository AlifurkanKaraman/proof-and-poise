import { matchKeywords } from '../../keywords/match';
import type { ConfirmationRequest } from '../../schemas/inputs';
import type { Importance, Strength } from '../../schemas/common';
import type { Competency, Evidence, EvidenceMap, Recommendation } from '../../schemas/evidenceMap';
import { competencyReadiness } from '../../scoring/interview';
import { parseabilityScore } from '../../scoring/parseability';
import { evidenceCoverageScore, jobMatchScore, keywordCoverageScore } from '../../scoring/scores';
import { capStrength } from '../../scoring/strength';
import { DEMO_RESUME_TEXT } from './resume';

/**
 * Precomputed demo analysis (Req 13.2, design §15). Language fields are authored;
 * every computed field (strength after caps, readiness, keyword matches, parseability,
 * and scores) comes from the shared deterministic functions, so nothing can drift.
 *
 * Designed spread: strong c1–c3, moderate c4–c5, weak c6–c7, missing c8.
 */

type CompetencySpec = Omit<
  Competency,
  'strength' | 'readiness' | 'confirmationState' | 'interviewPriority'
> & {
  /** What the model would propose; the server caps it (design §6.1). */
  proposedStrength: Strength;
};

const resume = (id: string, quote: string, section: Evidence['section']): Evidence => ({
  id,
  source: 'resume',
  quote,
  section,
});

function competency({ proposedStrength, ...spec }: CompetencySpec): Competency {
  const { strength } = capStrength(proposedStrength, spec.evidence);
  return {
    ...spec,
    strength,
    confirmationState: 'none',
    interviewPriority: false,
    readiness: competencyReadiness(strength, null),
  };
}

const COMPETENCY_SPECS: CompetencySpec[] = [
  {
    id: 'c1',
    name: 'Python and TypeScript',
    description: 'Writes production-quality backend code in Python or TypeScript.',
    importance: 'required',
    category: 'technical',
    evidence: [
      resume(
        'e1',
        'Built a Python AWS Lambda function that validates shipment events and writes them to DynamoDB',
        'experience',
      ),
      resume(
        'e2',
        'Built a serverless backend with AWS Lambda functions in TypeScript',
        'projects',
      ),
    ],
    proposedStrength: 'strong',
    missingEvidence: null,
    suggestedInterviewTopic: 'How you structure and test a small Python or TypeScript service.',
    recommendationIds: [],
  },
  {
    id: 'c2',
    name: 'REST API design',
    description: 'Designs, documents, and implements REST APIs behind API Gateway.',
    importance: 'required',
    category: 'technical',
    evidence: [
      resume(
        'e3',
        'Designed and documented three REST API endpoints in API Gateway for the internal shipment tracking dashboard.',
        'experience',
      ),
      resume(
        'e4',
        'Was responsible for writing REST API endpoints in TypeScript for the room search and booking features.',
        'projects',
      ),
    ],
    proposedStrength: 'strong',
    missingEvidence: null,
    suggestedInterviewTopic: 'Choosing resource names, status codes, and error shapes for an API.',
    recommendationIds: ['r1'],
  },
  {
    id: 'c3',
    name: 'Serverless on AWS (Lambda)',
    description: 'Builds event-driven services with AWS Lambda, API Gateway, and DynamoDB.',
    importance: 'required',
    category: 'technical',
    evidence: [
      resume(
        'e5',
        'Built a serverless backend with AWS Lambda functions in TypeScript behind REST API routes in API Gateway.',
        'projects',
      ),
      resume(
        'e6',
        'Python AWS Lambda function that validates shipment events and writes them to DynamoDB, replacing a manual spreadsheet check.',
        'experience',
      ),
    ],
    proposedStrength: 'strong',
    missingEvidence: null,
    suggestedInterviewTopic: 'Handling retries and duplicate events in a Lambda function.',
    recommendationIds: [],
  },
  {
    id: 'c4',
    name: 'CI/CD pipelines',
    description: 'Keeps build, test, and deploy pipelines healthy, for example in GitHub Actions.',
    importance: 'preferred',
    category: 'technical',
    evidence: [
      resume(
        'e7',
        'Added a workflow that runs the test suite on every pull request and deploys the main branch.',
        'projects',
      ),
      resume(
        'e8',
        'Stack: Python, TypeScript, AWS Lambda, API Gateway, DynamoDB, GitHub Actions',
        'projects',
      ),
    ],
    proposedStrength: 'moderate',
    missingEvidence:
      'Shown in one capstone project; no pipeline work appears in the internship or other roles.',
    suggestedInterviewTopic: 'How you would set up and maintain a pipeline for a small service.',
    recommendationIds: ['r2'],
  },
  {
    id: 'c5',
    name: 'Automated testing',
    description: 'Writes unit and integration tests and uses them to catch problems early.',
    importance: 'required',
    category: 'technical',
    evidence: [
      resume(
        'e9',
        'Wrote unit tests with pytest for the event validation code and fixed the failures they found.',
        'experience',
      ),
      resume('e10', 'wrote integration tests for the booking rules', 'projects'),
    ],
    proposedStrength: 'moderate',
    missingEvidence: 'Tests are mentioned, but not what they caught or how they changed the work.',
    suggestedInterviewTopic: 'A bug your tests caught, or one they missed, and what you changed.',
    recommendationIds: [],
  },
  {
    id: 'c6',
    name: 'Infrastructure as code',
    description: 'Defines cloud resources as code with AWS CDK, Terraform, or CloudFormation.',
    importance: 'preferred',
    category: 'technical',
    // Skills-only evidence: the model's `moderate` is capped to `weak` (design §6.1).
    evidence: [
      resume('e11', 'Infrastructure as code: AWS CDK (coursework), Terraform (basics)', 'skills'),
    ],
    proposedStrength: 'moderate',
    missingEvidence: 'Listed in Skills only, not shown in experience or projects.',
    suggestedInterviewTopic: 'Defining a Lambda function and its API route as code.',
    recommendationIds: [],
  },
  {
    id: 'c7',
    name: 'Monitoring and on-call',
    description:
      'Watches production health with dashboards and alarms and joins an on-call rotation.',
    importance: 'preferred',
    category: 'technical',
    evidence: [
      resume(
        'e12',
        'Checked CloudWatch dashboards and logs with my mentor during the weekly release window.',
        'experience',
      ),
    ],
    proposedStrength: 'weak',
    missingEvidence:
      'No on-call rotation or alarm response shown; only dashboard checks during releases.',
    suggestedInterviewTopic: 'A time something went wrong in a running system and how you noticed.',
    recommendationIds: [],
  },
  {
    id: 'c8',
    name: 'Kubernetes and containers',
    description: 'Deploys and operates containerized services on Kubernetes.',
    importance: 'required',
    category: 'technical',
    evidence: [],
    proposedStrength: 'none',
    missingEvidence: 'No Kubernetes or container orchestration experience appears in the resume.',
    suggestedInterviewTopic:
      'Your experience with containers and how you would ramp up on Kubernetes.',
    recommendationIds: ['r3'],
  },
];

/** Keywords extracted from the job description (analysis output); matches are computed. */
const KEYWORD_SPECS: { term: string; required: boolean }[] = [
  { term: 'Python', required: true },
  { term: 'TypeScript', required: true },
  { term: 'AWS', required: true },
  { term: 'AWS Lambda', required: true },
  { term: 'REST APIs', required: true },
  { term: 'API Gateway', required: true },
  { term: 'DynamoDB', required: true },
  { term: 'Unit tests', required: true },
  { term: 'Integration tests', required: true },
  { term: 'Docker', required: true },
  { term: 'Kubernetes', required: true },
  { term: 'CI/CD', required: false },
  { term: 'GitHub Actions', required: false },
  { term: 'Infrastructure as code', required: false },
  { term: 'AWS CDK', required: false },
  { term: 'Terraform', required: false },
  { term: 'CloudWatch', required: false },
  { term: 'On-call', required: false },
  { term: 'Monitoring', required: false },
];

/**
 * One recommendation per trust label the analysis can produce (design §15):
 * r1 rewording only, r2 verified from resume, r3 missing evidence (demonstrable
 * with `DEMO_SAMPLE_CONFIRMATION`).
 */
const RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'r1',
    competencyId: 'c2',
    originalText:
      'Was responsible for writing REST API endpoints in TypeScript for the room search and booking features.',
    proposedText: 'Wrote TypeScript REST API endpoints for the room search and booking features.',
    reason:
      'Leads with what you did instead of "was responsible for". Rewording improves clarity. It doesn\'t add evidence.',
    sourceEvidenceIds: [],
    trustLabel: 'rewording_only',
    decision: 'pending',
  },
  {
    id: 'r2',
    competencyId: 'c4',
    originalText:
      'Added a workflow that runs the test suite on every pull request and deploys the main branch.',
    proposedText:
      'Added a GitHub Actions workflow that runs the test suite on every pull request and deploys the main branch.',
    reason:
      "Names the tool already listed in this project's stack, so the workflow reads as the CI/CD experience the job asks for.",
    sourceEvidenceIds: ['e8'],
    trustLabel: 'verified_from_resume',
    decision: 'pending',
  },
  {
    id: 'r3',
    competencyId: 'c8',
    originalText: 'Tools: Git, GitHub Actions, Docker, Postman, Linux',
    proposedText: null,
    reason:
      "The job requires Kubernetes and your resume doesn't show it. If you have real experience, confirm it in your own words; otherwise leave it and prepare to discuss how you'd learn it.",
    sourceEvidenceIds: [],
    trustLabel: 'missing_evidence',
    decision: 'pending',
  },
];

const COMPETENCIES = COMPETENCY_SPECS.map(competency);
const KEYWORDS = matchKeywords(KEYWORD_SPECS, [DEMO_RESUME_TEXT]);
const PARSEABILITY = parseabilityScore(DEMO_RESUME_TEXT, 'text');

/** Model-proposed strengths before caps, for tests and the "why this strength" explanation. */
export const DEMO_PROPOSED_STRENGTHS: Readonly<Record<string, Strength>> = Object.fromEntries(
  COMPETENCY_SPECS.map((c) => [c.id, c.proposedStrength]),
);

/** Designed spread (design §15); tests assert the computed strengths match it. */
export const DEMO_DESIGNED_SPREAD: Readonly<Record<string, Strength>> = {
  c1: 'strong',
  c2: 'strong',
  c3: 'strong',
  c4: 'moderate',
  c5: 'moderate',
  c6: 'weak',
  c7: 'weak',
  c8: 'none',
};

export const DEMO_EVIDENCE_MAP: EvidenceMap = {
  competencies: COMPETENCIES,
  keywords: KEYWORDS,
  recommendations: RECOMMENDATIONS,
  seniority: 'entry',
  parseability: PARSEABILITY,
  scores: {
    jobMatch: jobMatchScore(COMPETENCIES),
    evidenceCoverage: evidenceCoverageScore(COMPETENCIES),
    keywordCoverage: keywordCoverageScore(KEYWORDS),
    parseability: PARSEABILITY.score,
    interviewReadiness: null,
  },
  scoreEvents: [],
};

/** Importance by competency ID, for interview-performance scoring of the demo plan. */
export const DEMO_IMPORTANCE_BY_ID: Readonly<Record<string, Importance>> = Object.fromEntries(
  COMPETENCIES.map((c) => [c.id, c.importance]),
);

/**
 * A truthful sample confirmation for the missing Kubernetes evidence (r3, Req 8.1).
 * Consistent with the resume's Cloud Computing coursework; labeled fictional in the UI.
 */
export const DEMO_SAMPLE_CONFIRMATION: ConfirmationRequest = {
  competencyId: 'c8',
  statement:
    'In my university cloud computing lab, I deployed a small containerized Python web app to a local Kubernetes cluster with minikube and wrote the deployment and service files myself.',
  attested: true,
};
