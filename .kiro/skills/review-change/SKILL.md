---
name: review-change
description: Use when asked to review a change, branch, or PR in Proof & Poise, or before committing finished work. Reads the actual diff (working tree, staged, branch vs develop, or a GitHub PR) and reports findings with file:line references on correctness, API and contract compatibility, error handling, sensitive-data exposure, and missing verification. Read-only; it doesn't edit files.
---

# Review a change

## When to use

Before a commit or PR, when the user asks for a review, or after another agent finishes work. Read-only: don't edit, format, or stage files during the review.

## Inputs

- What to review (default: the current branch vs `develop`, plus uncommitted work):
  - working tree: `git diff` and `git diff --cached`;
  - branch: `git diff --stat develop...HEAD` then `git diff develop...HEAD`;
  - PR: `gh pr view <n>` and `gh pr diff <n>` (gh is installed).
- The task, Req, or design section the change claims to implement, if known.

## Steps

1. `git status --short` (untracked files are part of the change only if the author says so), then the diff for the chosen range. Review only what the diff shows, reading surrounding code where needed.
2. Correctness: does it do what the cited Req/design section says (`.kiro/specs/proof-and-poise/`)? Edge cases, `noUncheckedIndexedAccess` handling, off-by-one in limits (`limits.ts`), async races (`rev` optimistic lock in `data/analysisRepository.ts`).
3. API and contract compatibility:
   - `packages/shared/src/contracts/routes.ts` and `schemas/`: removed or renamed fields, newly required fields, narrowed enums. Stored `EvidenceMap` items in DynamoDB (24 h TTL) and the web client (`apps/web/src/lib/api/client.ts` parses responses with the contract schema) must still parse.
   - every contract route still has an MSW handler (`apps/web/src/mocks/handlers.ts`), and the demo fixture still passes (`fixtures/demo/demo.test.ts`).
   - error codes come from `ERROR_STATUS` (`contracts/errors.ts`).
4. Error handling: expected failures throw `ApiError`, unknown ones become `INTERNAL` via `toApiError` (`services/api/src/lib/errors.ts`); session errors don't reveal whether a session exists; every UI error state offers recovery (`components/states/ErrorState`).
5. Sensitive data:
   - logging only through `services/api/src/lib/logger.ts` with allowlisted fields; no resume, job, answer, transcript, prompt, or model text, and no request bodies;
   - no secrets, tokens, `.env*` (except `.env.example`), or AWS account IDs: `git diff develop...HEAD | grep -nE 'AKIA[0-9A-Z]{16}|aws_secret|PRIVATE KEY|[0-9]{12}'` (inspect 12-digit hits; many are harmless);
   - fixtures fictional, with `(fictional)` labels and `@example.com` contacts.
6. Infra and cost (if `infrastructure/` changed): `cdk.md` rules, least-privilege IAM, and a matching `test/stack.test.ts` assertion.
7. Scoring, grounding, keywords, tailoring, or analysis prompt changed: apply `evaluation.md` and recommend the `evaluate-scoring-change` skill.
8. Missing verification: compare the change types with `testing.md`. Flag behavior changes without tests and claimed checks with no evidence.
9. Walk the security checklist in `.github/pull_request_template.md` and mark each item checked, not applicable, or failing.

## Output

Findings ordered by severity, each as:

```
[blocker|should-fix|nit] path/to/file.ts:123: problem. Why it matters. Concrete fix.
```

Then "Verified" (what you read or ran) and "Not verified" (what you couldn't check, such as live AWS behavior).

## Completion evidence

- The diff range reviewed and the commands run.
- The findings list, or an explicit "no findings" with what was checked.
- The PR-template security checklist status.
