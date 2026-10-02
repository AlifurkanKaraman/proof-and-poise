---
inclusion: always
---

# Product: Proof & Poise

Source of truth: `.kiro/specs/proof-and-poise/` (`requirements.md`, `design.md`, `tasks.md`). Read the relevant requirement or design section before changing behavior.

- Purpose: evidence-grounded job-readiness web app. A candidate gives a resume and a job description. The app builds a competency map with verbatim resume evidence, suggests truthful resume changes the candidate approves one at a time, runs a five-question adaptive mock interview aimed at the weakest evidence, and produces an explainable readiness report.
- Users: international students, early-career candidates, and other job seekers. MVP is anonymous (server-issued session bearer token, no accounts).
- Core invariant: the model writes language only. Scores, grounding checks, follow-up decisions, and quotas are deterministic code in `packages/shared`. Model output is schema-validated and grounding-checked before it becomes state.
- Key flows: landing → prepare (job setup + resume) → analysis workspace (evidence map, recommendations, confirmations) → interview (typed or recorded answers) → report → practice again. A public demo scenario runs the same journey from a fictional fixture.
- Context: AWS "Zero to Shipped" Shipathon, deadline 2026-10-02, two developers ([A] frontend/UX, [B] backend/AI/infra, [AB] shared contracts), AWS budget under $10.
- Naming: "Proof & Poise" in UI and docs (never "ProofPoise"); slug `proof-and-poise`; PascalCase `ProofAndPoise`.

## Current scope (from tasks.md and the working tree)

- Done: tasks 1–21 and 23 (bootstrap through report/practice, Amplify hosting, prod stage with alarms and budgets), the code part of 22, and drafted docs for 25. Production runs at https://main.d1tn5k7jq2sjsu.amplifyapp.com (prod API) and https://develop.d1tn5k7jq2sjsu.amplifyapp.com (dev API). Answers are typed; recorded answers are built but switched off because the account isn't subscribed to Amazon Transcribe. See `HANDOFF.md`.
- Left: prod log review (24), manual accessibility checks (22), and the `TODO(user)` doc items (25).
- Out of MVP scope: the "Post-hackathon" list in requirements.md (Cognito, Polly, mobile app, etc.). `apps/mobile/` is a README only.

## Unknown

- Production and branch Amplify domains (CORS currently allows `http://localhost:5173` only).
## Known account facts (dev)

- CDK bootstrapped in us-east-1; Nova Lite (`us.amazon.nova-lite-v1:0`) callable via Converse.
- Lambda concurrent executions quota was 10 (new-account default) at deploy time; an increase may be pending. Don't set reserved concurrency while it's 10.
- Bedrock Nova Lite: 200 cross-region requests/min, 8M cross-region tokens/min.
