---
name: debug-root-cause
description: Use when something is broken in Proof & Poise - a failing test, a wrong score, an API error code, a broken screen, or a CI failure. Reproduces the failure with the narrowest real command, traces the flow to a root cause with file:line evidence, makes a focused fix with a regression test, and verifies that the original failure now passes.
---

# Debug to root cause

## When to use

A bug report, failing test, unexpected error code, wrong number on screen, or a red CI job. Not for new features (use `feature-delivery`) or reviews (use `review-change`).

## Inputs

- The symptom: error text, error code, screen or route, expected vs actual.
- The failing command or CI job, if any.
- Whether it happens against MSW (`dev:mock`), the dev API, or prod. Default to local and MSW.

## Steps

1. Run `git status --short` and note the user's existing changes (`safety.md` rule 1).
2. Reproduce with the narrowest real command and save the failing output:
   - unit: `pnpm --filter @proof-and-poise/<pkg> exec vitest run <path>` (path relative to the package);
   - UI: `pnpm --filter @proof-and-poise/web dev:mock`, with `?mockError=<fault>` or `?mockError=<route>:<fault>` to force error paths (`apps/web/src/mocks/controls.ts`, HANDOFF.md);
   - flow: `pnpm e2e` (Playwright; browsers must be installed, ask before downloading);
   - CI: `gh run view <id> --log-failed`.
   If you can't reproduce, say so and stop rather than guessing.
3. Trace the flow from the symptom inward, reading each file:
   - web: `features/<area>/` → `lib/api/` (client, queries) → shared contract in `packages/shared/src/contracts/routes.ts`;
   - API: `lib/router.ts` → `routes/<name>.ts` → `services/` → `data/` or `ai/`;
   - scores and grounding: the pure function in `packages/shared/src/{scoring,grounding,keywords,tailoring}` (`evaluation.md` applies).
4. State the root cause before editing: the file:line where behavior diverges from the cited Req or design section, and why the symptom follows from it. Separate it from contributing factors.
5. Write a test that fails for the root cause (colocated `*.test.ts`), and run it to see it fail. If a test isn't feasible, say why.
6. Make the smallest fix under the `safe-change` skill. Fix the cause, not the symptom: don't loosen a schema, skip a grounding check, raise a cap, or delete caches to make a test pass.
7. Re-run the original reproduction, then the package `typecheck` and `test`. Widen per `testing.md`. For scoring, grounding, or prompt files also run `node .kiro/scripts/eval-regression.mjs --force`.

Never log resume, job, answer, or model text while debugging (logger allowlist, `backend.md`). Never call Bedrock or other billable APIs to reproduce without explicit authorization (`safe-changes.md` risk report).

## Completion evidence

- The reproduction command and its failing output before the fix.
- The root cause with file:line references.
- The diff summary (files and what changed).
- The same command passing after the fix, plus the new regression test.
- Wider checks run with results, and anything not verified.
