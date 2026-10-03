# Evaluator upgrade — Design

> Status: proposed, not started. Everything in §3–§7 is a proposal. §1 describes the code as it is on `develop` at `5f311b7`. "Main design §n" and "main Req x.y" refer to `.kiro/specs/proof-and-poise/`.

## 1. Current state

**Pipeline.** The analysis worker calls the model through `services/api/src/ai/invokeStructured.ts` with the prompt in `ai/prompts/analyze.ts` (forced tool use, Zod validation, one repair retry; main design §7.1). The output (`AnalysisModelOutputSchema` in `packages/shared/src/schemas/modelOutputs.ts`) has competencies with `jobQuote`, `evidence[{ quote, section }]`, and `proposedStrength`, plus keywords, recommendations, and seniority. `services/api/src/services/evidenceMapBuilder.ts` (`buildEvidenceMap`) turns it into a stored `EvidenceMap`:

- Competencies are dropped unless `isUsableCompetency` holds: the `jobQuote` is a grounded quote of the job text, and `isWorkCondition` (a regex over hours, age, travel, relocation, work authorization, visa, sponsorship, shifts, background checks, drug tests) doesn't match (main design §7.4).
- Resume quotes are deduplicated by normalized text and kept only if `isGroundedQuote` (`packages/shared/src/grounding/quotes.ts`: normalized substring, at least `LIMITS.grounding.minQuoteChars` = 12) holds (main Req 5.4).
- Strength is `capStrength(proposed, evidence)` (`scoring/strength.ts`, main design §6.1): no evidence → `none`; confirmation-only → ≤ moderate; a single Skills quote → ≤ weak; a single non-Education quote → ≤ moderate.
- Keywords are deduplicated by `canonicalTerm`, kept if `isJobKeyword`, topped up with ungrounded ones when fewer than `LIMITS.analysis.keywords.min` (8) survive, then matched with `matchKeywords` (`keywords/match.ts`, aliases in `keywords/dictionary.ts`).
- Recommendations are dropped when unchanged, trivial (`changedWordCount` < 3), padded (> 3 added words), on a heading line (`isHeadingLine`), failing `validateRecommendation` (`grounding/labels.ts`, using `novelTerms`), or beyond 10 (main Req 7.8).
- Scores: `jobMatchScore`, `evidenceCoverageScore`, `keywordCoverageScore` (`scoring/scores.ts`) and `parseabilityScore` (`scoring/parseability.ts`); `interviewReadiness` starts null. The map is parsed with `EvidenceMapSchema` or the build fails with `MODEL_OUTPUT_INVALID`.
- `stats` returns `discardedQuotes`, `discardedRecommendations`, `discardedCompetencies`, `discardedKeywords` (counts only). They aren't stored.

**Formulas** (`scoring/weights.ts`, main design §6, §6.2). Importance weight: required 3, preferred 2, contextual 1. Strength value: strong 1.0, moderate 0.6, weak 0.3, none 0. Job Match = 100·Σ(w·s)/Σw. Evidence Coverage = 100·Σ(w·[s>0])/Σw. Keyword Coverage = 100·matched/total with required keywords counted twice. `toScore100` clamps to [0, 100] and rounds. After decisions and confirmations, `recomputeScores` (`scoring/recompute.ts`) re-matches keywords against the working resume plus confirmations; `applyDecision` and `applyConfirmation` (`scoring/decisions.ts`) emit score events (`scoring/events.ts`, main design §6.3).

**Tailoring** (`tailoring/tailor.ts`, main design §7.6): `tailoringPlan` splits job keywords into `addToSkills` (shown in the resume or a confirmation but not in Skills) and `notShown`; `applySkillAdditions` appends one `Additional skills:` line. It doesn't change Keyword Coverage.

**Stored schema gaps** (`schemas/evidenceMap.ts`):
- `EvidenceSchema` is `{ id, source, quote, section? }`: no offsets or line.
- `CompetencySchema` has no `jobQuote` and no requirement kind; working-condition requirements are dropped without a trace.
- `ScoreSetSchema` is `{ jobMatch, evidenceCoverage, keywordCoverage, parseability, interviewReadiness }`; no scoring version exists anywhere in `schemas/`.
- No extraction-quality or evidence-quality value is stored.

**Reading stored maps.** `data/analysisRepository.ts` returns the stored item cast to `ReadyAnalysis` (not re-parsed). The web client (`apps/web/src/lib/api/client.ts`) parses responses with the contract's response schema; Zod `z.object` strips unknown keys, so new optional fields are ignored by an older client. The MSW mock (`apps/web/src/mocks/db.ts`) and the demo fixture (`packages/shared/src/fixtures/demo/evidenceMap.ts`) also compute scores with the shared functions.

