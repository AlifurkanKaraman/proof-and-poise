# 06. Timeline

Dates come from the merge commits on `develop` and `main`. The planned schedule is in `tasks.md`.

| Date       | Work                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-27 | Repo bootstrap and CI (task 1). Web shell and design system (2). Shared contracts, scoring, grounding, interview rules (3). CDK walking skeleton deployed to `dev` (4). Steering and skills added. Landing page (5), demo fixture (7), MSW client (6). Sessions, auth, quotas, uploads (8), deployed and checked on `dev`.                                                  |
| 2026-09-28 | Bedrock `invokeStructured` and the analysis worker (9). Offline prompt-evaluation baseline.                                                                                                                                                                                                                                                                                 |
| 2026-09-29 | Job setup stepper and analysis workspace (11, 12). Interview room UI (15). Readiness report UI (19). Decisions and confirmations API (13), interview API (17), audio transcription API (18), report and practice API (21). Playwright e2e in CI and the accessibility audit (22, partial). Integration PR #13 merged into `develop`.                                        |
| 2026-09-30 | Width audit across desktop and mobile Playwright projects (PR #15). First live analysis prompt evaluation.                                                                                                                                                                                                                                                                  |
| 2026-10-01 | Long-resume fix and job-grounded analysis (PRs #16, #17). Decisions and confirmations UI (14) and Resume tab (PR #18). Recorded answers (16) and report and practice integration (20) (PR #19). Amplify Hosting (10, PRs #20, #24). Docs draft (25, PR #21). Alarms, SNS, and the `prod` stage (23, PR #22), first release to `main` (PR #23). Typed answers only (PR #28). |
| 2026-10-02 | Production verification (24, PRs #31, #32). Resume tailoring as the main flow (PR #34, released in PR #35). Accessibility pass and app screenshots (22, PR #36). UI redesign of the landing page and main flow (PR #30). Kiro steering, skills, and hooks (PR #38). Submission docs (25).                                                                                   |

Submission: `TODO(user): add the submission date and time (with time zone).`

## Planned vs. actual

- The plan put Amplify on D1 (Sep 28). It moved to Oct 1 because it needs manual console setup.
- The prod deploy (task 23) landed on Oct 1 with the first release to `main`; production verification (task 24) followed on Oct 2.
- Recorded answers (task 16) are built but switched off: the account isn't subscribed to Amazon Transcribe, so answers are typed.
- Resume tailoring wasn't in the original task list. It became the main flow on Oct 2 (design §7.6, Req 7.9), and the interview became step 2.
- The manual accessibility checks (task 22) finished on Oct 2: the automated audit plus the owner's iOS Safari and VoiceOver pass.
