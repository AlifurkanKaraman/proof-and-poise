---
name: feature-delivery
description: Use when implementing a new feature, screen, API route, or spec task for Proof & Poise (outside the spec task-execution flow, or to plan one). Turns the request into a short plan that follows the existing contract-first architecture (shared contract → API route → web feature → CDK wiring), then implements and verifies it.
---

# Feature delivery

## 1. Ground it

- Find the matching requirement, design section, and task in `.kiro/specs/proof-and-poise/`. If there's none, say so and confirm scope before building.
- Run `git status --short`. Read the files you'll extend (see `structure.md` for where things go).

## 2. Plan (3–6 bullets, shared before large changes)

Order the work contract-first, including only the layers the feature needs:

1. `packages/shared`: Zod schemas in `schemas/`, route contract in `contracts/routes.ts`, limits in `limits.ts`, pure logic + property tests.
2. `services/api`: handler in `routes/<name>.ts`, register in `app.ts`, throw `ApiError` for expected failures, log only via the allowlisted logger.
3. `infrastructure`: HTTP API route, env vars (also in `lib/env.ts`), least-privilege grants, and a `stack.test.ts` assertion.
4. `apps/web`: page in `features/<area>/`, route in `app/routes.tsx`, built from `components/ui` and `components/states` with all five UI states.

Name the tests you'll add and any new dependency (use `dependency-change` for that).

## 3. Implement and verify

- Implement layer by layer; run that package's `typecheck` and `test` before moving on.
- Finish with root `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, one at a time.
- For UI work, state which accessibility and responsive checks you did (keyboard, focus, 375/768/1280 px) and which you couldn't.
- Don't deploy. If the feature needs AWS changes, stop at synth/diff and hand off to `cdk-change`.

## 4. Report

Files changed, requirement IDs covered, checks with results, open questions.