**Evaluator** (main task 9). `services/api/src/eval/evaluate.ts` (`evaluateAnalysis`) runs `buildEvidenceMap` on a case and checks `mapValid`, `groundedQuoteRate` ≥ 0.8, `keptRecommendationRate` ≥ 0.5 (`EVAL_THRESHOLDS`), `gapListed`, `gapNotOverstated` (weak or none), and `hasEvidence`. `samples.ts` has 5 fictional cases: `demo-fixture`, `career-changer-data-analyst`, `frontend-mid-level`, `new-grad-messy-layout-injection`, `fullstack-to-systems-performance`. Offline (`evaluate.test.ts`), only `demo-fixture` runs, using `demoModelOutput()` from `services/api/src/test/fixtures.ts`. The other 4 run only live (`analyzePrompt.live.test.ts`, `RUN_BEDROCK_EVAL=1`, billable); results are in `docs/analysis-prompt-evaluation.md` and vary between runs (2/5 to 5/5 on the same prompt). There are no golden expected values per case and no human calibration labels. Minor: the first `evaluate.test.ts` test name says "plus 3 varied cases" while 4 exist.

**Properties** (`packages/shared/src/properties.test.ts`, main design §13): 1 scores are integers in [0, 100]; 2 monotonicity of Job Match and Evidence Coverage; 3 follow-ups can't lower a question score; 4 grounded acceptances add no unsupported numbers; 5 rewording-only acceptances never change Job Match; 6 the follow-up rule yields 1–2 follow-ups.

## 2. Goals and non-goals

Goals: Requirements 1–8. Non-goals: no new AWS resources, no new dependencies, no model change, no change to interview scoring (`scoring/interview.ts`) or parseability, no change to the meaning of the five existing scores at version 1.

## 3. Data model changes (all optional, additive)

In `packages/shared/src/schemas/`:

```ts
// common.ts
export const SourceRefSchema = z.object({
  start: z.number().int().min(0), // UTF-16 offset into the stored original text
  end: z.number().int().min(0),   // exclusive; end > start
  line: z.number().int().min(1),
  occurrences: z.number().int().min(1).optional(),
});
export const RequirementKindSchema = z.enum([
  'skill', 'tool', 'experience', 'education', 'certification', 'eligibility', 'working_condition',
]);

// evidenceMap.ts (additions)
EvidenceSchema        += { ref: SourceRefSchema.optional() }            // resume evidence only
CompetencySchema      += { jobQuote: z.string().optional(), jobRef: SourceRefSchema.optional(),
                           kind: RequirementKindSchema.optional() }
EvidenceMapSchema     += {
  scoringVersion: z.number().int().min(1).optional(),                  // absent → 1 (§6)
  quality: z.object({ extraction: Score100Schema, evidence: Score100Schema }).optional(),
  eligibility: z.array(z.object({
    id: ShortIdSchema, jobQuote: z.string(), jobRef: SourceRefSchema.optional(),
    kind: z.enum(['eligibility', 'working_condition']),
    status: z.enum(['unknown', 'stated_by_candidate']),
  })).optional(),
  extractionStats: z.object({ /* the four discarded counts + kept counts + repaired */ }).optional(),
}
ScoreEventSchema      += { scoringVersion: z.number().int().min(1).optional() }
```

`ScoreSetSchema` is unchanged. Model output (`modelOutputs.ts`) gains an optional `kind` per competency; offsets are never requested from the model.

## 4. Scoring v2

- `SCORING_VERSION` (an integer constant) lives in `scoring/weights.ts`, next to the weights it versions. Version 1 = today's formulas. Every function that produces a score set takes the version explicitly; a `SCORING_RULES[version]` table holds weights and caps so old maps recompute with their own rules.
- Bump rule: any change to `IMPORTANCE_WEIGHT`, `STRENGTH_VALUE`, `capStrength`, the score formulas, keyword matching or aliases, or `LIMITS.grounding` bumps the version and adds a row to the changelog below. Pure refactors with identical outputs don't.
- Job fit = Job Match at the map's version (unchanged formula).
- Extraction quality (proposed, to be calibrated in task 9) = `100 × mean(keptQuoteRate, keptRequirementRate, keptKeywordRate)`, minus a fixed penalty when the repair retry was used. Kept recommendation rate is reported but excluded (dropping padded advice is the system working, not a bad reading).
- Evidence quality (proposed, to be calibrated in task 9) = `100 × Σ(w · q) / Σ(w · [s > 0])` over scored requirements with any evidence, where `q` = 1.0 for two or more independent resume quotes, 0.6 for one experience/projects/education quote, 0.3 for Skills-only or confirmation-only. 0 requirements with evidence → reported as "not assessed", not 0.
- Eligibility and working-condition items never enter any formula.
- Uncertainty notice threshold: `LIMITS.analysis.minExtractionQuality` (value set in task 9).

