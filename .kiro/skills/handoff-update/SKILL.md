---
name: handoff-update
description: Use whenever a branch is merged into develop (the user says they merged a PR, or asks you to merge one), or before ending a work session. Updates HANDOFF.md (and the product.md scope line) so the teammate can pick up, then ships it through a PR.
---

# Handoff update

1. Run `git fetch origin --prune`, `git status --short`, `git log --oneline -15 origin/develop`, and `gh pr list --state merged --limit 10`, one at a time. Work out what merged since the "Last updated" line in `HANDOFF.md`.
2. Read `HANDOFF.md`, the checkboxes in `.kiro/specs/proof-and-poise/tasks.md`, and the merged diffs (`git diff <last-handoff-commit>..origin/develop --stat`, then the files that matter).
3. Update `HANDOFF.md`, keeping it short:
   - "Last updated" line: date and what merged.
   - Done table: task, branch, PR #, in `develop`.
   - What each merged task added that the teammate needs: new routes, contracts, helpers, env vars, deps.
   - Deployed state: only what was actually deployed and verified. Say so when it wasn't.
   - Next up: tasks unblocked by the `deps:` lines in tasks.md, split by [A] and [B].
   - Running it, and Know before you start / known issues: remove fixed issues, add new ones.
   Verify every claim against the code before writing it.
4. If the done tasks changed, update the `Current scope` lines in `.kiro/steering/product.md`. Only those lines.
5. Never include secrets, tokens, AWS account IDs, API or bucket IDs, or `.env` values. Give the command that looks them up instead.
6. Ship, per `git-workflow.md`, one command at a time:
   - Branch `feature/handoff-<slug>` from an updated `develop`. If the merged work's PR is still open, commit on that feature branch instead.
   - Run `pnpm lint`; format only touched files with `pnpm exec prettier --write <file>`.
   - Stage by path, check `git diff --cached --stat`, and run the secret check from `git-workflow.md` step 4 with `|[0-9]{12}` added to the pattern so AWS account IDs are caught too. It must print nothing.
   - Commit `docs: update handoff after <what merged>` and push with `git push -u origin <branch>`.
   - Open the PR: `gh pr create --base develop --head <branch> --title "<title>" --body-file .github/pull_request_template.md`.
   - Merge only if the user asked (`gh pr merge <n> --merge`, after CI passes); otherwise give that command.
7. Report what changed in the handoff and the PR number.
