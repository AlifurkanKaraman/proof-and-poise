import type { EvidenceStatus } from '../../components/ui/StatusBadge';

/**
 * Local, fictional data for the landing-page evidence-thread preview (Req 1.2, design §15).
 * Bundled with the page so the preview never makes a network request (Req 1.5).
 */

export interface PreviewResumeLine {
  id: string;
  section: 'Experience' | 'Projects' | 'Skills';
  text: string;
}

export interface PreviewCompetency {
  id: string;
  name: string;
  importance: 'Required' | 'Preferred';
  status: Extract<EvidenceStatus, 'verified' | 'weak' | 'missing'>;
  /** Plain-language reason for the strength (design §6.1). */
  explanation: string;
  /** Resume lines that prove (or only list) this competency. Empty when missing. */
  evidenceLineIds: string[];
}

export const previewProfile = {
  candidate: 'Amara Okonkwo (fictional)',
  job: 'Cloud Software Engineer I, Northwind Cloud (fictional company)',
} as const;

export const previewResumeLines: PreviewResumeLine[] = [
  {
    id: 'line-lambda',
    section: 'Experience',
    text: 'Cloud intern: built AWS Lambda functions in Python that resize and tag uploaded images.',
  },
  {
    id: 'line-rest',
    section: 'Projects',
    text: 'Capstone: designed a REST API in TypeScript for course scheduling, with request validation and integration tests.',
  },
  {
    id: 'line-ta',
    section: 'Experience',
    text: 'Teaching assistant, Data Structures: ran weekly labs and code reviews.',
  },
  {
    id: 'line-skills',
    section: 'Skills',
    text: 'Python, TypeScript, AWS Lambda, Terraform, Git, Linux',
  },
];

export const previewCompetencies: PreviewCompetency[] = [
  {
    id: 'aws-lambda',
    name: 'AWS Lambda',
    importance: 'Required',
    status: 'verified',
    explanation: 'Shown in internship experience, not just listed in Skills.',
    evidenceLineIds: ['line-lambda'],
  },
  {
    id: 'rest-apis',
    name: 'REST API design',
    importance: 'Required',
    status: 'verified',
    explanation: 'A capstone project line describes designing one.',
    evidenceLineIds: ['line-rest'],
  },
  {
    id: 'iac',
    name: 'Infrastructure as code',
    importance: 'Preferred',
    status: 'weak',
    explanation: 'Terraform is listed in Skills only, not shown in experience or projects.',
    evidenceLineIds: ['line-skills'],
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes',
    importance: 'Preferred',
    status: 'missing',
    explanation:
      'No resume line mentions it. You could confirm real experience or practice it in the interview.',
    evidenceLineIds: [],
  },
];
