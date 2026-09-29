# Proof & Poise — Implementation Plan

Legend: **[A]** is Developer A (frontend and UX). **[B]** is Developer B (backend, AI, and infrastructure). **[AB]** means pair work. **⛓** marks a critical-path task. `deps:` lists the tasks that must be merged first.

Every task runs on a `feature/*` branch and ends with a PR into `develop`. That PR must pass CI and get a review from the other developer.

## Schedule and critical path

| Day | Date | Developer A | Developer B | Exit gate |
|---|---|---|---|---|
| D0 | Sun Sep 27 | 1, 2, 3 (with B) | 1, 3 (with A), 4 | Contracts merged; the stack deploys `/health` |
| D1 | Mon Sep 28 | 5, 6, 7 | 8, 9, 10 | Walking skeleton live on Amplify; real analysis returns a valid map |
| D2 | Tue Sep 29 | 11, 12 | 13, 14 | Analysis workspace and recommendations work end to end on `develop` |
| D3 | Wed Sep 30 | 15, 16 | 17, 18 | The interview works with typed and recorded answers, including a follow-up |
| D4 | Thu Oct 1 | 19, 20, 22 | 21, 23, 24 | Release PR into `main`, prod deployed, **freeze at 20:00** |
| D5 | Fri Oct 2 | 25 | 25 | Incognito verification, screenshots, submission by midday |

**Critical path:** 1 → 3 → 4 → 8 → 9 (analysis worker) → 13 (decisions and confirmations API) → 17 (interview API) → 18 (transcription) → 21 (report API) → 23 (prod deploy and alarms) → 24 (e2e against prod) → 25 (submission).

The frontend runs in parallel against MSW mocks that are built from the same contracts. That keeps UI work off the critical path until the integration points in tasks 12, 16, and 20.

---

## Phase 0: Foundations (D0)

