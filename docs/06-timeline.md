# 06. Timeline

Dates come from the git history on `develop`. The planned schedule is in `tasks.md`.

| Date       | Work                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-27 | Repo bootstrap and CI (task 1). Web shell and design system (2). Shared contracts, scoring, grounding, interview rules (3). CDK walking skeleton deployed to `dev` (4). Steering and skills added. Landing page (5), demo fixture (7), MSW client (6). Sessions, auth, quotas, uploads (8), deployed and checked on `dev`.           |
| 2026-09-28 | Bedrock `invokeStructured` and the analysis worker (9). Offline prompt-evaluation baseline.                                                                                                                                                                                                                                          |
| 2026-09-29 | Job setup stepper and analysis workspace (11, 12). Interview room UI (15). Readiness report UI (19). Decisions and confirmations API (13), interview API (17), audio transcription API (18), report and practice API (21). Playwright e2e in CI and the accessibility audit (22, partial). Integration PR #13 merged into `develop`. |
| 2026-09-30 | Width audit across desktop and mobile Playwright projects (PR #15). First live analysis prompt evaluation.                                                                                                                                                                                                                           |
| 2026-10-01 | Long-resume fix for analysis (output cap raised to the Nova Lite maximum). Prompt-quality iterations. Amplify connection started (task 10).                                                                                                                                                                                          |
| 2026-10-02 | Documentation (25). Submission.                                                                                                                                                                                                                                                                                                      |

`TODO(user): add the prod deploy date (task 23), the production verification date (task 24), and the submission time.`

## Planned vs. actual

- The plan put Amplify on D1 (Sep 28). It moved to Oct 1 because it needs manual console setup.
- Integration tasks 14, 16, and 20 (real API instead of MSW for decisions, recording, and report) were still open on `develop` when these docs were written.
- `TODO(user): update this section once tasks 10, 14, 16, 20, 23, and 24 land.`
