import type { ReportNarrativeModelOutput } from '../../schemas/modelOutputs';

/**
 * Report narrative for the fictional demo candidate, in the `reportNarrative` model-output
 * shape (Req 13.4). Demo sessions never call the model; every number in the demo report is
 * computed by `buildReport`, and only this text is authored.
 */
export const DEMO_REPORT_NARRATIVE: ReportNarrativeModelOutput = {
  summary:
    'Your resume shows strong, specific evidence for serverless backend work in Python and TypeScript. The biggest gaps are Kubernetes, which the job requires, and on-call monitoring. Your answers were strongest when you named a specific system and what you changed.',
  weakestAreas: [],
  starOutlines: [
    {
      competencyId: 'c7',
      title: 'Catching a validation failure during a release',
      situation: 'During a weekly release, the error count rose for the shipment event Lambda.',
      task: 'Find out why events were failing before more were lost.',
      action:
        'Read the logs, found a missing partner field, changed validation to flag those events, and added a unit test.',
      result:
        'Errors stopped after the fix was deployed; next time, an alarm would catch it sooner.',
    },
    {
      competencyId: 'c5',
      title: 'Fixing a double-booking bug before the demo',
      situation: 'Two weeks before the capstone demo, two people could book the same room.',
      task: 'You owned the booking logic and had to fix it safely.',
      action:
        'Reproduced it with an integration test, then switched to a DynamoDB conditional write.',
      result: 'The test passed, and new overlap cases ran on every pull request.',
    },
  ],
  actions: [
    {
      competencyId: 'c8',
      step: 'Deploy one small container to a local Kubernetes cluster and be ready to walk through the manifests you wrote.',
    },
    {
      competencyId: 'c7',
      step: 'Prepare one incident story with the signal you saw, the fix, and the alarm you would add.',
    },
    {
      competencyId: 'c6',
      step: 'Move one capstone resource into AWS CDK so infrastructure as code appears outside the Skills section.',
    },
  ],
};
