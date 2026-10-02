import { describe, expect, it } from 'vitest';
import { AnalysisStatusResponseSchema } from '../../contracts/routes';
import { validateRecommendation } from '../../grounding/labels';
import { isEmptyNovelTerms, novelTerms } from '../../grounding/novelTerms';
import { filterGroundedEvidence, isGroundedQuote } from '../../grounding/quotes';
import { decideFollowUp, FOLLOW_UP_TRIGGER_DIMENSIONS } from '../../interview/followUp';
import { selectGapCompetency } from '../../interview/plan';
import { LIMITS } from '../../limits';
import { EvidenceMapSchema } from '../../schemas/evidenceMap';
import {
  AnalysisRequestSchema,
  AnswerRequestSchema,
  ConfirmationRequestSchema,
} from '../../schemas/inputs';
import { EvaluationSchema, TurnSchema } from '../../schemas/interview';
import {
  EvaluationModelOutputSchema,
  GenerateQuestionsModelOutputSchema,
} from '../../schemas/modelOutputs';
import { answerScore, competencyReadiness } from '../../scoring/interview';
import { parseabilityScore } from '../../scoring/parseability';
import { recomputeScores } from '../../scoring/recompute';
import { capStrength } from '../../scoring/strength';
import {
  DEMO_DESIGNED_SPREAD,
  DEMO_EVIDENCE_MAP,
  DEMO_INTERVIEW_PLAN,
  DEMO_JOB,
  DEMO_LABELS,
  DEMO_PROPOSED_STRENGTHS,
  DEMO_QUESTION_CANDIDATES,
  DEMO_RESUME_INPUT,
  DEMO_RESUME_TEXT,
  DEMO_SAMPLE_ANSWERS,
  DEMO_SAMPLE_CONFIRMATION,
  DEMO_SAMPLE_FEEDBACK,
  DEMO_SAMPLE_FEEDBACK_OUTPUT,
  DEMO_SAMPLE_FOLLOW_UP,
  DEMO_VAGUE_ANSWER_LABEL,
  type DemoTurnLabel,
} from './index';

const map = DEMO_EVIDENCE_MAP;
const LABELS = Object.keys(DEMO_SAMPLE_ANSWERS) as DemoTurnLabel[];
type PrimaryLabel = Exclude<DemoTurnLabel, '1a'>;
const keywordTerms = map.keywords.map((k) => k.term);

const byId = (id: string) => {
  const c = map.competencies.find((x) => x.id === id);
  if (!c) throw new Error(`missing competency ${id}`);
  return c;
};

