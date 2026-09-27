import type { JobInput } from '../../schemas/inputs';

/** Fictional job description (design §15). The company is invented. */
export const DEMO_JOB_DESCRIPTION = [
  'Cloud Software Engineer I',
  'Northwind Cloud (fictional company) | Remote-friendly | Entry level',
  '',
  'About the team',
  'Northwind Cloud builds a serverless platform that small retailers use to track orders and inventory. Our Platform Services team owns the APIs and event pipelines behind it.',
  '',
  "What you'll do",
  '- Build and maintain backend services in Python and TypeScript running on AWS Lambda.',
  '- Design, document, and test REST APIs exposed through API Gateway.',
  '- Write unit tests and integration tests, and keep our CI/CD pipelines in GitHub Actions healthy.',
  '- Define infrastructure as code with AWS CDK or Terraform.',
  '- Deploy and operate containerized services on Kubernetes alongside our serverless workloads.',
  '- Join the team on-call rotation after onboarding, using CloudWatch dashboards and alarms for monitoring.',
  '',
  'Required qualifications',
  '- BS or MS in Computer Science or a related field, or equivalent practical experience.',
  '- Experience writing production-quality code in Python or TypeScript.',
  '- Experience building REST APIs and serverless functions on AWS (AWS Lambda, API Gateway, DynamoDB).',
  '- A habit of writing automated tests.',
  '- Working knowledge of containers (Docker) and Kubernetes.',
  '',
  'Preferred qualifications',
  '- CI/CD pipelines (GitHub Actions or similar).',
  '- Infrastructure as code (AWS CDK, Terraform, or CloudFormation).',
  '- Monitoring and on-call experience with CloudWatch or similar tools.',
  '',
  'We welcome applicants from all backgrounds, including recent graduates and international candidates.',
].join('\n');

export const DEMO_JOB: JobInput = {
  description: DEMO_JOB_DESCRIPTION,
  company: 'Northwind Cloud (fictional company)',
  role: 'Cloud Software Engineer I',
  interviewType: 'behavioral_mixed',
};
