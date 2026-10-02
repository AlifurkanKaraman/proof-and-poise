import type { ResumeInput } from '../../schemas/inputs';

/**
 * Fictional demo candidate (design §15). Every person, company, school, and contact
 * detail here is invented; the email uses the reserved example.com domain.
 */
export const DEMO_PROFILE = {
  name: 'Amara Okonkwo (fictional)',
  headline: 'MS Computer Science graduate, international student',
  background:
    'MS Computer Science graduate on a student visa, with one cloud internship, a capstone serverless project, and teaching assistant experience.',
} as const;

/** Pasted-text resume. Evidence quotes in the demo evidence map are verbatim substrings. */
export const DEMO_RESUME_TEXT = [
  'Amara Okonkwo (fictional)',
  'Cloud Software Engineer candidate | amara.okonkwo@example.com',
  'Work authorization: student visa with post-study work eligibility',
  '',
  'SUMMARY',
  'MS Computer Science graduate who builds small, well-tested serverless services on AWS. Comfortable in Python and TypeScript, and used to explaining technical ideas clearly after two years of teaching.',
  '',
  'EXPERIENCE',
  'Software Engineering Intern, Cloud Platform Team',
  'Harborview Logistics (fictional company), Jun 2024 – Aug 2024',
  '- Built a Python AWS Lambda function that validates shipment events and writes them to DynamoDB, replacing a manual spreadsheet check.',
  '- Designed and documented three REST API endpoints in API Gateway for the internal shipment tracking dashboard.',
  '- Wrote unit tests with pytest for the event validation code and fixed the failures they found.',
  '- Helped the team update the deployment scripts for the billing service.',
  '- Checked CloudWatch dashboards and logs with my mentor during the weekly release window.',
  '- Presented my internship project to the platform team and answered questions about the design.',
  '',
  'Graduate Teaching Assistant, Introduction to Programming (Python)',
  'Lakeshore State University (fictional), Jan 2024 – May 2025',
  '- Led two weekly lab sections of about 30 students and held office hours.',
  '- Rewrote four lab assignments with clearer instructions and automated grading tests.',
  '- Explained debugging strategies to students who were new to programming.',
  '',
  'PROJECTS',
  'Campus Room Finder (capstone, team of four), Sep 2024 – May 2025',
  '- Built a serverless backend with AWS Lambda functions in TypeScript behind REST API routes in API Gateway.',
  '- Was responsible for writing REST API endpoints in TypeScript for the room search and booking features.',
  '- Modeled bookings in DynamoDB and wrote integration tests for the booking rules.',
  '- Added a workflow that runs the test suite on every pull request and deploys the main branch.',
  '- Stack: Python, TypeScript, AWS Lambda, API Gateway, DynamoDB, GitHub Actions',
  '',
  'Course Scheduler CLI, Jan 2024 – Mar 2024',
  '- Wrote a Python command-line tool that detects timetable conflicts, with unit tests for each rule.',
  '',
  'EDUCATION',
  'MS in Computer Science, Lakeshore State University (fictional), Aug 2023 – May 2025',
  '- Coursework: Cloud Computing, Distributed Systems, Software Testing, Database Systems',
  'BS in Computer Engineering, Coastal Institute of Technology (fictional), 2019 – 2023',
  '',
  'SKILLS',
  'Languages: Python, TypeScript, JavaScript, SQL',
  'Cloud: AWS Lambda, API Gateway, DynamoDB, Amazon S3, CloudWatch',
  'Infrastructure as code: AWS CDK (coursework), Terraform (basics)',
  'Tools: Git, GitHub Actions, Docker, Postman, Linux',
].join('\n');

export const DEMO_RESUME_INPUT: ResumeInput = { kind: 'text', text: DEMO_RESUME_TEXT };
