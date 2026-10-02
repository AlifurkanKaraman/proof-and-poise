/**
 * Correctness properties 1–6 (design §13).
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validateRecommendation } from './grounding/labels';
import { numericTokens } from './grounding/novelTerms';
import { decideFollowUp } from './interview/followUp';
import { ScoreSetSchema, type Recommendation } from './schemas';
import { parseabilityScore } from './scoring/parseability';
import {
  answerScore,
  interviewPerformance,
  interviewReadiness,
  questionScore,
} from './scoring/interview';
import { buildWorkingResume, recomputeScores } from './scoring/recompute';
import { evidenceCoverageScore, jobMatchScore, keywordCoverageScore } from './scoring/scores';
import { STRENGTH_ORDER } from './scoring/weights';
import {
  candidateFollowUpArb,
  competenciesArb,
  dimensionsArb,
  importanceArb,
  keywordsArb,
  strengthArb,
} from './test/arbitraries';

const isScore = (n: number | null) => n === null || (Number.isInteger(n) && n >= 0 && n <= 100);

describe('Property 1: every score is an integer in [0, 100]', () => {
  /** **Validates: Requirements 6.1, 6.5** */
  it('holds for any valid evidence-map inputs and interview results', () => {
    fc.assert(
      fc.property(
        competenciesArb,
        keywordsArb,
        fc.string({ maxLength: 3000 }),
        fc.array(fc.tuple(dimensionsArb, fc.integer({ min: 0, max: 11 })), { maxLength: 7 }),
        (competencies, keywords, resume, answers) => {
          const importance = new Map(competencies.map((c, i) => [`c${i + 1}`, c.importance]));
          const jobMatch = jobMatchScore(competencies);
          const p = interviewPerformance(
            answers.map(([d, ci]) => ({ score: answerScore(d), competencyIds: [`c${ci + 1}`] })),
            importance,
          );
          const scores = {
            jobMatch,
            evidenceCoverage: evidenceCoverageScore(competencies),
            keywordCoverage: keywordCoverageScore(keywords),
            parseability: parseabilityScore(resume, 'text').score,
            interviewReadiness: p === null ? null : interviewReadiness(p, jobMatch),
          };
          expect(Object.values(scores).every(isScore)).toBe(true);
          expect(ScoreSetSchema.safeParse(scores).success).toBe(true);
        },
      ),
    );
  });
});

describe('Property 2: monotonicity of Job Match and Evidence Coverage', () => {
  /** **Validates: Requirements 6.1** */
  it('raising any competency strength never lowers either score', () => {
    fc.assert(
      fc.property(competenciesArb, fc.nat(), strengthArb, (competencies, pick, raised) => {
        const i = pick % competencies.length;
        const current = competencies[i];
        if (!current) return;
        const higher = STRENGTH_ORDER.indexOf(raised) >= STRENGTH_ORDER.indexOf(current.strength);
        fc.pre(higher);
        const after = competencies.map((c, j) => (j === i ? { ...c, strength: raised } : c));
        expect(jobMatchScore(after)).toBeGreaterThanOrEqual(jobMatchScore(competencies));
        expect(evidenceCoverageScore(after)).toBeGreaterThanOrEqual(
          evidenceCoverageScore(competencies),
        );
      }),
    );
  });
});

describe('Property 3: follow-ups cannot lower a question score', () => {
  /** **Validates: Requirements 6.1, 9.3** */
  it('questionScore(primary, followUp) >= primary', () => {
    fc.assert(
      fc.property(dimensionsArb, dimensionsArb, (primaryDims, followDims) => {
        const primary = answerScore(primaryDims);
        const follow = answerScore(followDims);
        expect(questionScore(primary, follow)).toBeGreaterThanOrEqual(primary);
        expect(questionScore(primary, follow)).toBeGreaterThanOrEqual(questionScore(primary));
      }),
    );
  });
});

// Numeric-ish fragments, including currency and percent forms.
const numberArb = fc.oneof(
  fc.integer({ min: 0, max: 5000 }).map(String),
  fc.integer({ min: 1, max: 99 }).map((n) => `${n}%`),
  fc.integer({ min: 1, max: 999 }).map((n) => `$${n}k`),
  fc.integer({ min: 1, max: 9 }).map((n) => `${n}.5 million`),
);
const wordArb = fc.constantFrom(
  'built',
  'service',
  'the',
  'team',
  'reduced',
  'latency',
  'for',
  'users',
  'api',
);
const phraseArb = fc
  .array(fc.oneof({ weight: 4, arbitrary: wordArb }, { weight: 1, arbitrary: numberArb }), {
    minLength: 3,
    maxLength: 12,
  })
  .map((ws) => ws.join(' '));