Changelog: v1 = main design §6 as of `5f311b7`.

## 5. Pipeline changes

- `grounding/quotes.ts`: add `locateQuote(quote, source) → SourceRef | null`, mapping a normalized match back to original offsets (normalization changes length, so keep an index map from normalized to original positions). `isGroundedQuote` stays as is.
- `evidenceMapBuilder.ts`: attach `ref` to resume evidence and `jobQuote`/`jobRef`/`kind` to competencies; move working-condition matches (`isWorkCondition`) and `kind: eligibility | working_condition` into `eligibility[]` instead of dropping them; store `extractionStats` and `quality`; set `scoringVersion`.
- `ai/prompts/analyze.ts`: ask for `kind`; keep the instruction to copy the job quote verbatim. No other prompt change in this spec.
- `tailoring/tailor.ts`: unchanged rules; `notShown` items whose competency kind is eligibility are excluded from confirmation prompts.
- `scoring/recompute.ts`, `scoring/decisions.ts`: pass the map's version through; score events record it.
- Read path: a pure `upgradeStoredMap(map)` in shared fills `scoringVersion: 1` when absent and verifies `ref` spans (Requirement 2.2) without changing scores.

## 6. Backward compatibility and rollout

Order (each step deployable on its own): (1) shared schemas + `SCORING_VERSION` + `upgradeStoredMap`, all optional fields; (2) API builder writes the new fields; (3) web reads them when present (highlighting, quality panel, "Check this yourself"); (4) demo fixture and MSW handlers updated in the same PR as (1) so `demo.test.ts` and `handlers.test.ts` stay green. An old web client strips unknown fields (Zod default); a new web client treats missing fields as version 1 with no quality panel. No migration: sessions expire in 24 h (main design §5).

## 7. Testing and calibration

- Offline golden fixtures: record one fictional model output per case in `services/api/src/eval/` (counts and text from the fictional samples only), plus a golden expected-values file per case keyed by `scoringVersion`. `evaluate.test.ts` runs all 5 offline.
- Properties (fast-check, reusing `src/test/arbitraries.ts`): determinism; order independence of requirements and keywords; version stability (v1 outputs equal today's functions); monotonicity of job fit and evidence quality; no inflation (Skills additions never raise job fit or evidence quality; eligibility items never change any score); `locateQuote` round-trips (`normalize(source.slice(start, end)) === normalize(quote)`).
- Adversarial fixtures: keyword stuffing in Skills, invented quotes, a near-miss quote (one word changed), prompt injection inside the resume, and visa/location phrasing in the job.
- Calibration protocol: about 10 fictional resume/job pairs; each developer labels per-requirement strength and eligibility independently; report agreement (percent and Cohen's kappa); thresholds in `EVAL_THRESHOLDS` and the quality weights are tuned against the agreed labels and recorded in `docs/analysis-prompt-evaluation.md`.
- Live evaluation: at most 10 billable calls per run, only with explicit authorization.

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| Offset mapping wrong after normalization (Unicode, bullets, dashes) | Index map plus the round-trip property; fall back to no `ref` rather than a wrong one |
| Version table grows complex | Keep only versions that may still be stored (24 h TTL); drop older ones after a release |
| Model misclassifies `kind`, hiding a real skill as eligibility | Regex check (`isWorkCondition`) must agree before an item leaves scoring; otherwise keep it scored |
| A quality number reads as a second "score" | Explain it as a reading-quality signal; never call it an ATS score (main Req 6.2) |
| Map size grows past the ≈ 60 KB budget (main design §5) | Refs are small integers; measure in task 4 |

## 9. Open questions and Unknowns

- Whether quality values are shown on the Overview or only in "How is this calculated?" (product decision).
- Calibration set size and agreement threshold.
- Whether Nova Lite classifies `kind` reliably (measure before relying on it).
- Whether `upgradeStoredMap` should run in the API read path, the web, or both.
