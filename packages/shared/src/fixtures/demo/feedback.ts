import type { Evaluation } from '../../schemas/interview';
import type { EvaluationModelOutput } from '../../schemas/modelOutputs';
import { answerScore } from '../../scoring/interview';
import { type DemoTurnLabel, DEMO_SAMPLE_FOLLOW_UP } from './interview';

/**
 * Offline sample feedback for the demo sample answers (Req 13.4). Used only when live
 * evaluation is unavailable, always with `feedbackSource: 'sample'` and shown under
 * `DEMO_LABELS.sampleFeedback`. Authored in the `evaluateAnswer` model-output shape;
 * `weightedScore` is computed by the shared `answerScore` (design §6.2).
 *
 * Only the vague answer (question 1) has a trigger dimension ≤ 2 and a follow-up, so the
 * shared follow-up rule asks exactly one follow-up (1a) across the demo (design §7.3).
 */
const d = (score: 1 | 2 | 3 | 4, rationale: string) => ({ score, rationale });

export const DEMO_SAMPLE_FEEDBACK_OUTPUT: Readonly<Record<DemoTurnLabel, EvaluationModelOutput>> = {
  '1': {
    dimensions: {
      relevance: d(
        2,
        'Talks about problems in services, but never describes one specific incident.',
      ),
      specificity: d(1, 'No named system, symptom, time, or result.'),
      evidence: d(1, 'Nothing in the answer shows what was found or fixed.'),
      star: d(1, 'There is no clear situation, action, or result to follow.'),
      clarity: d(3, 'Easy to follow, but general.'),
      ownership: d(2, '"We got it working" hides what you personally did.'),
      roleConnection: d(
        2,
        'Mentions logs and dashboards but does not connect them to on-call work.',
      ),
    },
    strength: 'You named the right tools to start from: logs and dashboards.',
    improvement:
      'Pick one real incident and walk through it: what you noticed, what you checked, what you changed, and what happened after.',
    strongerOutline: [
      'Situation: the service and what went wrong, in one sentence.',
      'How you noticed: the dashboard, alarm, or log line.',
      'Action: what you checked and the change you made yourself.',
      'Result: what changed afterwards, and what you would monitor next time.',
    ],
    candidateFollowUp: DEMO_SAMPLE_FOLLOW_UP,
  },
  '1a': {
    dimensions: {
      relevance: d(4, 'Describes one concrete incident that answers the question directly.'),
      specificity: d(3, 'Names the Lambda, the dashboard signal, and the missing field.'),
      evidence: d(3, 'The fix and the new unit test show how the problem was resolved.'),
      star: d(3, 'Situation, action, and result are all present; the task is implied.'),
      clarity: d(3, 'Clear sequence from symptom to fix.'),
      ownership: d(3, 'Clearly states which changes you made.'),
      roleConnection: d(3, 'Shows the dashboard-to-logs habit that on-call work relies on.'),
    },
    strength: 'A concrete incident with a clear path from the dashboard signal to the fix.',
    improvement:
      'Close with what you would add next time, such as an alarm on the error count so the issue is caught outside a release window.',
    strongerOutline: [
      'Name the service and the signal you saw on the dashboard.',
      'Explain the root cause you found in the logs.',
      'Describe your change and the test you added.',
      'End with the alarm or check you would add to catch it sooner.',
    ],
    candidateFollowUp: null,
  },
  '2': {
    dimensions: {
      relevance: d(4, 'Answers both how and why.'),
      specificity: d(3, 'Names a stack, a function, an API route, and scoped permissions.'),
      evidence: d(3, 'Grounded in coursework you actually did.'),
      star: null,
      clarity: d(3, 'Well ordered, from resources to review to environments.'),
      ownership: d(3, 'Honest about the limits of your experience.'),
      roleConnection: d(3, 'Connects code review of infrastructure to team practice.'),
    },
    strength:
      'Clear reasoning for why teams keep infrastructure in code, with least-privilege permissions.',
    improvement:
      'Add one detail from your own coursework stack, such as a mistake the diff caught before deploying.',
    strongerOutline: [
      'Define the function, the API route, and the table access as code.',
      'Grant only the permissions the function needs.',
      'Review a diff before every deploy.',
      'Explain the team benefit: reviewed, repeatable environments.',
    ],
    candidateFollowUp: null,
  },
  '3': {
    dimensions: {
      relevance: d(4, 'Addresses both current experience and a plan to ramp up.'),
      specificity: d(3, 'Mentions Docker, minikube, and the files you wrote.'),
      evidence: d(3, 'The lab deployment is a concrete, honest example.'),
      star: null,
      clarity: d(3, 'Short and direct.'),
      ownership: d(3, 'Says plainly what you have and have not done.'),
      roleConnection: d(3, 'The ramp-up plan fits how the team deploys.'),
    },
    strength: 'Honest about the gap, with a concrete lab example and a practical ramp-up plan.',
    improvement:
      'Mention one thing the lab taught you about how Kubernetes differs from running a container locally.',
    strongerOutline: [
      'State your current experience honestly.',
      'Give the lab example and what you built yourself.',
      'Share one lesson from it.',
      'Describe a concrete first-month ramp-up plan.',
    ],
    candidateFollowUp: null,
  },
  '4': {
    dimensions: {
      relevance: d(4, 'A late bug, how it was handled, and what changed afterwards.'),
      specificity: d(4, 'Names the race condition and the conditional write that fixed it.'),
      evidence: d(3, 'The reproducing test and the passing result support the story.'),
      star: d(4, 'Clear situation, task, action, and result.'),
      clarity: d(3, 'Well paced, slightly long in the middle.'),
      ownership: d(4, 'You owned the booking logic and the fix.'),
      roleConnection: d(3, 'Shows testing habits the role asks for.'),
    },
    strength: 'Strong STAR structure: you reproduced the bug with a test before fixing it.',
    improvement: 'Say in one sentence why the separate check-then-write steps allowed the overlap.',
    strongerOutline: [
      'Situation: overlapping bookings found two weeks before the demo.',
      'Task: you owned the booking logic.',
      'Action: reproduce with a test, then switch to a conditional write.',
      'Result: the test passed and new overlap cases ran on every pull request.',
    ],
    candidateFollowUp: null,
  },
  '5': {
    dimensions: {
      relevance: d(4, 'Walks through a full pipeline for the service described.'),
      specificity: d(3, 'Clear stages, gates, and deploy triggers.'),
      evidence: d(3, 'Builds on the capstone workflow you set up.'),
      star: null,
      clarity: d(4, 'Logical order from pull request to production.'),
      ownership: d(3, 'Distinguishes what you built from what you would add.'),
      roleConnection: d(4, 'Covers staging, secrets, and rollback, which the role cares about.'),
    },
    strength:
      'A practical pipeline that starts from what you built and adds production safeguards.',
    improvement:
      'Mention how you would know a deploy went wrong, for example an alarm after release.',
    strongerOutline: [
      'Pull request checks: install, lint, and test, with merge blocked on failure.',
      'Deploy to staging with a smoke test.',
      'Promote to production with secrets kept out of the repository.',
      'One-step rollback and a post-deploy check.',
    ],
    candidateFollowUp: null,
  },
};

const toSampleEvaluation = (out: EvaluationModelOutput): Evaluation => ({
  ...out,
  weightedScore: answerScore(out.dimensions),
  feedbackSource: 'sample',
});

/** Stored-shape sample evaluations, keyed by turn label. */
export const DEMO_SAMPLE_FEEDBACK: Readonly<Record<DemoTurnLabel, Evaluation>> = {
  '1': toSampleEvaluation(DEMO_SAMPLE_FEEDBACK_OUTPUT['1']),
  '1a': toSampleEvaluation(DEMO_SAMPLE_FEEDBACK_OUTPUT['1a']),
  '2': toSampleEvaluation(DEMO_SAMPLE_FEEDBACK_OUTPUT['2']),
  '3': toSampleEvaluation(DEMO_SAMPLE_FEEDBACK_OUTPUT['3']),
  '4': toSampleEvaluation(DEMO_SAMPLE_FEEDBACK_OUTPUT['4']),
  '5': toSampleEvaluation(DEMO_SAMPLE_FEEDBACK_OUTPUT['5']),
};