describe('Property 4: grounded acceptances add no unsupported numbers', () => {
  /** **Validates: Requirements 7.2, 7.3** */
  it('accepting a recommendation that passed grounding adds no numeric token absent from the sources', () => {
    fc.assert(
      fc.property(
        phraseArb,
        phraseArb,
        phraseArb,
        phraseArb,
        fc.constantFrom('rewording_only', 'verified_from_resume') as fc.Arbitrary<
          Recommendation['trustLabel']
        >,
        (prefix, original, suffix, proposed, trustLabel) => {
          const originalText = `Delivered ${original} across teams`;
          const resumeText = `${prefix}\n${originalText}\n${suffix}`;
          const check = validateRecommendation(
            {
              trustLabel,
              originalText,
              proposedText: proposed,
              sourceEvidence: [{ source: 'resume', quote: resumeText.slice(0, 400) }],
            },
            { resumeText, confirmations: [], keywords: [] },
          );
          if (!check.ok) return;
          const working = buildWorkingResume(resumeText, [
            { id: 'r1', originalText, proposedText: proposed, decision: 'accepted' },
          ]);
          const allowed = new Set(
            numericTokens(resumeText).flatMap((t) => [
              t,
              t.replace(/^[^\d]+/, '').replace(/[^\d.]+$/, ''),
            ]),
          );
          for (const t of numericTokens(working.text)) expect(allowed.has(t)).toBe(true);
        },
      ),
    );
  });
});

describe('Property 5: rewording-only acceptances never change Job Match', () => {
  /** **Validates: Requirements 6.4, 7.5** */
  it('accepting any rewording-only recommendation leaves Job Match unchanged', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ importance: importanceArb, strength: strengthArb }), {
          minLength: 6,
          maxLength: 12,
        }),
        fc.array(phraseArb, { minLength: 1, maxLength: 5 }),
        fc.nat(),
        (comps, lines, pick) => {
          const resumeText = lines.map((l) => `Worked on ${l} daily`).join('\n');
          const competencies = comps.map((c, i) => ({
            ...c,
            id: `c${i + 1}`,
            evidence: [],
          }));
          const recommendations = lines.map((l, i) => ({
            id: `r${i + 1}`,
            originalText: `Worked on ${l} daily`,
            proposedText: `Regularly worked on ${l}`,
            decision: 'pending' as const,
          }));
          const map = {
            competencies,
            keywords: [{ term: 'python', required: true, matched: false }],
            recommendations,
            parseability: { score: 50 },
            scores: { interviewReadiness: null },
          };
          // Cast: recomputeScores only reads the fields provided here.
          const before = recomputeScores(map as never, resumeText).scores.jobMatch;
          const i = pick % recommendations.length;
          const accepted = {
            ...map,
            recommendations: recommendations.map((r, j) =>
              j === i ? { ...r, decision: 'accepted' as const } : r,
            ),
          };
          const after = recomputeScores(accepted as never, resumeText).scores.jobMatch;
          expect(after).toBe(before);
        },
      ),
    );
  });
});

describe('Property 6: 1–2 follow-ups for any sequence of 5 evaluations', () => {
  /** **Validates: Requirements 9.3** */
  it('the follow-up rule always yields between 1 and 2 follow-ups', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(dimensionsArb, candidateFollowUpArb), { minLength: 5, maxLength: 5 }),
        (evals) => {
          let used = 0;
          evals.forEach(([dimensions, candidateFollowUp], i) => {
            const d = decideFollowUp({
              followUpsUsed: used,
              primaryIndex: i + 1,
              dimensions,
              candidateFollowUp,
            });
            if (d.ask) {
              expect(d.text.length).toBeLessThanOrEqual(300);
              used += 1;
            }
          });
          expect(used).toBeGreaterThanOrEqual(1);
          expect(used).toBeLessThanOrEqual(2);
        },
      ),
    );
  });
});