describe('demo inputs (Req 13.1)', () => {
  it('pass the production setup schema and length limits', () => {
    expect(
      AnalysisRequestSchema.safeParse({ resume: DEMO_RESUME_INPUT, job: DEMO_JOB }).success,
    ).toBe(true);
    expect(DEMO_RESUME_TEXT.length).toBeGreaterThanOrEqual(LIMITS.resumeText.min);
    expect(DEMO_RESUME_TEXT.length).toBeLessThanOrEqual(LIMITS.resumeText.max);
    expect(DEMO_JOB.description.length).toBeGreaterThanOrEqual(LIMITS.jobText.min);
    expect(DEMO_JOB.description.length).toBeLessThanOrEqual(LIMITS.jobText.max);
  });

  it('are labeled fictional and use only placeholder contact details', () => {
    expect(DEMO_RESUME_TEXT).toContain('Amara Okonkwo (fictional)');
    expect(DEMO_JOB.company).toBe('Northwind Cloud (fictional company)');
    const all = [DEMO_RESUME_TEXT, DEMO_JOB.description, ...Object.values(DEMO_SAMPLE_ANSWERS)];
    for (const text of all) {
      for (const [email] of text.matchAll(/[\w.+-]+@[\w.-]+/g)) {
        expect(email).toMatch(/@example\.com$/);
      }
      expect(text).not.toMatch(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/);
      expect(text).not.toMatch(/https?:\/\//);
    }
  });
});

describe('precomputed evidence map (Req 13.2)', () => {
  it('passes the production evidence map and analysis response schemas', () => {
    expect(EvidenceMapSchema.parse(map)).toEqual(map);
    const ready = AnalysisStatusResponseSchema.safeParse({
      status: 'ready',
      evidenceMap: map,
      resumeText: DEMO_RESUME_TEXT,
      truncated: false,
      precomputed: true,
    });
    expect(ready.success).toBe(true);
    expect(map.recommendations.length).toBeLessThanOrEqual(LIMITS.analysis.recommendations.max);
  });

  it('has only grounded resume quotes (design §7.4)', () => {
    for (const c of map.competencies) {
      expect(filterGroundedEvidence(c.evidence, DEMO_RESUME_TEXT).discarded).toBe(0);
      for (const e of c.evidence) {
        expect(e.source).toBe('resume');
        expect(isGroundedQuote(e.quote, [DEMO_RESUME_TEXT]), e.quote).toBe(true);
      }
    }
    const ids = map.competencies.flatMap((c) => c.evidence.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('matches the designed spread, with strengths that respect the §6.1 caps', () => {
    for (const c of map.competencies) {
      expect(c.strength, c.id).toBe(DEMO_DESIGNED_SPREAD[c.id]);
      const proposed = DEMO_PROPOSED_STRENGTHS[c.id];
      if (proposed === undefined) throw new Error(`no proposed strength for ${c.id}`);
      expect(capStrength(proposed, c.evidence).strength).toBe(c.strength);
      // Stable under re-capping: stored strengths are already capped.
      expect(capStrength(c.strength, c.evidence).strength).toBe(c.strength);
      expect(c.readiness).toBe(competencyReadiness(c.strength, null));
    }
    // IaC is listed in Skills only: the model's `moderate` is capped to `weak`.
    const iac = byId('c6');
    expect(capStrength(DEMO_PROPOSED_STRENGTHS.c6 ?? 'none', iac.evidence).cap).toBe('skills_only');
    expect(byId('c8').evidence).toHaveLength(0);
  });

  it('stores scores, keyword matches, and parseability equal to the shared functions', () => {
    const recomputed = recomputeScores(map, DEMO_RESUME_TEXT);
    expect(recomputed.scores).toEqual(map.scores);
    expect(recomputed.keywords).toEqual(map.keywords);
    expect(map.parseability).toEqual(parseabilityScore(DEMO_RESUME_TEXT, 'text'));
    expect(map.parseability.score).toBe(100);
    expect(map.scores.interviewReadiness).toBeNull();
    const k8s = map.keywords.find((k) => k.term === 'Kubernetes');
    expect(k8s).toMatchObject({ required: true, matched: false });
  });
});

describe('demo recommendations (design §7.4, §15)', () => {
  const ctx = { resumeText: DEMO_RESUME_TEXT, confirmations: [], keywords: keywordTerms };

  it('includes one rewording, one verified-from-resume, and one missing-evidence card', () => {
    expect(map.recommendations.map((r) => r.trustLabel).sort()).toEqual([
      'missing_evidence',
      'rewording_only',
      'verified_from_resume',
    ]);
  });

  it('pass grounding, novel-term, and trust-label validation', () => {
    for (const r of map.recommendations) {
      const competency = byId(r.competencyId);
      expect(competency.recommendationIds).toContain(r.id);
      const sourceEvidence = r.sourceEvidenceIds.map((id) => {
        const e = competency.evidence.find((x) => x.id === id);
        if (!e) throw new Error(`${r.id} cites unknown evidence ${id}`);
        return e;
      });
      expect(validateRecommendation({ ...r, sourceEvidence }, ctx), r.id).toEqual({ ok: true });
      if (r.proposedText !== null) {
        const novel = novelTerms(r.proposedText, r.originalText, [DEMO_RESUME_TEXT], {
          keywords: keywordTerms,
        });
        expect(isEmptyNovelTerms(novel), r.id).toBe(true);
      }
    }
  });

  it('never changes Job Match when accepted (design §6.3)', () => {
    const accepted = {
      ...map,
      recommendations: map.recommendations.map((r) => ({ ...r, decision: 'accepted' as const })),
    };
    const { scores, workingResume } = recomputeScores(accepted, DEMO_RESUME_TEXT);
    expect(scores.jobMatch).toBe(map.scores.jobMatch);
    expect(scores.evidenceCoverage).toBe(map.scores.evidenceCoverage);
    expect(workingResume.applied).toEqual(['r1', 'r2']);
    expect(workingResume.unapplied).toEqual([]);
  });

  it('supports a truthful confirmation for the missing Kubernetes evidence', () => {
    expect(ConfirmationRequestSchema.safeParse(DEMO_SAMPLE_CONFIRMATION).success).toBe(true);
    const k8s = byId(DEMO_SAMPLE_CONFIRMATION.competencyId);
    const evidence = [
      ...k8s.evidence,
      {
        id: 'cf1',
        source: 'candidate_confirmation' as const,
        quote: DEMO_SAMPLE_CONFIRMATION.statement,
      },
    ];
    // Confirmation only: at most moderate (Req 8.2).
    expect(capStrength('strong', evidence).strength).toBe('moderate');
    const confirmed = {
      ...map,
      competencies: map.competencies.map((c) =>
        c.id === k8s.id ? { ...c, evidence, strength: 'moderate' as const } : c,
      ),
    };
    const after = recomputeScores(confirmed, DEMO_RESUME_TEXT);
    expect(after.keywords.find((k) => k.term === 'Kubernetes')?.matched).toBe(true);
    expect(after.scores.jobMatch).toBeGreaterThan(map.scores.jobMatch);
    expect(after.scores.keywordCoverage).toBeGreaterThan(map.scores.keywordCoverage);
  });
});

describe('demo interview (Req 13.3, design §7.3)', () => {
  it('uses schema-valid candidates, with the gap question on argmax w × (1 − s)', () => {
    expect(GenerateQuestionsModelOutputSchema.safeParse(DEMO_QUESTION_CANDIDATES).success).toBe(
      true,
    );
    expect(DEMO_QUESTION_CANDIDATES.evidenceGap.competencyId).toBe(
      selectGapCompetency(map.competencies).id,
    );
    expect(DEMO_INTERVIEW_PLAN.map((q) => [q.kind, q.competencyIds[0]])).toEqual([
      ['behavioral', 'c7'],
      ['role_specific', 'c6'],
      ['evidence_gap', 'c8'],
      ['behavioral', 'c5'],
      ['role_specific', 'c4'],
    ]);
  });

  it('has a valid sample answer for every question', () => {
    for (const label of LABELS) {
      const parsed = AnswerRequestSchema.safeParse({
        text: DEMO_SAMPLE_ANSWERS[label],
        source: 'typed',
        edited: false,
      });
      expect(parsed.success, label).toBe(true);
    }
  });

  it('builds schema-valid evaluated turns from the plan, answers, and sample feedback', () => {
    for (const q of DEMO_INTERVIEW_PLAN) {
      const label = String(q.index) as PrimaryLabel;
      const turn = {
        id: `t${q.index}`,
        index: q.index,
        label,
        kind: q.kind,
        competencyIds: q.competencyIds,
        question: q.question,
        answer: { text: DEMO_SAMPLE_ANSWERS[label], source: 'typed', edited: false },
        evaluation: DEMO_SAMPLE_FEEDBACK[label],
        status: 'evaluated',
      };
      expect(TurnSchema.safeParse(turn).success, label).toBe(true);
    }
  });

  it('the vague sample answer triggers a follow-up; the rest do not', () => {
    let followUpsUsed = 0;
    const asked: string[] = [];
    for (const q of DEMO_INTERVIEW_PLAN) {
      const label = String(q.index) as PrimaryLabel;
      const evaluation = DEMO_SAMPLE_FEEDBACK[label];
      const decision = decideFollowUp({
        followUpsUsed,
        primaryIndex: q.index,
        dimensions: evaluation.dimensions,
        candidateFollowUp: evaluation.candidateFollowUp,
      });
      if (label === DEMO_VAGUE_ANSWER_LABEL) {
        expect(decision).toEqual({
          ask: true,
          text: DEMO_SAMPLE_FOLLOW_UP,
          reason: 'weak_dimensions',
        });
      } else {
        expect(decision.ask, label).toBe(false);
        for (const dim of FOLLOW_UP_TRIGGER_DIMENSIONS) {
          expect(evaluation.dimensions[dim]?.score ?? 4).toBeGreaterThan(2);
        }
      }
      if (decision.ask) {
        followUpsUsed += 1;
        asked.push(label);
      }
    }
    expect(asked).toEqual([DEMO_VAGUE_ANSWER_LABEL]);
    expect(DEMO_SAMPLE_FOLLOW_UP.length).toBeLessThanOrEqual(LIMITS.interview.followUpMaxChars);
  });
});

describe('offline sample feedback (Req 13.4)', () => {
  it('passes the model-output and stored evaluation schemas and is labeled as sample', () => {
    expect(DEMO_LABELS.sampleFeedback).toBe('Sample feedback (live AI unavailable)');
    for (const label of LABELS) {
      expect(
        EvaluationModelOutputSchema.safeParse(DEMO_SAMPLE_FEEDBACK_OUTPUT[label]).success,
      ).toBe(true);
      const evaluation = DEMO_SAMPLE_FEEDBACK[label];
      expect(EvaluationSchema.safeParse(evaluation).success, label).toBe(true);
      expect(evaluation.feedbackSource).toBe('sample');
      expect(evaluation.weightedScore).toBe(answerScore(evaluation.dimensions));
    }
  });

  it('scores STAR only on behavioral questions', () => {
    for (const q of DEMO_INTERVIEW_PLAN) {
      const label = String(q.index) as PrimaryLabel;
      const star = DEMO_SAMPLE_FEEDBACK[label].dimensions.star;
      expect(star === null, label).toBe(q.kind !== 'behavioral');
    }
  });
});
