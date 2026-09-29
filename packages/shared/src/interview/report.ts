/**
 * Pure report assembly (design §6.2, §7.2; Req 12.1–12.3, 12.5). Every number comes from the
 * deterministic scoring functions; the model contributes only the narrative text, which is
 * checked here before it becomes part of the report.
 */
import { LIMITS } from '../limits';
import { novelTerms } from '../grounding/novelTerms';
import type { Importance } from '../schemas/common';
import type { Competency, EvidenceMap } from '../schemas/evidenceMap';
import type { InterviewState } from '../schemas/interview';
import type { ReportNarrativeModelOutput } from '../schemas/modelOutputs';
import type { Report, ReportQuestion } from '../schemas/report';
import { competencyReadiness, interviewReadiness } from '../scoring/interview';
import { READINESS_WEIGHTS, toScore100 } from '../scoring/weights';
import { performanceOf, questionRows } from './advance';
import { gapWeight } from './plan';

const MAX_STRONGEST = 5;
const MAX_WEAKEST = 5;

/** Turns of a primary question, grouped for the report (design §6.2). */
export function reportQuestions(state: InterviewState): ReportQuestion[] {
  return questionRows(state).map(({ primary, originalScore, bestScore }) => ({
    primary,
    followUps: state.turns.filter((t) => t.kind === 'follow_up' && t.parentTurnId === primary.id),
    practiceAttempts: state.turns.filter(
      (t) => t.kind === 'practice' && t.parentTurnId === primary.id && t.evaluation !== undefined,
    ),
    originalScore,
    bestScore,
  }));
}

/** Number of evaluated turns; a change means the stored report no longer matches the state. */
export const evaluatedTurnCount = (state: InterviewState): number =>
  state.turns.filter((t) => t.status === 'evaluated').length;

/** Competencies with a gap, most important first (same weighting as the interview plan). */
export function weakestCompetencies(map: Pick<EvidenceMap, 'competencies'>): Competency[] {
  return map.competencies
    .filter((c) => c.strength === 'weak' || c.strength === 'none')
    .sort((a, b) => gapWeight(b) - gapWeight(a))
    .slice(0, MAX_WEAKEST);
}

/** Keeps the first `max` sentences; the model is asked for 2–4 but can run long. */
export function limitSentences(text: string, max: number): { text: string; count: number } {
  const sentences = text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 0);
  return { text: sentences.slice(0, max).join(' '), count: sentences.length };
}

export type NarrativeCheck =
  { ok: true; narrative: ReportNarrativeModelOutput } | { ok: false; reason: string };

/**
 * Checks model narrative against the evidence map before it is stored:
 * - competency IDs must exist; STAR outlines only for competencies that have evidence;
 * - STAR text may not introduce numbers or terms absent from `sources` (resume, confirmed
 *   statements, and the candidate's own answers). Offending outlines are dropped, and the
 *   narrative is rejected when fewer than the minimum remain;
 * - the summary is trimmed to the maximum sentence count and rejected below the minimum.
 */
export function checkNarrative(
  narrative: ReportNarrativeModelOutput,
  map: Pick<EvidenceMap, 'competencies'>,
  sources: readonly string[],
): NarrativeCheck {
  const byId = new Map(map.competencies.map((c) => [c.id, c]));

  if (narrative.actions.some((a) => !byId.has(a.competencyId))) {
    return { ok: false, reason: 'action_unknown_competency' };
  }

  const outlines = narrative.starOutlines.filter((o) => {
    const c = byId.get(o.competencyId);
    if (!c || c.evidence.length === 0) return false;
    const added = novelTerms(
      [o.title, o.situation, o.task, o.action, o.result].join(' '),
      '',
      sources,
    );
    return added.numbers.length === 0 && added.terms.length === 0;
  });
  if (outlines.length < LIMITS.report.starOutlines.min) {
    return { ok: false, reason: 'star_outlines_ungrounded' };
  }

  const summary = limitSentences(narrative.summary, LIMITS.report.summarySentences.max);
  if (summary.count < LIMITS.report.summarySentences.min) {
    return { ok: false, reason: 'summary_too_short' };
  }

  return {
    ok: true,
    narrative: {
      ...narrative,
      summary: summary.text,
      starOutlines: outlines.slice(0, LIMITS.report.starOutlines.max),
      weakestAreas: narrative.weakestAreas.filter((w) => byId.has(w.competencyId)),
    },
  };
}

/** Assembles the report from computed values plus already-checked narrative text. */
export function buildReport(input: {
  map: EvidenceMap;
  state: InterviewState;
  narrative: ReportNarrativeModelOutput;
  generatedAt: string;
}): Report {
  const { map, state, narrative } = input;
  const importance: Record<string, Importance> = Object.fromEntries(
    map.competencies.map((c) => [c.id, c.importance]),
  );
  const performance = performanceOf(state, importance) ?? 0;
  const questions = reportQuestions(state);

  const bestFor = (competencyId: string): number | null => {
    const scores = questions.flatMap((q) =>
      q.bestScore !== null && q.primary.competencyIds.includes(competencyId) ? [q.bestScore] : [],
    );
    return scores.length > 0 ? Math.max(...scores) : null;
  };

  const reasonFor = new Map(narrative.weakestAreas.map((w) => [w.competencyId, w.reason]));

  return {
    readiness: {
      score: interviewReadiness(performance, map.scores.jobMatch),
      interviewPerformance: toScore100(100 * performance),
      jobMatch: map.scores.jobMatch,
      performanceWeight: READINESS_WEIGHTS.performance,
      jobMatchWeight: READINESS_WEIGHTS.jobMatch,
    },
    summary: narrative.summary,
    competencies: map.competencies.map((c) => {
      const bestScore = bestFor(c.id);
      return {
        competencyId: c.id,
        name: c.name,
        readiness: competencyReadiness(c.strength, bestScore),
        bestScore,
      };
    }),
    questions,
    strongestEvidence: map.competencies
      .filter((c) => c.strength === 'strong')
      .flatMap((c) => {
        const e = c.evidence.find((x) => x.source === 'resume');
        return e
          ? [{ competencyId: c.id, evidenceId: e.id, source: e.source, quote: e.quote }]
          : [];
      })
      .slice(0, MAX_STRONGEST),
    weakestAreas: weakestCompetencies(map).map((c) => ({
      competencyId: c.id,
      reason: reasonFor.get(c.id) ?? c.missingEvidence ?? `Evidence for ${c.name} is limited.`,
    })),
    starOutlines: narrative.starOutlines,
    actions: narrative.actions.map((a, i) => ({ priority: i + 1, ...a })),
    scoreEvents: map.scoreEvents,
    generatedAt: input.generatedAt,
  };
}
