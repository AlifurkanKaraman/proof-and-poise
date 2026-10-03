# Handoff

Last updated: 2026-10-02, after PRs #30–#38: resume tailoring as the main flow (#34, released in #35), task 22 manual pass and screenshots (#36), UI redesign (#30), Kiro steering/skills/hooks (#38), and the Tailor confirmation fix (#37). Update this file whenever a branch is merged into `develop` or you stop working, using the `handoff-update` skill (`.kiro/skills/handoff-update/SKILL.md`), so the next person can pick up.

## Done

Tasks 1–24 are done. Task 25 docs are drafted; the remaining `TODO(user)` items are being filled in PR #39 (open). `main` is at the #35 release; `develop` is ahead by #36, #30, #38, and #37 (web, docs, and `.kiro` only, no `services/` or `infrastructure/` changes).

| Work                                                                                       | PRs                  | In `develop`/`main`? |
| ------------------------------------------------------------------------------------------ | -------------------- | -------------------- |
| Tasks 1–13, 15, 17–19, 21                                                                  | earlier PRs (#8–#15) | Yes                  |
| Analysis: long-resume fix, job-grounded competencies and keywords, stricter evidence rules | #16, #17             | Yes                  |
| 14 decisions/confirmations UI, 22 Resume tab and states                                    | #18                  | Yes                  |
| 16 recorded answers, 20 report and practice                                                | #19                  | Yes                  |
| 10 Amplify config + CORS, build-path fix                                                   | #20, #24             | Yes                  |
| 25 docs `01–14` + README                                                                   | #21                  | Yes                  |
| 23 alarms, SNS, prod stage; release to `main`                                              | #22, #23             | Yes                  |
| User-test fixes: unreadable answers, report printing, Transcribe errors                    | #26                  | Yes                  |
| Typed answers only (Record "Coming soon"), e2e keyboard fix                                | #28                  | Yes                  |
| Handoff, prod smoke config, tasks 23–24 marked done                                        | #31, #32             | Yes                  |
| Resume tailoring as the main flow (design §7.6, Req 7.9)                                   | #34                  | Yes                  |
| 22 manual iOS Safari + VoiceOver pass, a11y audit of Tailor/Resume tabs, doc screenshots   | #36                  | `develop` only       |
| UI redesign: landing, journey nav, cards, icons                                            | #30                  | `develop` only       |
| Kiro steering, skills, hooks, evaluator-upgrade spec (planned)                             | #38                  | `develop` only       |
| Tailor confirmations match the API (Req 8.1); 375 px button overflow fix                   | #37                  | `develop` only       |
| Releases to `main`                                                                         | 6 releases, #23–#35  | Yes                  |

## Starting work

Run `git switch develop && git pull`, then start each change on its own `feature/<slug>` branch and open a PR into `develop`. Release with a PR from `develop` into `main`; Amplify builds both branches.

## What recent work added

- **Analysis** (`services/api/src/ai/prompts/analyze.ts`, `services/evidenceMapBuilder.ts`): every competency cites a verbatim `jobQuote` and keywords must appear in the job; working-condition requirements are dropped; one resume line caps strength at moderate (Education exempt); trivial, padded, or heading rewordings are dropped. Live eval results vary by run: `docs/analysis-prompt-evaluation.md`.
- **Analysis UI**: accept/reject/undo with score toasts, "I have this experience" confirmation dialog, Resume tab with DOCX/PDF download in two styles (PR #43).
- **Resume tailoring** (#34, design §7.6): a Tailor resume tab (`features/analysis/TailorPanel.tsx`), step 1 from Overview's "Tailor my resume". Pure helpers in `packages/shared/src/tailoring/tailor.ts`: `tailoringPlan` (proven keywords to add to Skills, and keywords the resume doesn't show), `applySkillAdditions`, `findSkillsSection`, `scoreTrail` (score at analysis → now). No model call; added skills live in memory only, so a reload starts again from the saved analysis.
- **Confirmations** (#37, Req 8.1): `canConfirm` in `packages/shared/src/scoring/decisions.ts` (weak or none, not yet confirmed). The UI only offers eligible confirmations, a confirmed keyword stays "Confirmed by you", and not-eligible or conflict errors show Close instead of Retry. The MSW mock now runs the shared `applyConfirmation` with the API's checks in the same order, and returns `fields` on errors.
- **Redesign** (#30): `app/JourneyNav.tsx` (Prepare → Analysis → Interview → Report from the URL), `components/ui/Card.tsx` and `IconTile.tsx`; Button is now `font-semibold` and `rounded-lg`.
- **Kiro** (#38): steering in `.kiro/steering/`, skills in `.kiro/skills/`, and two hooks in `.kiro/hooks/`: a read-only lint of each saved source file, and the offline evaluator regression after a spec task (skipped unless evaluation files changed; never calls Bedrock). `.kiro/specs/evaluator-upgrade/` is planned, not built.
- **Interview**: typed answers only. Recording (presign → S3 → Transcribe → editable transcript) is built behind `FEATURES.recordedAnswers` in `apps/web/src/lib/features.ts`; the account isn't subscribed to Amazon Transcribe (`SubscriptionRequiredException`). Unreadable answers are rejected before any model call.
- **Report**: practice again refreshes the report; all questions expand when printing.
- **Infra**: alarms (API and worker Lambda errors, API 5xx) → SNS email per stage; Budgets `proof-and-poise-5usd` and `-8usd` exist in the account.
- **Smoke test**: `apps/web/playwright.smoke.config.ts` runs the demo journey (no Bedrock) against a deployed site with `SMOKE_BASE_URL`.

## Deployed

- Web: production https://main.d1tn5k7jq2sjsu.amplifyapp.com (prod API), preview https://develop.d1tn5k7jq2sjsu.amplifyapp.com (dev API). The SPA rewrite rule is set in the Amplify console.
- `ProofAndPoise-prod` and `ProofAndPoise-dev` (us-east-1) run the current `main`. Get an API URL with `aws cloudformation describe-stacks --stack-name ProofAndPoise-<stage> --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text`.
- Production web has resume tailoring (#34, released in #35); the account owner's iOS Safari and VoiceOver pass on the deployed site included the Tailor flow (`apps/web/ACCESSIBILITY.md`). #36, #30, #38, and #37 are on `develop` only until the next release. None of them change the API or the stacks, so a release needs no CDK deploy.
- Verified on prod 2026-10-02 (before #34): health, demo session create/read/delete and 401s, CORS from the Amplify domain, the account owner's full typed journey with a real resume, and the Playwright smoke on desktop Chrome and iPhone WebKit. gitleaks over the full history (CI on `main`): no leaks. Prod CloudWatch review of the owner's run (api and worker, 2026-10-02): allowlisted fields only, no resume, answer, or token content, no unhandled errors or timeouts; the only errors are the expected Transcribe `SubscriptionRequiredException`.

## Next up

- **Task 25** [AB]: review and merge PR #39 (submission docs), then fill whatever `TODO(user)` items are still left in `docs/` (Cost Explorer figure, Kiro screenshots, demo video, team names, dates).
- **Release** [AB]: a PR from `develop` into `main` to ship #36, #30, #38, and #37 to production (Amplify web build only).
- After the hackathon: enable Transcribe and flip `FEATURES.recordedAnswers`; split analysis into a job-requirements call and an evidence call; NVDA and Firefox accessibility passes.

## Known issues

- Analysis quality varies between runs on Nova Lite; real performance evidence is sometimes missed.
- Each standard session allows 2 report builds, so a second practice answer can hit "Report limit reached".
- "Practice this in the interview" on missing-evidence cards is "Coming soon" (no contract route).
- `pnpm lint` on Windows with `core.autocrlf=true` reports prettier warnings on many untouched files (CRLF). CI on Linux is unaffected.

## Running it

```bash
pnpm install --frozen-lockfile
pnpm --filter @proof-and-poise/web dev:mock   # http://localhost:5173, API mocked by MSW
```

- Try `/demo` for the fictional demo journey.
- Add `?mockError=UPSTREAM_UNAVAILABLE`, `?mockError=getAnalysis:network`, or `?mockError=off` to simulate errors.
- Checks, in CI order: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- E2E (MSW): `pnpm --filter @proof-and-poise/web exec playwright install chromium webkit` once, then `pnpm --filter @proof-and-poise/web e2e`. Projects: `chromium-desktop`, `webkit-desktop`, `chromium-mobile` (Pixel 7), `webkit-mobile` (iPhone 12). Device presets choose the browser, so check `defaultBrowserType` before adding one. The width audit runs in the desktop projects only.
- `dev:mock` ignores what you submit: every analysis returns the fictional demo map (`apps/web/src/mocks/db.ts`). To see a real analysis, use the deployed API.

To run the web app against the real dev API, create `apps/web/.env.local` (template: root `.env.example`) with `VITE_API_BASE_URL` set to the ApiUrl above, then run `pnpm --filter @proof-and-poise/web dev` (not `dev:mock`, which always uses MSW). `apps/web/src/lib/env.ts` reads it. Every route is real on dev and prod.

## Know before you start

- **Frontend API layer**: `apps/web/src/lib/api/` (typed client plus TanStack Query hooks), `apps/web/src/lib/session.ts`, and `apps/web/src/app/RequireSession.tsx`. The mock backend is `apps/web/src/mocks/db.ts`. When you change or add a contract route, update the matching MSW handler too. The mapped type in `handlers.ts` turns a missing handler into a type error.
- **AWS**: deploys, `cdk bootstrap/deploy/destroy`, and billable calls (Bedrock `Converse`, Transcribe) need explicit approval from the account owner. Ask before running any of them. `cdk synth` and `pnpm build` are fine.
- **AWS CLI/CDK**: use a profile with access, e.g. `export AWS_PROFILE=<your-profile> AWS_REGION=us-east-1`. Diff with `pnpm --filter @proof-and-poise/infrastructure run cdk diff --context stage=dev`.
- **AWS SDK**: the api Lambda bundles its own pinned SDK (`externalModules: []`). All `@aws-sdk/*` in `services/api` are pinned to `3.1141.0`; add new SDK clients at that same version.
- **Rate limit**: testing it blocks new sessions from your IP until the UTC hour ends.
- **Auth**: the router checks the bearer token for every contract with `auth: true`, so new session routes get auth for free.
- **Lambda concurrency**: the quota may still be 10, so don't set reserved concurrency.
- **Deploys**: always pass `--context alarmEmail=<owner email>` (not in the repo). Without it the deploy removes the alarm email subscription. CORS origins are in `infrastructure/cdk.json`.
- **Long button labels at 375 px**: `Button` is `whitespace-nowrap`, so a long label can overflow its card on mobile. Add `whitespace-normal` (as in `TailorPanel.tsx`). In CI's Linux WebKit (iPhone emulation) that overflow dropped the page to about 5 fps and timed out the webkit-mobile e2e tests (#37); macOS WebKit doesn't show it.
- **E2E port**: the config reuses an existing server on :5173 outside CI, so a `dev:mock` running from another checkout gets tested instead of yours. Stop it first.
- **Unreadable answers**: `isReadableAnswer` (`packages/shared/src/interview/readability.ts`) is part of `AnswerRequestSchema`, so test fixtures need real sentences.
- **Known issues**:
  - The shared package pulls the demo fixtures into the main web chunk, which is about 418 kB.
  - Resume upload goes through `useSubmitSetup` and recorded answers through `useTranscribeRecording` (`lib/api/queries.ts`); recording is switched off (see Deployed).
  - Some web tests print a harmless jsdom "Not implemented: Window's scrollTo() method" message. Fix: stub `window.scrollTo` in `apps/web/src/test/setup.ts`.
