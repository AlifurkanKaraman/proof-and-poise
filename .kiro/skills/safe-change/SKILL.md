---
name: safe-change
description: Use for any edit to existing files in this repo, especially when git status shows uncommitted or untracked work, when fixing a bug, or when a change touches shared config (eslint.config.js, tsconfig*, cdk.json, CI). Keeps the edit narrow, preserves user work, and ends with a verified report.
---

# Safe change

1. Run `git status --short` and note every modified, staged, and untracked path. These belong to the user unless you create them in this task.
2. Read the target files fully, plus the spec section they implement (`.kiro/specs/proof-and-poise/`).
3. State the edit in one or two sentences: which files, what changes, what stays untouched. If a target file already has uncommitted changes, edit around them; never revert them.
4. Make the smallest edit that solves the problem. No drive-by refactors, renames, or reformatting. Format only files you touched: `pnpm exec prettier --write <file> ...`.
5. Verify, one command at a time, starting narrow:
   - `pnpm --filter <package> typecheck`
   - `pnpm --filter <package> test`
   - then root `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` when the change crosses packages or touches config.
   If something fails, show the error and fix the cause. Don't delete caches or outputs to make it pass.
6. Review `git diff -- <files you changed>` and `git status --short`. Confirm no unexpected paths changed compared with step 1.
7. Report: files changed, commands run with results (pass/fail/not run), and anything unresolved.
