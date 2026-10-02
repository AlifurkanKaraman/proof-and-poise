# Evaluator upgrade — Requirements

> Status: proposed, not started. Created during Kiro setup (2026-10-02). Nothing here is implemented.

## Introduction

Proof & Poise scores a resume against a job with deterministic code in `packages/shared` (design §6 of the main spec) after the model proposes competencies, quotes, keywords, and recommendations (design §7.4). This upgrade makes that evaluation more checkable and more honest about what it doesn't know: job requirements become structured and traceable, evidence carries re-checkable source positions, scoring is versioned, quality signals are separated from job fit, eligibility requirements are handled explicitly, and the evaluator gets offline regression fixtures and a human calibration step.

It extends `.kiro/specs/proof-and-poise/` (cited as "main Req x.y" and "main design §n"). The core invariant still holds: the model writes language only; scores, grounding, and decisions are deterministic code in `packages/shared`.

## Baseline

The current state is described in design §1. In short: stored evidence has a quote and section but no offsets; competencies don't store their job quote; there is no scoring version; job fit, extraction quality, and evidence quality aren't reported separately; working-condition requirements are dropped silently; and only the demo fixture is evaluated offline.

## Glossary

- **Job requirement**: one requirement from the job description, with a verbatim job quote. Today's "competency" is the scored kind.
- **Source reference**: the position of a quote in the text it came from (`start`/`end` character offsets into the stored original text, plus a 1-based line).
- **Scoring version**: an integer identifying the formulas, weights, and caps used to compute a score set.
- **Job fit**: today's Job Match semantics (weighted strength over scored requirements).
- **Extraction quality**: how much of the model's output survived the deterministic checks.
- **Evidence quality**: how well the surviving evidence supports the strengths (independent quotes vs Skills-only or confirmation-only).
- **Eligibility requirement**: a requirement about the candidate's situation, not a skill (work authorization, visa sponsorship, security clearance, location, hours, travel, age).
- **Not assessed**: the system has no basis to judge a requirement. Distinct from `none` (assessed, no evidence found).

## Requirements

### Requirement 1: Structured job requirements

**User story:** As a candidate, I want to see exactly which phrase in the job each requirement comes from, so I can trust the map.

1. THE analysis SHALL produce each job requirement with an `id`, the verbatim `jobQuote`, a `kind` (`skill` | `tool` | `experience` | `education` | `certification` | `eligibility` | `working_condition`), and an `importance` (main Req 5.2).
2. THE server SHALL keep a requirement only WHEN its `jobQuote` is a grounded quote of the job description or role (main design §7.4), and SHALL store the quote with its source reference into the job text.
3. WHEN a requirement's kind is `eligibility` or `working_condition`, THE system SHALL handle it under Requirement 5 and SHALL NOT score it.
4. THE limits for requirement counts SHALL live in `packages/shared/src/limits.ts`; scored requirements SHALL keep the current 6–12 range (main Req 5.2) unless design §4 changes it with a version bump.

### Requirement 2: Resume evidence with verifiable source references

**User story:** As a candidate, I want every quote highlighted in my own resume, so I can see it wasn't invented.

1. EACH `resume` evidence item SHALL carry a source reference (`start`, `end`, `line`) into the stored original resume text, computed by deterministic code, never taken from the model.
2. THE server SHALL re-verify on read-back that the referenced span normalizes to the stored quote; a mismatch SHALL be treated as ungrounded (main Req 5.4).
3. WHEN a quote occurs more than once, THE reference SHALL point to the first occurrence and THE system SHALL record the occurrence count.
4. THE web app SHALL be able to highlight the referenced span in the resume view, with the existing source label (main Req 5.7).
5. Candidate confirmations SHALL keep `source: candidate_confirmation` and SHALL NOT receive resume offsets.

### Requirement 3: Deterministic, versioned scoring

**User story:** As a developer, I want every stored score to say which rules produced it, so a rule change never silently changes old results.

1. EVERY computed score set SHALL store the `scoringVersion` that produced it.
2. Scores SHALL remain pure functions of their inputs, integers 0–100 (main Req 6.1, 6.5).
3. ANY change to a weight, strength cap, formula, or matching rule that can change a score SHALL increment `scoringVersion` and add a changelog entry in design §4.
4. WHEN a stored map has a version older than the current one, THE system SHALL keep and recompute it with its own version's rules, or SHALL show that it was scored with older rules; it SHALL NOT mix versions in one score event.
5. Score events SHALL record the version used for `before` and `after` (main design §6.3).

### Requirement 4: Separate job fit, extraction quality, and evidence quality

