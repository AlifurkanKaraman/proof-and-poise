# Handoff

Last updated: 2026-09-27, after task 8 and the scroll fix were merged into `develop`. Update this file whenever a branch is merged into `develop` or you stop working, using the `handoff-update` skill (`.kiro/skills/handoff-update/SKILL.md`), so the next person can pick up.

## Done

Tasks 1–8 are done (`- [x]` in `.kiro/specs/proof-and-poise/tasks.md`).

| Task          | Branch                                  | In `develop`? |
| ------------- | --------------------------------------- | ------------- |
| 1–7           | merged                                  | Yes           |
| 8             | `feature/sessions-auth-quotas` (PR #10) | Yes           |
| Scroll-to-top | `feature/scroll-to-top` (PR #9)         | Yes           |
| —             | `feature/claude-handoff` (PR #8)        | Yes           |
| —             | `feature/handoff-task-8` (this)         | Yes           |

## Starting work

`develop` has everything so far. Run `git switch develop && git pull`, then start each task on its own `feature/<slug>` branch from `develop` and open a PR back into `develop`.

## What task 8 added

- `POST /v1/sessions` with `{"mode":"standard"|"demo"}` returns `sessionId`, `sessionToken`, `expiresAt`. A demo session starts at stage `analysis` with the precomputed fixture.
- `GET` and `DELETE /v1/sessions/{sessionId}` take `Authorization: Bearer <token>`. Every auth failure (bad ID, missing/wrong token, unknown or expired session) is the same 401. Delete removes the session's DynamoDB records and its S3 files.
- `POST /v1/sessions/{sessionId}/uploads/resume` with `{"contentType":"application/pdf","size":<bytes>}` returns a presigned POST `{url, fields, key, expiresIn: 300}`. S3 enforces the PDF type and ≤ 5 MB.
- Quota helpers for later tasks in `services/api/src/data/quotas.ts` (`QuotaCounters`):
  - `consumeSession`: per-session quotas, 429 `QUOTA_EXCEEDED`.
  - `consumeIpRate`: 10 new sessions per hashed IP per UTC hour, 429.
  - `consumeGlobal`: daily Bedrock/Transcribe budget, 503 `CAPACITY_REACHED`. **Task 9+ must call `consumeGlobal` before every Bedrock call.**
- The IP-hash salt lives in SSM at `/proof-and-poise/<stage>/ip-hash-salt`, generated at deploy by a custom resource. It's never in the repo.

## Deployed

`ProofAndPoise-dev` (us-east-1) was redeployed with task 8 and checked on real AWS on 2026-09-27: health, create/get/delete, the 401 cases, demo seeding, presigned upload (including the 5 MB rejection), the rate-limit 429, and logs containing no tokens, IPs, or bodies. CORS still allows only `http://localhost:5173`.

Get the API URL:

```bash
aws cloudformation describe-stacks --stack-name ProofAndPoise-dev \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
```

## Next up

- **Task 9. Bedrock `invokeStructured` + analysis worker** (B, critical path, now unblocked). The first billable Bedrock calls need the account owner's approval.
- **Task 11. Job setup stepper** (A). It can use the real session and resume-upload endpoints now, or MSW.
- Tasks 12, 15, and 19 (A) can also start against MSW.
- Task 10 (Amplify) still needs someone to connect the repo in the AWS console. It can't be done from code alone.

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
