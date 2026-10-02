---
inclusion: fileMatch
fileMatchPattern: ["packages/shared/src/scoring/**", "packages/shared/src/grounding/**", "packages/shared/src/keywords/**", "packages/shared/src/tailoring/**", "packages/shared/src/properties.test.ts", "packages/shared/src/test/arbitraries.ts", "packages/shared/src/limits.ts", "packages/shared/src/fixtures/demo/**", "packages/shared/src/schemas/evidenceMap.ts", "packages/shared/src/schemas/modelOutputs.ts", "services/api/src/eval/**", "services/api/src/services/evidenceMapBuilder*.ts", "services/api/src/ai/prompts/analyze*.ts", "docs/analysis-prompt-evaluation.md", ".kiro/specs/evaluator-upgrade/**"]
---

# Evaluation: matching, evidence, scores, advice

Rules for resume/job matching and scoring as implemented today. Cite the spec (`.kiro/specs/proof-and-poise/`) when code enforces one. The core invariant (`product.md`) applies: the model writes language; everything below is deterministic code.

## Matching

- Competencies come from the job: each `jobQuote` must be a grounded quote of the job description or role, or the competency is dropped (design §7.4, `isUsableCompetency` in `services/api/src/ai/prompts/analyze.ts`).
- Working-condition competencies (hours, travel, relocation, work authorization, visa, shifts, age, checks) are dropped, never scored (design §7.4, `isWorkCondition`).
- Keywords must appear in the normalized job text (`isJobKeyword`). Exception: if fewer than `LIMITS.analysis.keywords.min` survive, the first ungrounded ones are kept so the map stays valid (`evidenceMapBuilder.ts`).
- Keyword matching against the resume is deterministic: `keywords/match.ts` (`canonicalTerm`, `termVariants`, `matchKeywords`) with aliases in `keywords/dictionary.ts`. Never ask the model whether a keyword matches.

## Source-grounded evidence

- A `resume` quote counts only if its normalized form (≥ `LIMITS.grounding.minQuoteChars`) is a substring of the normalized resume (Req 5.4, `isGroundedQuote`). Ungrounded quotes are discarded and counted, never repaired.
- No surviving evidence → strength `none` (Req 5.4). Strength caps (design §6.1, `capStrength`): confirmation-only ≤ moderate (Req 8.2), single Skills quote ≤ weak, single non-Education quote ≤ moderate.
- Stored `Evidence` has `quote` and `section` only: no offsets, and `jobQuote` isn't stored. Don't rely on either existing.

## Deterministic scores

- Formulas live only in `packages/shared/src/scoring` (`weights.ts`, `scores.ts`, `recompute.ts`; design §6, §6.2). Scores are integers 0–100 from pure functions (Req 6.1, 6.5); report numbers come from them too (Req 12.5).
- Every score change records a score event (Req 6.4, design §6.3). Rewording-only acceptances never change Job Match (§6.3, property 5). Listing proven keywords in Skills doesn't change Keyword Coverage (§7.6).
- There is no scoring version field today. A change to a weight, cap, or formula changes every stored score's meaning: update design §6, the demo fixture, and the tests together.

## Truthful advice

- `originalText` must be in the resume (Req 7.2); proposed text adds no numbers or job/tech terms absent from the resume and confirmations (Req 7.3, `novelTerms`). Trust labels are validated (`validateRecommendation`, design §7.4); trivial, padded, and heading rewrites are dropped; at most 10 (Req 7.8).
- Nothing is applied without an explicit accept (Req 7.6). `missing_evidence` has no Accept (Req 7.4).
- Tailoring suggests only keywords the resume or a confirmation already shows (Req 7.9, `tailoringPlan`); gaps go to confirmations (Req 8) or interview practice.
- Never call a score an "ATS score" (Req 6.2). Feedback judges content only; no inference on emotion, honesty, personality, disability, or employability (Req 11.3–11.4).

## Regression expectations

- Properties 1–6 (design §13, `properties.test.ts`) stay green.
- `fixtures/demo/demo.test.ts`: stored scores equal the shared functions; the designed spread (design §15) holds.
- `services/api/src/eval/evaluate.test.ts` offline baseline passes (`EVAL_THRESHOLDS` in `evaluate.ts`).
- Run `node .kiro/scripts/eval-regression.mjs --force` and follow the `evaluate-scoring-change` skill. Add a row to the Results table in `docs/analysis-prompt-evaluation.md` only after an authorized live run. Live pass rates vary run to run (2/5 to 5/5 on the same prompt), so one live run isn't proof.

## Fixtures (today)

- Offline: the demo fixture (`packages/shared/src/fixtures/demo/`, `demoModelOutput()` in `services/api/src/test/fixtures.ts`), unit cases in `scoring.test.ts`, `grounding.test.ts` (incl. keyword matching), `tailor.test.ts`, `evidenceMapBuilder.test.ts`, `analyze.test.ts`, and fast-check arbitraries in `src/test/arbitraries.ts`.
- Live only: the 4 non-demo cases in `services/api/src/eval/samples.ts` (no recorded model output). No golden expected-score fixtures and no human calibration labels exist. Report this gap; don't claim those cases pass.

Planned changes (versioning, offsets, separate quality metrics) are in `.kiro/specs/evaluator-upgrade/`. They aren't current behavior.
