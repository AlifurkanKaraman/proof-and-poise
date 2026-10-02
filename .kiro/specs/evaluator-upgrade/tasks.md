# Evaluator upgrade — Implementation Plan

> Not started. This spec was created during Kiro setup; nothing here is implemented.

Legend as in `.kiro/specs/proof-and-poise/tasks.md`: **[A]** frontend/UX, **[B]** backend/AI/infra, **[AB]** shared contracts. Each task runs on a `feature/*` branch and ends with a PR into `develop`. Every task that touches scoring, grounding, keywords, tailoring, the builder, or the analysis prompt ends with the `evaluate-scoring-change` skill.

- [ ] 1. [AB] Offline golden fixtures for the current evaluator (version 1 baseline)
  - Record one fictional model output for each of the 4 non-demo cases in `services/api/src/eval/samples.ts` (from an authorized live run or written by hand), and golden expected values (per-competency strength, the three current scores, kept counts) for all 5 cases. Run all 5 in `evaluate.test.ts` offline.
  - deps: none. _Requirements: 8.1, 8.2_
- [ ] 2. [AB] Shared schema additions and `SCORING_VERSION`
  - Add `SourceRefSchema`, `RequirementKindSchema`, and the optional fields in design §3; `SCORING_VERSION = 1` and a `SCORING_RULES` table in `scoring/weights.ts`; `upgradeStoredMap`. Update the demo fixture and MSW handlers in the same PR. Property: v1 outputs equal today's functions.
  - deps: 1. _Requirements: 3.1–3.5, 7.1–7.5_
- [ ] 3. [AB] Source references for resume and job quotes
  - `locateQuote` in `grounding/quotes.ts` with the round-trip property; read-back verification (Requirement 2.2).
  - deps: 2. _Requirements: 2.1–2.3, 2.5_
- [ ] 4. [B] Structured requirements in model output and builder
  - Optional `kind` in `AnalysisModelOutputSchema` and the analyze prompt; builder stores `jobQuote`, `jobRef`, `kind`, `ref`, and `scoringVersion`. Measure map size.
  - deps: 3. _Requirements: 1.1–1.4_
- [ ] 5. [AB] Extraction and evidence quality
  - Store `extractionStats`; compute `quality.extraction` and `quality.evidence` (design §4) as pure shared functions with properties (determinism, monotonicity, no inflation).
  - deps: 4. _Requirements: 4.1–4.4_
- [ ] 6. [AB] Eligibility and uncertainty handling
  - Move working-condition and eligibility items into `eligibility[]` with status `unknown`; never scored; `not_assessed` vs `none`; `LIMITS.analysis.minExtractionQuality` for the uncertainty notice. Adversarial fixtures for visa/location phrasing.
  - deps: 4. _Requirements: 5.1–5.5_
- [ ] 7. [AB] Advice linkage
  - Recommendations reference a requirement id and evidence ids or a missing-evidence statement; no advice for eligibility items; tailoring excludes eligibility from confirmation prompts. Keyword-stuffing and invented-quote fixtures.
  - deps: 4, 6. _Requirements: 6.1–6.5_
- [ ] 8. [A] Web display
  - Highlight referenced spans in the resume view; quality panel in "How is this calculated?"; "Check this yourself" list; uncertainty notice. All five UI states, keyboard and 375/768/1280 checks; e2e updated.
  - deps: 3, 5, 6. _Requirements: 2.4, 4.5, 5.1, 5.4, 7.4_
- [ ] 9. [AB] Human calibration (**user action required**)
  - Both developers label about 10 fictional pairs independently; report agreement; tune the design §4 weights, `EVAL_THRESHOLDS`, and `minExtractionQuality`; bump `SCORING_VERSION` if anything that affects scores changes. Optional authorized live run (≤ 10 calls).
  - deps: 1, 5, 6. _Requirements: 8.3–8.6_
- [ ] 10. [AB] Documentation
  - Update main design §6 and §7.4 references, `docs/analysis-prompt-evaluation.md` (offline and calibration results), `.kiro/steering/evaluation.md` (new rules become current behavior), and the design §4 changelog.
  - deps: 2–9. _Requirements: 3.3, 8.5_
