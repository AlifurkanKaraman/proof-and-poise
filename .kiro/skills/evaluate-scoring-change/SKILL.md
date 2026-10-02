---
name: evaluate-scoring-change
description: Use after any change to scoring, grounding, keyword matching, tailoring, the evidence map builder, the analysis prompt, the demo fixture, or LIMITS.analysis/LIMITS.grounding in Proof & Poise. Runs the existing offline evaluator fixtures and property tests, compares results with expected behavior, and checks for unsupported matches, keyword inflation, inconsistent scoring, and fabricated recommendations. Reports fixture gaps instead of claiming validation passed.
---

# Evaluate a scoring change

## When to use

A diff touches any path in `evaluation.md`'s `fileMatchPattern` (shared `scoring/`, `grounding/`, `keywords/`, `tailoring/`, `fixtures/demo/`, `properties.test.ts`, `test/arbitraries.ts`, `limits.ts`, `schemas/evidenceMap.ts`, `schemas/modelOutputs.ts`; api `eval/`, `services/evidenceMapBuilder*.ts`, `ai/prompts/analyze*.ts`), or `LIMITS.analysis` / `LIMITS.grounding` in `limits.ts`.

## Inputs

- The diff (`git diff` or `git diff develop...HEAD`).
- The intended behavior change and the Req/design section it implements (design §6, §6.1, §6.2, §6.3, §7.4, §7.6, §13, §15).

## Fixtures that exist today

| Fixture | Where | Runs offline? |
| --- | --- | --- |
| Demo scenario (inputs, evidence map, interview, feedback) | `packages/shared/src/fixtures/demo/` + `demo.test.ts` | yes |
| Demo as model output | `demoModelOutput()` in `services/api/src/test/fixtures.ts` | yes (`evaluate.test.ts`, `analyze.test.ts`, `invokeStructured.test.ts`) |
| Evaluator cases `demo-fixture`, `career-changer-data-analyst`, `frontend-mid-level`, `new-grad-messy-layout-injection`, `fullstack-to-systems-performance` | `services/api/src/eval/samples.ts` | only `demo-fixture`; the other 4 have no recorded model output and run only live |
| Unit and property cases | `scoring.test.ts`, `decisions.test.ts`, `grounding.test.ts` (incl. keyword matching), `tailor.test.ts`, `properties.test.ts` + `src/test/arbitraries.ts`, `evidenceMapBuilder.test.ts`, `analyze.test.ts` | yes |

Missing: golden expected scores per case, recorded outputs for the 4 non-demo cases, a dedicated keyword-stuffing fixture, and human calibration labels. The `evaluator-upgrade` spec (`.kiro/specs/evaluator-upgrade/`) plans them.

## Steps

1. Run `node .kiro/scripts/eval-regression.mjs --force` (offline; `--force` runs even when the change is already committed; it runs the shared scoring/grounding/keywords/tailoring/fixtures/schemas/properties tests and the api eval, builder, and analyze-prompt tests, with `RUN_BEDROCK_EVAL` removed). Record pass/fail counts and the exit code.
2. Compare with expected behavior:
   - `EVAL_THRESHOLDS` in `services/api/src/eval/evaluate.ts` (grounded quote rate ≥ 0.8, kept recommendation rate ≥ 0.5, gap listed and not overstated);
   - demo spread (design §15: 3 strong, 2 moderate, 2 weak, 1 missing) and stored scores equal to recomputed (`demo.test.ts`);
   - properties 1–6 (design §13).
   If the change is meant to move a number, write down the expected before/after and why.
3. Unsupported matches: evidence that isn't a normalized resume substring (`isGroundedQuote`), competencies without a grounded `jobQuote`, keywords not in the job text (note the min-count top-up in `evidenceMapBuilder.ts`), working conditions scored, or a Skills-only quote above `weak` (`capStrength`).
4. Keyword inflation: `tailoringPlan`/`applySkillAdditions` offering terms the resume or confirmations don't show; Keyword Coverage rising from Skills additions alone (design §7.6 says it must not); new aliases in `keywords/dictionary.ts` that match unrelated words; misuse of the required ×2 weight.
5. Inconsistent scoring: the same inputs giving different output; dependence on competency or keyword order; non-integer or out-of-range scores; rewording-only acceptance changing Job Match (§6.3); stored vs recomputed mismatch (`recomputeScores`); weights or caps changed without updating design §6, the demo fixture, and tests together (no scoring version exists yet).
6. Fabricated recommendations: added numbers or terms (`novelTerms`, Req 7.3), wrong trust label (`validateRecommendation`), `missing_evidence` with an Accept path (Req 7.4), padded or trivial rewordings kept, `originalText` not in the resume (Req 7.2), more than 10 kept (Req 7.8).
7. For each new rule, add a fictional fixture or test next to the existing ones (`samples.ts`, `evidenceMapBuilder.test.ts`, `properties.test.ts` with `arbitraries.ts`). Keep `(fictional)` labels and `@example.com` contacts.
8. Live evaluation (`RUN_BEDROCK_EVAL=1 pnpm --filter @proof-and-poise/api exec vitest run src/eval/analyzePrompt.live.test.ts`) makes billable Bedrock calls. Run it only with explicit authorization (`safe-changes.md` risk report), then add a row to the Results table in `docs/analysis-prompt-evaluation.md`.

Fixture gap rule: only `demo-fixture` is checked offline. Without an authorized live run, say "4 evaluator cases not validated (live only)". Never report them as passing.

## Completion evidence

- `eval-regression.mjs` output: pass/fail counts per suite and the exit code.
- A table with one row per check category (unsupported matches, keyword inflation, inconsistent scoring, fabricated recommendations): expected, observed, and the test or file that shows it.
- New or updated fixtures and tests.
- Gaps and unverified items, including the live-only cases.
