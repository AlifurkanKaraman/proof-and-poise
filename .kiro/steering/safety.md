---
inclusion: always
---

# Safety rules (mandatory)

These rules apply to every task. They're written guidance, not a technical boundary; enforced permissions live in Kiro's permissions settings.
They don't require asking before small, reversible code edits inside the requested scope.
The risk-report format to use when asking for approval is in `safe-changes.md`.

1. Before editing, inspect the target files and run `git status --short`. Keep changes within the requested scope and preserve unrelated modifications, including staged, unstaged, and untracked work. This repo often has large uncommitted changes (for example spec task work in progress); treat them as the user's.
2. Never use `git reset --hard`, `git clean`, `git checkout -- <path>` / `git restore` over uncommitted work, `git checkout -f`, destructive rebases, broad search-and-replace, workspace-wide reformatting (including root `pnpm format`), or `rm -rf` as routine troubleshooting.
3. Never delete, empty, overwrite, or move an existing file or directory just because it looks generated, stale, unused, or replaceable. That includes `cdk.out/`, `dist/`, `node_modules/`, `*.tsbuildinfo`, local databases, `uploads/`, audio files, logs, `.env*` files, configuration, and untracked files.
4. If deletion is genuinely necessary, first show: the exact path, its contents (or a listing), its Git status, why deletion is needed, and a less destructive option (rename, move to a backup, `.gitignore`, or leaving it). Then ask for explicit approval for that specific path. Approval for one path doesn't cover any other path.
5. Before package operations (`pnpm add`, `pnpm remove`, `pnpm update`, upgrades, lockfile regeneration), say which workspace package is affected (for example `--filter @proof-and-poise/api`) and the expected changes to its `package.json` and `pnpm-lock.yaml`. Afterward, inspect `git diff` of both. Don't upgrade unrelated dependencies. Use the `dependency-change` skill.
6. Run consequential commands one at a time. Don't chain with `;` to continue past failures, and don't pipe through `tail`, `head`, or `grep` in a way that hides the exit status. Show the relevant errors.
7. Don't expose secrets in logs, commits, generated docs, screenshots, or chat. Use placeholders and the existing patterns (`.env.example` holds placeholders only; Lambda config comes from CDK environment variables validated by `services/api/src/lib/env.ts`). Redact AWS account IDs. Don't deploy, publish, push (except the feature-branch pushes allowed in `git-workflow.md`), run `cdk bootstrap`/`cdk deploy`/`cdk destroy`, call billable AWS APIs (including Bedrock `Converse`), or modify cloud resources without explicit authorization for that action.
8. Finish each task with a brief summary: files changed, checks run and their results, and unresolved issues. Never claim a check passed unless it ran in this session.
