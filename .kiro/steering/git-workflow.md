---
inclusion: always
---

# Git workflow: commit and push after each development

Standing authorization (user, 2026-09-27): when a spec task or requested change is finished and verified, commit it and push it to its `feature/*` branch. This does not cover pushing to `develop` or `main`, force pushes, merging, or creating/merging PRs; ask for those.

## When

After verification passes (`pnpm typecheck` → `pnpm lint` → `pnpm test` → `pnpm build`, or the narrower set you ran and said so). If a check fails, don't commit; report the failure.

## Steps (one command at a time)

1. `git status --short` and `git branch --show-current`.
2. Branch: one `feature/<slug>` per spec task (e.g. `feature/landing-page` for task 5). If you're on `develop`/`main` or another task's branch, `git switch -c feature/<slug>`. Branch from the current HEAD when the work depends on unmerged branches, and say which base you used.
3. Stage only this change, by path: `git add -- <paths>`. Never `git add -A` or `git add .`. Leave unrelated user work unstaged. Check with `git diff --cached --stat`.
4. Secret check on the staged diff: no `.env*` (except `.env.example`), keys, tokens, credentials, or AWS account IDs. `git diff --cached | grep -nE 'AKIA[0-9A-Z]{16}|aws_secret|PRIVATE KEY'` should print nothing.
5. Commit with a Conventional Commit title and the task number, e.g. `git commit -m "feat(web): landing page (task 5)"`. Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `ci`. Scopes: `web`, `api`, `shared`, `infra`, `kiro`, `ci`. Tick the task in `tasks.md` in the same commit or a follow-up `chore: mark task N complete`.
6. Push: `git push -u origin <branch>` the first time, `git push` after. Pre-push/pre-commit hooks run; never `--no-verify`.
7. PRs: don't open one unless asked. Give the command instead: `gh pr create --base develop --head <branch> --title "<title>" --body-file .github/pull_request_template.md` (base is the parent branch for stacked branches).
8. Report branch, commit hash, push result, and the PR command.

## Never

Push to `develop` or `main` directly, `--force`/`-f`, `--amend` or rebase on pushed commits, `--no-verify`, or commit files outside the change.
