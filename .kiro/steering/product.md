---
inclusion: always
---

# Product: Proof & Poise

Source of truth: `.kiro/specs/proof-and-poise/` (`requirements.md`, `design.md`, `tasks.md`). Read the relevant requirement or design section before changing behavior.

- Purpose: evidence-grounded resume tailoring and interview prep. A candidate gives a resume and a job description. The app builds a competency map with verbatim resume evidence, then helps them tailor the resume to the job truthfully (supported changes they approve one at a time, proven job keywords listed in Skills, confirmations for real experience) and download it. Step 2 is a five-question adaptive mock interview aimed at the weakest evidence, with an explainable readiness report.
- Users: international students, early-career candidates, and other job seekers. MVP is anonymous (server-issued session bearer token, no accounts).
- Core invariant: the model writes language only. Scores, grounding checks, follow-up decisions, and quotas are deterministic code in `packages/shared`. Model output is schema-validated and grounding-checked before it becomes state.
- Key flows: landing → prepare (job setup + resume) → analysis workspace (evidence map, recommendations, confirmations) → interview (typed or recorded answers) → report → practice again. A public demo scenario runs the same journey from a fictional fixture.
- Context: AWS "Zero to Shipped" Shipathon, deadline 2026-10-02, two developers ([A] frontend/UX, [B] backend/AI/infra, [AB] shared contracts), AWS budget under $10.
- Naming: "Proof & Poise" in UI and docs (never "ProofPoise"); slug `proof-and-poise`; PascalCase `ProofAndPoise`.

## Current scope (from tasks.md and the working tree)

- Done: tasks 1–24 (bootstrap through report/practice, Amplify hosting, accessibility audit with a manual iOS Safari and VoiceOver pass, prod stage with alarms and budgets), drafted docs for 25, resume tailoring as the main flow (design §7.6, Req 7.9; PR #34, released to `main` in #35), the UI redesign (#30), and Tailor confirmations matching the API (Req 8.1; #37). #30, #36, #37, and #38 are on `develop`, not yet released to `main`. Production runs at https://main.d1tn5k7jq2sjsu.amplifyapp.com (prod API) and https://develop.d1tn5k7jq2sjsu.amplifyapp.com (dev API). Answers are typed; recorded answers are built but switched off because the account isn't subscribed to Amazon Transcribe. See `HANDOFF.md`.
- Left: the `TODO(user)` doc items (25; PR #39 open) and a release from `develop` to `main`.
- Out of MVP scope: the "Post-hackathon" list in requirements.md (Cognito, Polly, mobile app, etc.). `apps/mobile/` is a README only.

- Planned, not started: `.kiro/specs/evaluator-upgrade/` (structured requirements, source offsets, versioned scoring). Not current behavior.
- CORS (`infrastructure/lib/config.ts` + `cdk.json` `proof-and-poise:allowedOrigins`): `http://localhost:5173` is always allowed; dev adds `https://develop.d1tn5k7jq2sjsu.amplifyapp.com`, prod adds `https://main.d1tn5k7jq2sjsu.amplifyapp.com`. `*`, paths, and non-https origins are rejected.

## Unknown

- Whether the deployed stacks match the current `cdk.json` origins (not checked against the live account).
- Whether the Lambda concurrency quota increase was granted.
- The Kiro IDE version the team uses (kiro-cli `2.27.0` is installed locally).

## Known account facts (dev)

- CDK bootstrapped in us-east-1; Nova Lite (`us.amazon.nova-lite-v1:0`) callable via Converse.
- Lambda concurrent executions quota was 10 (new-account default) at deploy time; an increase may be pending. Don't set reserved concurrency while it's 10.
- Bedrock Nova Lite: 200 cross-region requests/min, 8M cross-region tokens/min.
