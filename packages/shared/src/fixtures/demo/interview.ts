import { selectPlan } from '../../interview/plan';
import type { GenerateQuestionsModelOutput } from '../../schemas/modelOutputs';
import { DEMO_EVIDENCE_MAP } from './evidenceMap';

/**
 * Demo interview questions in the `generateQuestions` model-output shape. The plan is
 * composed by the shared `selectPlan` rule (design §7.3), not hand-ordered:
 * B1 = c7, R1 = c6, GAP = c8 (argmax w × (1 − s)), B2 = c5, R2 = c4.
 */
export const DEMO_QUESTION_CANDIDATES: GenerateQuestionsModelOutput = {
  behavioral: [
    {
      competencyIds: ['c7'],
      question:
        'Tell me about a time something went wrong in a system you were working on. How did you notice, and what did you do?',
    },
    {
      competencyIds: ['c5'],
      question:
        'Describe a time you found a bug late in your work. How did you handle it, and what did you change afterwards?',
    },
    {
      competencyIds: ['c2'],
      question:
        'Tell me about a time you had to explain a technical design to people who had less context than you.',
    },
  ],
  roleSpecific: [
    {
      competencyIds: ['c6', 'c3'],
      question:
        'How would you define an AWS Lambda function and its API route as infrastructure as code, and why does that matter for a team?',
    },
    {
      competencyIds: ['c4'],
      question:
        'Walk me through how you would set up a CI/CD pipeline for a small serverless service.',
    },
    {
      competencyIds: ['c3', 'c1'],
      question:
        'How would you write a Lambda function in Python that processes events safely when the same event arrives twice?',
    },
  ],
  evidenceGap: {
    competencyId: 'c8',
    question:
      'This role runs some containerized services on Kubernetes. What experience do you have with containers or Kubernetes, and how would you get up to speed?',
  },
};

export const DEMO_INTERVIEW_PLAN = selectPlan({
  competencies: DEMO_EVIDENCE_MAP.competencies,
  behavioral: DEMO_QUESTION_CANDIDATES.behavioral,
  roleSpecific: DEMO_QUESTION_CANDIDATES.roleSpecific,
  gap: DEMO_QUESTION_CANDIDATES.evidenceGap,
});

/** Turn labels covered by sample content: five primaries plus the follow-up to question 1. */
export type DemoTurnLabel = '1' | '1a' | '2' | '3' | '4' | '5';

/** Primary question whose sample answer is deliberately vague, so a follow-up triggers (§7.3). */
export const DEMO_VAGUE_ANSWER_LABEL = '1' satisfies DemoTurnLabel;

/**
 * The follow-up the sample feedback suggests for the vague answer. Live sessions use the
 * model's own follow-up; this text is used only with the offline sample feedback.
 */
export const DEMO_SAMPLE_FOLLOW_UP =
  'You mentioned checking logs and dashboards when something went wrong. Pick one specific time: which service was it, what did you see, and what did you do next?';

/**
 * "Insert sample answer" content (Req 13.3), written in the fictional candidate's voice and
 * consistent with the demo resume. Shown with `DEMO_LABELS.sampleAnswer`.
 */
export const DEMO_SAMPLE_ANSWERS: Readonly<Record<DemoTurnLabel, string>> = {
  // Deliberately vague: no specific system, action, or outcome.
  '1': "At my internship there were sometimes problems with the services, so I would look at the logs and dashboards and try to figure out what happened. Usually I worked with the team to fix things and we got it working again. I think it's important to stay calm and communicate.",
  '1a': 'It was the shipment event validation Lambda. During a weekly release my mentor and I saw the error count rise on the CloudWatch dashboard. I opened the logs and found that events from one partner were missing a field my code treated as required. I changed the validation to flag those events for review instead of failing, added a unit test for that case, and the errors stopped once the fix was deployed.',
  '2': "In my cloud computing course I used AWS CDK in TypeScript. I would create a stack with a function for the handler and an HTTP API with a route that points to it, then grant only the permissions the function needs, such as read and write on one DynamoDB table. Running a diff before deploying shows exactly what will change. For a team, this matters because infrastructure gets reviewed in pull requests like any other code, and every environment is created the same way instead of by clicking in the console. I haven't used it on a production team yet, so I'd want to learn the team's conventions first.",
  '3': "I haven't used Kubernetes in a job. I use Docker to run services locally, and in a university lab I deployed a small containerized Python app to a local cluster with minikube, writing the deployment and service files myself. To get up to speed, I would pair with a teammate on one real deployment, read the team's manifests and runbooks, and practice rolling a change out and back in a test namespace before touching production.",
  '4': 'Two weeks before our capstone demo, a teammate noticed that two people could book the same room for overlapping times. I owned the booking logic, so I first reproduced it with an integration test that created two overlapping bookings. The cause was that we checked availability and wrote the booking in separate steps. I changed the write to a DynamoDB conditional write so the second booking fails cleanly, and the test passed. Afterwards I added more overlap cases to our test suite, and our pull request workflow ran them on every change, so the bug did not come back before the demo.',
  '5': "I'd start from what I built for our capstone in GitHub Actions. On every pull request, the workflow installs dependencies, runs linting and the unit and integration tests, and blocks the merge if anything fails. When the main branch changes, it deploys. For a production service I would add a staging deploy with a quick smoke test before production, keep secrets in the CI provider's secret store rather than in the repository, and make rollback a single step by redeploying the previous version. I'd also post deploy notifications so the team knows what changed.",
};
