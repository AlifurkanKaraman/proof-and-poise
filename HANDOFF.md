# Handoff

Last updated: 2026-09-29, after PR #13 (integration of UI and backend tasks 13, 15, 17, 18, 19, 21 and the e2e job) was merged into `develop`. Update this file whenever a branch is merged into `develop` or you stop working, using the `handoff-update` skill (`.kiro/skills/handoff-update/SKILL.md`), so the next person can pick up.

## Done

Tasks 1–9, 11–13, 15, 17–19 and 21 are done (`- [x]` in `.kiro/specs/proof-and-poise/tasks.md`). Task 22 is partial. Task 10 (Amplify) is blocked on manual setup. Open: 14, 16, 20, 23–25.

| Task                                 | Branch                                                                                                                                                                                                | In `develop`? |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1–7                                  | merged                                                                                                                                                                                                | Yes           |
| 8                                    | `feature/sessions-auth-quotas` (PR #10)                                                                                                                                                               | Yes           |
| 9                                    | `feature/analysis-worker` (PR #12)                                                                                                                                                                    | Yes           |
| 11, 12                               | `feature/integrate-setup-analysis`                                                                                                                                                                    | Yes           |
| 13, 15, 17, 18, 19, 21, 22 (partial) | `feature/integration-all` (PR #13; includes `setup-stepper-fixes`, `interview-room-ui`, `readiness-report-ui`, `decisions-api`, `interview-api`, `audio-transcription`, `report-api`, `quality-pass`) | Yes           |
| Scroll-to-top                        | `feature/scroll-to-top` (PR #9)                                                                                                                                                                       | Yes           |
| —                                    | `feature/claude-handoff` (PR #8)                                                                                                                                                                      | Yes           |
| —                                    | `feature/handoff-task-8`                                                                                                                                                                              | Yes           |

## Starting work

`develop` has everything so far. Run `git switch develop && git pull`, then start each task on its own `feature/<slug>` branch from `develop` and open a PR back into `develop`.

## What recent tasks added

**Task 8 (sessions, auth, quotas):**

- `POST /v1/sessions` with `{"mode":"standard"|"demo"}` returns `sessionId`, `sessionToken`, `expiresAt`. A demo session starts at stage `analysis` with the precomputed fixture.
- `GET` and `DELETE /v1/sessions/{sessionId}` take `Authorization: Bearer <token>`. Every auth failure (bad ID, missing/wrong token, unknown or expired session) is the same 401. Delete removes the session's DynamoDB records and its S3 files.
- `POST /v1/sessions/{sessionId}/uploads/resume` with `{"contentType":"application/pdf","size":<bytes>}` returns a presigned POST `{url, fields, key, expiresIn: 300}`. S3 enforces the PDF type and ≤ 5 MB.
- Quota helpers in `services/api/src/data/quotas.ts` (`QuotaCounters`): `consumeSession`, `consumeIpRate`, `consumeGlobal`.
- The IP-hash salt lives in SSM at `/proof-and-poise/<stage>/ip-hash-salt`, generated at deploy by a custom resource.

**Task 9 (Bedrock + analysis worker):**

- `POST /v1/sessions/{sessionId}/analysis` starts async analysis (invokes worker Lambda)
- `GET /v1/sessions/{sessionId}/analysis` returns `queued`, `running` (with `stage`: reading_resume / mapping_competencies / checking_evidence / drafting_recommendations), `ready` (with `evidenceMap`), or `failed` (with `errorCode`)
- Worker Lambda: extracts PDF text (unpdf, ≤4 pages) → AI analysis via Bedrock Nova Lite → grounding validation → scores computation → DynamoDB persistence
- `invokeStructured` helper with forced tool use, Zod validation, retry logic, budget checks
- Evaluation harness in `services/api/src/eval/` with sample resumes

**Tasks 11, 12 (job setup + analysis workspace):**

- `apps/web/src/features/setup/PreparePage.tsx`: three-step stepper (Resume: PDF dropzone or paste → Target job → Review), React Hook Form with the shared Zod schemas, then creates a session, uploads the PDF through the presigned POST if one was chosen, and starts the analysis. `EXTRACTION_FAILED` offers "Paste text instead" with the job values kept (`setupForm.ts` keeps an in-memory draft).
- `apps/web/src/features/analysis/AnalysisPage.tsx` + `AnalysisWorkspace.tsx`: Analysis results with 4 tabs (overview with score cards, competencies grouped by importance, recommendations by trust label, keywords matched vs required)
- Loading stages, error states with retry, navigation to interview

## Deployed

Only the state listed under "Deployed" above (through task 8) was deployed and checked on real AWS. **Tasks 9, 13, 17, 18 and 21 are unit-tested with mocked AWS clients and have not been deployed or run against real Bedrock or Transcribe.** The Transcribe-to-S3 check with a real recording (task 18) is still open.

## Next up

- **Task 14/16/20 (integration):** point the web app at the real API (`VITE_API_BASE_URL`) instead of MSW, and wire the Record tab to the transcription routes (today it shows an editable placeholder).
- **Task 22 left:** manual audit with `apps/web/ACCESSIBILITY.md`, iOS Safari and microphone-denied checks.
- **Task 10 (Amplify)** needs manual Console setup; tasks 23–25 (prod deploy, verification, docs) after it.
- `main` has 2 commits not in `develop` (`30a3fd1`, `2385d84`); reconcile before the release PR.

## Known issues

- `pnpm lint` on Windows with `core.autocrlf=true` reports prettier warnings on many untouched files (CRLF). CI on Linux is unaffected.

## Running it

```bash
pnpm install --frozen-lockfile
pnpm --filter @proof-and-poise/web dev:mock   # http://localhost:5173, API mocked by MSW
```

- Try `/demo` for the fictional demo journey.
- Add `?mockError=UPSTREAM_UNAVAILABLE`, `?mockError=getAnalysis:network`, or `?mockError=off` to simulate errors.
- Checks, in CI order: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.

To run the web app against the real dev API, create `apps/web/.env.local` (template: root `.env.example`) with `VITE_API_BASE_URL` set to the ApiUrl above, then run `pnpm --filter @proof-and-poise/web dev` (not `dev:mock`, which always uses MSW). `apps/web/src/lib/env.ts` reads it. Only health and the session/upload routes are real so far; everything else still needs MSW.

## Know before you start

- **Frontend API layer**: `apps/web/src/lib/api/` (typed client plus TanStack Query hooks), `apps/web/src/lib/session.ts`, and `apps/web/src/app/RequireSession.tsx`. The mock backend is `apps/web/src/mocks/db.ts`. When you change or add a contract route, update the matching MSW handler too. The mapped type in `handlers.ts` turns a missing handler into a type error.
- **AWS**: deploys, `cdk bootstrap/deploy/destroy`, and billable calls (Bedrock `Converse`, Transcribe) need explicit approval from the account owner. Ask before running any of them. `cdk synth` and `pnpm build` are fine.
- **AWS CLI/CDK**: use a profile with access, e.g. `export AWS_PROFILE=<your-profile> AWS_REGION=us-east-1`. Diff with `pnpm --filter @proof-and-poise/infrastructure run cdk diff --context stage=dev`.
- **AWS SDK**: the api Lambda bundles its own pinned SDK (`externalModules: []`). All `@aws-sdk/*` in `services/api` are pinned to `3.1141.0`; add new SDK clients at that same version.
- **Rate limit**: testing it blocks new sessions from your IP until the UTC hour ends.
- **Auth**: the router checks the bearer token for every contract with `auth: true`, so new session routes get auth for free.
- **Lambda concurrency**: the quota may still be 10, so don't set reserved concurrency.
- **Known issues**:
  - The shared package pulls the demo fixtures into the main web chunk, which is about 418 kB.
  - `dev:mock` hasn't been tried in a real browser, and layouts haven't been checked at 375, 768 and 1280 px.
  - Upload and transcription hooks are left for tasks 11 and 15; `api.request(...)` covers them.
  - Some web tests print a harmless jsdom "Not implemented: Window's scrollTo() method" message. Fix: stub `window.scrollTo` in `apps/web/src/test/setup.ts`.
