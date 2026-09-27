# Handoff

Last updated: 2026-09-27, when task 6 was finished. Update this file whenever you stop working so the next person can pick up.

## Done

Tasks 1–7 are done (`- [x]` in `.kiro/specs/proof-and-poise/tasks.md`).

| Task                             | Branch                                     | In `develop`?                                                                                          |
| -------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 1–5                              | merged (PRs #1–#4)                         | Yes                                                                                                    |
| 7. Demo fixtures                 | `feature/demo-fixtures`                    | **No.** PR #5 merged it into `feature/landing-page` after that branch had already gone into `develop`. |
| 6. MSW mock layer and API client | `feature/msw-api-client` (built on task 7) | **No.** No PR yet.                                                                                     |
| (this handoff)                   | `feature/claude-handoff` (built on task 6) | No                                                                                                     |

## First: get `develop` up to date

Open these PRs and merge them in order. Each one only shows its own changes once the one before it is merged.

```bash
gh pr create --base develop --head feature/demo-fixtures --title "feat(shared): demo fixture content (task 7)" --body-file .github/pull_request_template.md
gh pr create --base develop --head feature/msw-api-client --title "feat(web): MSW mock layer and API client (task 6)" --body-file .github/pull_request_template.md
gh pr create --base develop --head feature/claude-handoff --title "docs: Claude Code handoff" --body-file .github/pull_request_template.md
```

Then `git switch develop && git pull`, and start each new task on its own `feature/<slug>` branch from `develop`.

## Next up

- **Task 8. Sessions, auth, quotas, uploads** (backend, critical path). This is the most important one, since tasks 9 → 13 → 17 → 18 → 21 all wait on it.
- **Task 11. Job setup stepper** (frontend). It can start now against the mock API and runs in parallel with task 8.
- Task 10 (Amplify) needs someone to connect the repo in the AWS console. It can't be done from code alone.

## Running it

```bash
pnpm install --frozen-lockfile
pnpm --filter @proof-and-poise/web dev:mock   # http://localhost:5173, API mocked by MSW
```

- Try `/demo` for the fictional demo journey.
- Add `?mockError=UPSTREAM_UNAVAILABLE`, `?mockError=getAnalysis:network`, or `?mockError=off` to simulate errors.
- Checks, in CI order: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.

The real API is deployed as `ProofAndPoise-dev` in us-east-1, but only `GET /v1/health` exists so far.

## Know before you start

- **Frontend API layer**: `apps/web/src/lib/api/` (typed client plus TanStack Query hooks), `apps/web/src/lib/session.ts`, and `apps/web/src/app/RequireSession.tsx`. The mock backend is `apps/web/src/mocks/db.ts`. When you change or add a contract route, update the matching MSW handler too. The mapped type in `handlers.ts` turns a missing handler into a type error.
- **AWS**: deploys, `cdk bootstrap/deploy/destroy`, and billable calls (Bedrock `Converse`, Transcribe) need explicit approval from the account owner. Ask before running any of them. `cdk synth` and `pnpm build` are fine.
- **Lambda concurrency**: the quota may still be 10, so don't set reserved concurrency.
- **Known issues from task 6**:
  - The shared package pulls the demo fixtures into the main web chunk, which is about 418 kB.
  - `dev:mock` hasn't been tried in a real browser, and layouts haven't been checked at 375, 768 and 1280 px.
  - Upload and transcription hooks are left for tasks 11 and 15; `api.request(...)` covers them.
