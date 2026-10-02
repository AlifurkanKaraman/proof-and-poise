# 02. Originality

## One evidence map, three uses

Most tools treat resume tailoring and interview practice as separate products. Proof & Poise uses one artifact, the Evidence Map (design §1, §4), for all of it:

- Analysis creates it: competencies from the job, each with verbatim resume quotes.
- Recommendations and confirmations change it, and every change records a score event with a reason (design §6.3).
- The interview picks its questions from it. The evidence-gap question targets the competency with the highest `importance × (1 − strength)` (design §7.3).
- The report scores against it.

## The model writes language only

Everything that must be correct is deterministic TypeScript in `packages/shared`, covered by unit and property tests:

| Concern                                                                           | Where                                                              |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Scores (Job Match, Coverage, Keywords, Parseability, Readiness)                   | `packages/shared/src/scoring/`                                     |
| Strength caps (no quote → none; skills-only → weak; confirmation-only → moderate) | `packages/shared/src/scoring/strength.ts`                          |
| Quote grounding and novel-term detection                                          | `packages/shared/src/grounding/`                                   |
| Trust-label validation                                                            | `packages/shared/src/grounding/labels.ts`                          |
| Interview plan and follow-up rule                                                 | `packages/shared/src/interview/`                                   |
| Quotas and limits                                                                 | `packages/shared/src/limits.ts`, `services/api/src/data/quotas.ts` |

Model output from Amazon Bedrock arrives through forced tool use, is validated against strict Zod schemas, and is then grounding-checked. A quote that isn't a normalized substring of the resume is dropped. A recommendation that introduces a number or technology not found in the allowed sources is discarded (design §7.4).

## Truthfulness as a visible feature

- Trust labels are shown on every recommendation, and status is never shown by color alone (Req 14).
- "Rewording only" acceptances never change Job Match. The UI says so: rewording improves clarity, it doesn't add evidence (design §6.3).
- Candidate confirmations are labeled "Confirmed by you" and capped at moderate strength.
- The evaluation prompt is told not to judge accent, fluency, emotion, honesty, or personality, and the output schemas have no fields where such judgments could be stored (design §11).

## Honest about model quality

The analysis prompt is evaluated on fictional cases, including a prompt-injection case, with pass criteria enforced by code. Results vary between runs. See [analysis-prompt-evaluation.md](analysis-prompt-evaluation.md).
