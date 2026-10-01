# 05. Kiro and the Agent Toolkit for AWS

Proof & Poise was built spec-first in Kiro by two developers in about five days. Everything below is in the repo except where marked `TODO(user)`.

## Spec-driven workflow

The spec lives in `.kiro/specs/proof-and-poise/`:

- `requirements.md`: 19 numbered MVP requirements with acceptance criteria, assumptions, and a post-hackathon list.
- `design.md`: architecture, domain model, storage, scoring formulas, AI integration, API contract, design system, security, cost model, and the six correctness properties.
- `tasks.md`: 25 tasks with owners ([A] frontend, [B] backend, [AB] pair), dependencies, a critical path, and the requirements each task covers.

Each task ran on its own `feature/*` branch and merged into `develop` through a PR with CI. Code cites the requirement or design section it enforces (for example `// Req 16.4`, `(design §7.4)`), so a reviewer can trace behavior back to the spec.

Design §13 lists six correctness properties. Each is a `fast-check` property test in `packages/shared/src/properties.test.ts`: score bounds, monotonicity, follow-ups can't lower a score, grounded recommendations add no new numbers, rewording-only never changes Job Match, and the follow-up rule always gives 1–2 follow-ups.

## Steering

`.kiro/steering/` holds the rules every agent session loads:

| File                                  | Covers                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `product.md`                          | Purpose, users, core invariant, current scope                                                                 |
| `tech.md`                             | Pinned versions and commands                                                                                  |
| `structure.md`                        | Repository layout, where new code goes, dependency boundaries                                                 |
| `engineering.md`                      | Code, testing, error, and accessibility conventions                                                           |
| `safety.md`                           | Preserve uncommitted work, no destructive commands, no deploys or billable calls without approval, no secrets |
| `git-workflow.md`                     | Commit and push to `feature/*` after verification; never push to `develop` or `main`                          |
| `frontend.md`, `backend.md`, `cdk.md` | Area-specific guidance for `apps/web`, `services/api`, and `infrastructure`                                   |

## Skills

`.kiro/skills/` packages repeatable procedures:

- `cdk-change`: test and synth locally, review the diff, and never deploy or destroy without explicit authorization.
- `dependency-change`: one pinned change per package with pnpm, then review the manifest and lockfile diff.
- `feature-delivery`: contract-first plan (shared contract → API route → web feature → CDK wiring).
- `handoff-update`: keep `HANDOFF.md` current after each merge into `develop`.
- `safe-change`: narrow edits that preserve user work and end with a verified report.

## Hooks

No hooks are committed (`.kiro/hooks/` doesn't exist in the repo).

`TODO(user): if you used hooks locally during the hackathon, describe them here; otherwise leave this line out.`

## Agent Toolkit for AWS (MCP)

`TODO(user): describe how the Agent Toolkit for AWS MCP server was used (for example, checking Bedrock model access, Service Quotas, or CloudFormation stack outputs), which tools were called, and which tasks it informed. No MCP configuration is committed to the repo, so this can't be verified from code.`

## How Kiro and AWS gates worked together

The steering made AWS actions explicit decisions. `cdk bootstrap`, `cdk deploy`, and billable Bedrock or Transcribe calls each needed a stated resource list and a yes from the account owner (`safety.md`, `cdk-change`). Examples from the history:

- Task 4 deployed the walking skeleton to `dev` only after the resources were listed and approved.
- The live analysis prompt evaluation (task 9) stayed "not run yet" until billable calls were authorized. See [analysis-prompt-evaluation.md](analysis-prompt-evaluation.md).
- Task 18's real Transcribe check is still open because that deploy wasn't authorized at the time.

## Screenshots

Redact account IDs, ARNs, API IDs, bucket names, URLs, and personal data before committing (Req 18.3). Store them in [screenshots/](screenshots/README.md).

- `TODO(user): screenshot of the Kiro spec view (requirements, design, tasks).`
- `TODO(user): screenshot of a spec task execution with property tests passing.`
- `TODO(user): screenshot of Kiro connected to AWS through the Agent Toolkit MCP server (redacted).`
- `TODO(user): screenshot of steering and skills in the Kiro panel.`