**User story:** As a candidate, I want to know whether a low score means a weak fit or a weak reading of my resume.

1. THE system SHALL report job fit, extraction quality, and evidence quality as separate values and SHALL NOT blend them into one number.
2. Job fit SHALL keep today's Job Match formula for the current version (main design §6.2).
3. Extraction quality SHALL be computed from deterministic builder counts (kept vs discarded quotes, requirements, keywords, recommendations, and whether the repair retry was needed).
4. Evidence quality SHALL be computed from the surviving evidence (share of strength backed by two or more independent resume quotes vs Skills-only or confirmation-only evidence).
5. THE UI SHALL explain each value with its inputs (main Req 6.3) and SHALL NOT call any of them an "ATS score" (main Req 6.2).

### Requirement 5: Explicit uncertainty and eligibility handling

**User story:** As an international student, I want visa and location requirements flagged for me to check, not guessed from my resume.

1. Eligibility and working-condition requirements SHALL be listed as "Check this yourself" items with their job quote and SHALL be excluded from every score.
2. THE system SHALL NOT infer eligibility from the resume, names, schools, locations, or any protected attribute, and SHALL NOT state that the candidate meets or fails one (main Req 11.4).
3. THE status of an eligibility item SHALL be `unknown` unless the candidate states it themselves; a candidate statement SHALL be shown as theirs and still SHALL NOT affect scores.
4. WHEN extraction quality is below a threshold in `limits.ts`, THE UI SHALL show an uncertainty notice next to the scores, with a re-run or paste-text option.
5. THE data model SHALL distinguish `not_assessed` from `none` for requirements the system couldn't judge (for example, a requirement whose kind couldn't be determined).

### Requirement 6: Truthful improvement advice

**User story:** As a candidate, I want every suggestion tied to a requirement and to my real evidence.

1. EACH recommendation SHALL reference a job requirement id and either evidence ids or an explicit missing-evidence statement.
2. Proposed text SHALL add no number, job keyword, or tech term absent from the resume and confirmations (main Req 7.3), and trust labels SHALL be validated as today (main design §7.4).
3. Skills additions SHALL list only terms the resume or a confirmation already shows (main Req 7.9, main design §7.6).
4. Advice SHALL NOT promise outcomes with an employer's applicant tracking system (main Req 6.2) and SHALL NOT be applied without an explicit accept (main Req 7.6).
5. Eligibility items SHALL get no rewrite advice.

### Requirement 7: Backward compatibility

**User story:** As a user mid-session during a deploy, I want my workspace to keep working.

1. A stored evidence map without `scoringVersion` SHALL be read as version 1, computed with the current formulas.
2. THE five `ScoreSet` fields (`jobMatch`, `evidenceCoverage`, `keywordCoverage`, `parseability`, `interviewReadiness`) SHALL keep their meaning and type.
3. ALL new schema fields SHALL be optional or additive in `packages/shared/src/schemas/` and contracts; no field SHALL be removed or narrowed.
4. THE web app and API SHALL work with each other across one version of skew in either direction (Amplify and CDK deploy separately).
5. THE demo fixture and MSW handlers SHALL be updated in the same change as the schema.
6. Because session data has a 24 h TTL (main design §5), no data migration SHALL be required.

### Requirement 8: Regression tests and human calibration

**User story:** As a developer, I want to change the evaluator and know offline whether it got better or worse.

1. ALL evaluator cases in `services/api/src/eval/samples.ts` SHALL have a recorded, fictional model output so they run offline without Bedrock.
2. EACH case SHALL have golden expected values (per-requirement strengths, job fit, extraction and evidence quality, kept counts), versioned with `scoringVersion`.
3. Property tests (fast-check, `src/test/arbitraries.ts`) SHALL cover determinism, order independence, version stability, monotonicity, and no inflation (for example, adding Skills terms never raises job fit or evidence quality).
4. Adversarial fixtures SHALL cover keyword stuffing, invented quotes, prompt injection inside the resume, and eligibility phrasing.
5. A fictional calibration set SHALL be labeled independently by both developers; agreement SHALL be reported, and thresholds in `EVAL_THRESHOLDS` and `limits.ts` SHALL be justified against it.
6. Live Bedrock runs SHALL happen only with explicit authorization and SHALL be recorded in `docs/analysis-prompt-evaluation.md`.

## Unknowns

- Whether the team wants extraction and evidence quality visible to candidates or only in an explanation panel (product decision).
- The calibration set size and the agreement threshold (to be set in task 9).
- Whether Nova Lite can reliably classify requirement `kind`; measured in task 8 before relying on it.