- [x] 1. ⛓ [B] Repository bootstrap (no application code)
  - `git init`, then create `.gitignore` **first** (node_modules, dist, cdk.out, .env*, !.env.example, coverage, playwright-report, *.webm/*.mp4/*.wav, uploads). Then add `.editorconfig`, `.nvmrc` (22), and `.gitleaks.toml`.
  - Install pnpm (`npm i -g pnpm@<pinned>`, since Node 25 doesn't bundle corepack). Create the root `package.json` with scripts `typecheck`, `lint`, `test`, `build`, and `e2e`, plus `pnpm-workspace.yaml`, `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), ESLint flat config, and Prettier.
  - Create the empty workspace packages `apps/web`, `packages/shared`, `services/api`, and `infrastructure`, plus `apps/mobile/README.md`.
  - Create `main` and `develop`. Push after the user creates the GitHub remote.
  - Add `.github/workflows/ci.yml` (install, typecheck, lint, test, build, gitleaks) and a PR template with a security checklist.
  - deps: none. _Requirements: 15.7, 17.4, 19.1–19.3_

- [x] 2. [A] Web app shell and design system
  - Set up Vite + React + TS strict, Tailwind with a token preset (`src/design/tokens.ts`), and shadcn/ui init (Radix). Add `@fontsource-variable` Manrope and Inter, `lucide-react`, Framer Motion `motion.ts` presets, and a `useReducedMotion` wrapper.
  - Build the UI primitives: Button (with variants), Input, Textarea (with a counter), StatusBadge (the 5 trust and strength states), ScoreRing, SegmentedProgress, Stepper, Tabs, Dialog, Disclosure, Toast, plus the state components (Empty, Skeleton, LoadingStage, ErrorState, Success).
  - Add the Router skeleton with lazy routes, per-route error boundaries, a 404 page, and a `/dev/design` route for the internal token gallery (dev builds only).
  - deps: 1. _Requirements: 14.1–14.8_

- [x] 3. ⛓ [AB] Shared contracts and domain (contract-first, pair-reviewed)
  - Add `limits.ts`; Zod schemas for inputs, EvidenceMap, Competency, Evidence, Recommendation, Turn, Evaluation, Report, and ScoreEvent; model-output schemas (strict); and the route contracts in `contracts/`.
  - Add `grounding/`: `normalize`, `isGroundedQuote`, `novelTerms`, and label validation. Add `keywords/` with the alias map and tech dictionary.
  - Add `scoring/` with every formula from design §6, the strength caps, and score-event creation. Add `interview/` with the plan-selection and follow-up rule.
  - Tests: unit tests plus the fast-check properties 1–6 from design §13.
  - deps: 1. _Requirements: 5.2, 5.4, 6.1–6.5, 7.2–7.3, 9.1, 9.3, 17.1_

- [x] 4. ⛓ [B] CDK walking skeleton deployed
  - Build the `ProofAndPoiseStack`: DynamoDB table (on-demand, TTL), S3 bucket (block public access, SSL, SSE-S3, 1-day lifecycle, CORS, autoDelete), the `api` Lambda (arm64, nodejs22.x, 512 MB, 25 s), and an HTTP API with stage throttling of 10/20, CORS, and `/v1/health`. Log retention is 14 days.
  - Add `env.ts` (Zod), an allowlisted `logger.ts` with a redaction test, the error model, and the router.
  - Add CDK assertion tests (no NAT, public access blocked, lifecycle, TTL, throttling).
  - **Before deploying, state the resources to be created and wait for confirmation.** Run `cdk bootstrap`, then `cdk deploy` to a `dev` stage. Check the Service Quotas for Lambda concurrency and Bedrock Nova Lite, then make one test `Converse` call.
  - deps: 1. _Requirements: 15.2–15.4, 16.1, 16.6, 17.5_

## Phase 1: Setup and analysis (D1–D2)

- [x] 5. [A] Landing page
  - Hero ("Turn your real experience into interview-ready evidence."), "Prepare for a job" and "Try the demo" CTAs, the interactive evidence-thread preview (local fictional data with keyboard support), the three steps, and the trust, privacy, and ethics sections. Responsive navigation with an accessible mobile menu, and the `/privacy` and `/ethics` pages.
  - deps: 2. _Requirements: 1.1–1.5, 15.8_

- [x] 6. [A] MSW mock layer and API client
  - Build a typed fetch client that validates responses with the contract schemas, plus TanStack Query hooks, `session.ts` (sessionStorage), and the route guard. Add MSW handlers for every contract route, backed by the demo fixtures, with a toggle to simulate errors, and the `pnpm dev:mock` script.
  - deps: 3, 7 (fixtures). _Requirements: 2.3, 2.6, 8 (contract)_

- [x] 7. [AB] Demo fixture content
  - Write the fictional resume and JD, the precomputed EvidenceMap (it must pass the schemas and grounding), sample answers (including one deliberately vague answer), and labeled offline sample feedback, following design §15.
  - deps: 3. _Requirements: 13.1–13.4_

- [x] 8. ⛓ [B] Sessions, auth, quotas, uploads
  - `POST/GET/DELETE /sessions` (token hash, TTL, demo seeding, IP-hash rate limit with the SSM salt), the bearer auth middleware, the quota counter helper, the global budget counter, and the presigned resume POST (300 s, size and type conditions, session-scoped key).
  - deps: 3, 4. _Requirements: 2.1–2.5, 4.1–4.2, 16.2–16.4_

- [x] 9. ⛓ [B] Bedrock structured invocation and the analysis worker
  - `invokeStructured` (Converse, forced tool use, zod-to-json-schema, maxTokens and temperature per task, one repair retry, token-count logging only, budget check).
  - The worker Lambda: fetch the PDF → check magic bytes → run `unpdf` extraction (≤ 4 pages) → **delete the object** → truncate the text → call the model → apply the grounding filters, strength caps, and label validation → compute parseability, keywords, and scores → persist. `POST/GET /analysis` with async invoke and status stages.
  - Evaluate the prompt against the demo fixture plus 3 varied sample resumes. Record the pass rate in `docs/`.
  - deps: 8. _Requirements: 4.3–4.5, 5.1–5.5, 6.1, 7.2–7.3, 7.8, 15.5, 16.5_

- [ ] 10. [B] Amplify Hosting connection (**user action required**)
  - Add `amplify.yml` (monorepo, `appRoot: apps/web`, pnpm). The user connects the GitHub repo in the Amplify console for the `main` and `develop` branches and sets `VITE_API_BASE_URL`. Add the Amplify domains to the CORS allowlist. Verify the landing page loads on the preview URL.
  - deps: 1, 4, 5. _Requirements: 17.5, 17.7_

- [x] 11. [A] Job setup stepper
  - Resume step (PDF dropzone with client-side type, size, and empty checks, a paste tab, and the requirements and data notice), Target job step (JD, company, role, interview type), Review step. RHF with the shared Zod schemas, ARIA-linked errors, values kept when navigating back, the upload flow (presign → POST), and the analysis kick-off.
  - LoadingStage with staged progress and polling backoff. Recoverable errors: extraction failed leads to "Paste text instead", and there's a retry on failure.
  - deps: 6. _Requirements: 3.1–3.6, 4.4–4.5, 5.1_

- [x] 12. [A] Analysis workspace
  - Overview tab (Job Match, Evidence Coverage, Keyword Coverage, and Parseability rings with "How is this calculated?" disclosures, plus the top 3 strengths and gaps), Competencies tab (matrix with strength and importance filters, expandable evidence with source labels, evidence-thread motion), Recommendations tab (cards per trust label, with accept/reject/undo made optimistic with rollback; missing-evidence cards offer the confirm and practice actions), Resume tab (working resume with highlights and "Copy as text"). Score-change toasts show the reason. Integrate against `develop` API at the end of D2.
  - deps: 6, 11. _Requirements: 5.6–5.7, 6.2–6.4, 7.1, 7.4–7.7, 14.2_

- [ ] 13. ⛓ [B] Decisions and confirmations API
  - `POST …/decision` (accept, reject, or reset; locked once the interview starts; working-resume recompute; keyword coverage; score event). `POST /confirmations` (attestation required, 30–500 chars, max 3, strength cap, `confirmRewrite` model call with grounding against the resume plus the statement, interview priority).
  - deps: 9. _Requirements: 6.4, 7.5–7.6, 8.1–8.5_

- [ ] 14. [B] Confirmation dialog wiring support and API integration fixes
  - Pair with A to integrate tasks 12 and 13 on `develop`, fix contract mismatches, and add the MSW handler for any changes.
  - deps: 12, 13. _Requirements: 8.1_

## Phase 2: Interview (D3)

- [ ] 15. [A] Interview room UI
  - A distraction-free layout with the SegmentedProgress (follow-up sub-steps), the question card with its type and competency label, the optional 30 s prep timer (pausable, hideable, never auto-submits), and the answer panel with Record/Type tabs.
  - A `useRecorder` reducer and hook (format negotiation, 120 s limit, all microphone states) with unit tests. Record, stop, replay, re-record, upload, transcribing skeleton, editable transcript review, and submit. Typed answers with a counter.
  - Show feedback after each answer (strength, improvement, dimension chips), then continue. Demo mode adds "Insert sample answer (fictional)". Resume after reload.
  - deps: 6. _Requirements: 9.2, 9.4–9.7, 10.1–10.3, 10.5, 10.7, 13.3_

- [ ] 16. [A] Interview integration
  - Integrate task 15 against the real endpoints from 17 and 18. Test on Chrome, Firefox, desktop Safari, and iOS Safari. Test the microphone-denied path.
  - deps: 15, 17, 18. _Requirements: 10.2, 10.4_

- [ ] 17. ⛓ [B] Interview API
  - `POST/GET /interview` (the `generateQuestions` model call; server-side selection B1, R1, GAP, B2, R2; idempotent; locks decisions). `POST …/answer` (validation, quota, `evaluateAnswer`, weighted score computation, the follow-up rule, next turn, 409 on duplicates). Demo fallback to the labeled sample feedback on `UPSTREAM_UNAVAILABLE` or `CAPACITY_REACHED`.
  - Rubric and fairness prompt rules (no judgment of accent or fluency, no inferences). Unit tests with a mocked Bedrock client, including guaranteed-follow-up scenarios.
  - deps: 9, 13. _Requirements: 9.1, 9.3–9.4, 11.1–11.5, 13.4_

- [ ] 18. ⛓ [B] Audio upload and transcription
  - Presigned audio POST (≤ 10 MB, allowed types). `POST …/transcription` (daily minute budget, `StartTranscriptionJob` with the output written to `transcripts/<sessionId>/`, and `IdentifyLanguage` off with `en-US`/`en-GB`/`en-IN` options documented). `GET …/transcription` (lazy poll; once done, read the transcript, then delete the audio, transcript, and job). Error mapping leads to the typed fallback.
  - Verify the Transcribe → S3 permissions in dev with a real 10 s recording.
  - deps: 8. _Requirements: 10.4, 10.6–10.7, 16.4_

## Phase 3: Report, hardening, release (D4–D5)

- [ ] 19. [A] Readiness report UI
  - Readiness ring with the two-term explanation, the summary, the competency status list, per-question feedback accordions (with follow-ups nested), strongest evidence, weakest areas, STAR outlines, and three prioritized actions. "Practice again" on questions below Proficient, with a before/after comparison and a score event. Print stylesheet. "Delete my data" with a confirmation dialog.
  - deps: 6. _Requirements: 2.5, 12.1–12.4_

- [ ] 20. [A] Report and practice integration
  - deps: 19, 21. _Requirements: 12.3_

- [ ] 21. ⛓ [B] Report and practice API
  - `POST/GET /report` (deterministic scores plus the narrative model call, validated, idempotent) and `POST /practice` (creates a practice turn, reuses the answer evaluation, best-attempt readiness, score event).
  - deps: 17. _Requirements: 6.2, 12.1–12.3, 12.5_

- [ ] 22. [A] Quality pass: accessibility, responsive, states
  - axe on every screen, a keyboard-only run, a focus-order review, contrast checks, and the reduced-motion check. Verify 375, 768, and 1280 widths and 44 px touch targets. Audit every screen for its loading, empty, and error states. Audit for any button that does nothing.
  - The Playwright demo journey spec (MSW) at 1280 and 375, plus axe assertions, added to CI.
  - deps: 12, 15, 19. _Requirements: 14.2–14.6, 14.9, 17.2–17.3_

- [ ] 23. ⛓ [B] Production deploy and observability
  - Create the `prod` stage stack. CloudWatch alarms (Lambda errors, API 5xx) go to an SNS email topic. Set up AWS Budgets at $5 and $8 (documented, created by the user or through the CLI after confirmation). **Before deploying, state the resources and get confirmation.**
  - Release PR from `develop` into `main`, then the Amplify production build. Review the CloudWatch logs from a full run for content leakage.
  - deps: 20, 21, 22. _Requirements: 15.3, 16.7, 17.5–17.7_

- [ ] 24. ⛓ [AB] Production verification
  - The Playwright smoke test against the prod URL (typed answers). A manual incognito run on desktop and mobile. A recorded-answer run on Safari and Chrome. A gitleaks scan across the full git history. Confirm the CloudWatch logs have no unhandled errors.
  - deps: 23. _Requirements: 17.2, 17.7, 15.7_

- [ ] 25. [AB] Documentation and submission
  - `docs/01–14` according to design §14, the README with deploy and teardown steps, the judging map, the architecture diagram, the cost report (actual Cost Explorer figure), redacted screenshots of Kiro connected to AWS, and the submission story. A and B split the docs. Start `docs/06-timeline.md` and `05-kiro…` on D0 and update them daily.
  - deps: 24 (final numbers and screenshots). _Requirements: 18.1–18.3_

## Stretch (only when task 24 is green before Oct 1 at 12:00)

- [ ]* S1. [B] Polly interviewer voice: pre-synthesize the question audio on plan creation, with a play button (never autoplay) and a text-first design. _Requirements: P3_
- [ ]* S2. [A] Side-by-side diff view in the Recommendations tab. _Requirements: 7.1 (enhancement)_

## Post-hackathon (not scheduled)

- [ ]* P1. Cognito accounts and history
- [ ]* P2. PDF/DOCX export
- [ ]* P4. Streaming transcription
- [ ]* P5. Expo React Native app on `packages/shared`
- [ ]* P6. Bedrock Guardrails, KMS CMK, WAF
- [ ]* P8. Textract OCR for scanned PDFs

## Commands and resources requiring explicit confirmation

- `cdk bootstrap` creates a CDK staging S3 bucket, an ECR repository, and IAM roles in the account and region. It's reversible by deleting the `CDKToolkit` stack.
- `cdk deploy` (dev and prod) creates a DynamoDB table, an S3 bucket, 2 Lambdas, an HTTP API, log groups, an SSM parameter, and later an SNS topic and alarms. It's reversible with `cdk destroy`.
- Creating AWS Budgets. The first two budgets are free.
- Any push to the remote, or to `main`.
