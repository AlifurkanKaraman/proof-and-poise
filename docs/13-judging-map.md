# 13. Judging map

Features mapped to the four judging areas (Req 18.2), with where to verify each.

## Technical Innovation and Originality

| Feature                                                                                             | Evidence                                              |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| One Evidence Map drives analysis, recommendations, interview, and report                            | design §1, §4; [02-originality.md](02-originality.md) |
| Model writes language only; scores, caps, follow-ups, quotas are deterministic                      | `packages/shared/src/{scoring,grounding,interview}/`  |
| Verbatim quote grounding and novel-term rejection of recommendations                                | `packages/shared/src/grounding/`, design §7.4         |
| Interview targets the weakest evidence (`importance × (1 − strength)`), with a guaranteed follow-up | `packages/shared/src/interview/`, design §7.3         |
| Bedrock `Converse` with forced tool use and Zod-generated tool schemas, one repair retry            | `services/api/src/ai/invokeStructured.ts`             |
| Six correctness properties as `fast-check` tests                                                    | `packages/shared/src/properties.test.ts`              |

## Implementation Quality

| Feature                                                                            | Evidence                                                                      |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Contract-first API: shared Zod schemas validate on both client and server          | `packages/shared/src/contracts/routes.ts`, `apps/web/src/lib/api/`            |
| Least-privilege IAM, no wildcard actions, CDK assertion tests                      | `infrastructure/test/stack.test.ts`, [04-aws-services.md](04-aws-services.md) |
| Allowlisted content-free logging with a redaction test                             | `services/api/src/lib/logger.ts`, `logger.test.ts`                            |
| Cost controls: throttling, per-session quotas, IP rate limit, daily global caps    | [08-cost-controls.md](08-cost-controls.md)                                    |
| CI: frozen install, typecheck, lint, test, build, Playwright + axe e2e, gitleaks   | `.github/workflows/ci.yml`                                                    |
| Every screen has loading, empty, success, and recoverable error states             | `apps/web/src/components/states/`                                             |
| Accessibility checks: axe, keyboard, 44 px targets, reduced motion at 375/768/1280 | `apps/web/e2e/a11y-audit.spec.ts`, `apps/web/ACCESSIBILITY.md`                |
| Honest evaluation of the analysis prompt, including a prompt-injection case        | [analysis-prompt-evaluation.md](analysis-prompt-evaluation.md)                |

## Community or Market Impact

| Feature                                                                             | Evidence                                           |
| ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| Built for international students and early-career candidates                        | [01-problem-and-users.md](01-problem-and-users.md) |
| Truthful by design: no invented numbers or skills; trust labels on every suggestion | Req 7, design §7.4                                 |
| Fair evaluation: no judgment of accent, fluency, or non-native phrasing             | `services/api/src/ai/prompts/evaluateAnswer.ts`    |
| Privacy: anonymous, 24 h retention, PDF deleted after extraction, delete-my-data    | [07-security-privacy.md](07-security-privacy.md)   |
| Free to try with a fictional demo; no resume required                               | [12-demo-guide.md](12-demo-guide.md)               |
| Runs for a few dollars at hackathon traffic, with hard daily caps                   | [08-cost-controls.md](08-cost-controls.md)         |
| Mobile path through the RN-compatible shared package                                | [10-react-native-plan.md](10-react-native-plan.md) |

## Creativity and Storytelling

| Feature                                                                                         | Evidence                                                     |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| "Evidence thread" visual identity linking each requirement to its proof                         | design §9; landing preview and competencies view             |
| Score changes always show their reason ("Rewording improves clarity. It doesn't add evidence.") | design §6.3                                                  |
| The demo candidate's designed evidence spread tells a story from strong to missing              | design §15                                                   |
| Submission story                                                                                | [14-submission-story.md](14-submission-story.md)             |
| Built spec-first with Kiro steering, skills, and gated AWS actions                              | [05-kiro-and-agent-toolkit.md](05-kiro-and-agent-toolkit.md) |
