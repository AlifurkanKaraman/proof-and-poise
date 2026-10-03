/**
 * Pure evidence-map updates for recommendation decisions and candidate confirmations
 * (Req 6.4, 7.5–7.6, 8.1–8.5, design §6.3). No I/O: the API loads the map, calls these,
 * validates and saves the result. Inputs are never mutated.
 */
import { LIMITS } from '../limits';
import { validateRecommendation } from '../grounding/labels';
import type { Strength } from '../schemas/common';
import type { Competency, EvidenceMap, Recommendation, ScoreEvent } from '../schemas/evidenceMap';
import { diffScoreSets } from './events';
import { competencyReadiness } from './interview';
import { confirmationStatements, recomputeScores } from './recompute';
import { capStrength } from './strength';
import { STRENGTH_ORDER } from './weights';

export type DecisionKind = 'accept' | 'reject' | 'reset';

const DECISION_STATE = { accept: 'accepted', reject: 'rejected', reset: 'pending' } as const;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** `<prefix><n+1>` where `n` is the highest numeric suffix among `existing` (`ev3` → `ev4`). */
export function nextId(prefix: string, existing: readonly string[]): string {
  let max = 0;
  for (const id of existing) {
    if (!id.startsWith(prefix)) continue;
    const n = Number(id.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}

function scoreEvents(
  map: EvidenceMap,
  before: EvidenceMap['scores'],
  after: EvidenceMap['scores'],
  reason: string,
  sourceRef: string,
  at: string,
): ScoreEvent[] {
  const ids = map.scoreEvents.map((e) => e.id);
  const events: ScoreEvent[] = [];
  return diffScoreSets(before, after, {
    reason,
    sourceRef,
    at,
    makeId: () => {
      const id = nextId('ev', [...ids, ...events.map((e) => e.id)]);
      events.push({ id } as ScoreEvent);
      return id;
    },
  });
}

export type DecisionResult =
  | {
      ok: true;
      map: EvidenceMap;
      recommendation: Recommendation;
      scoreEvent: ScoreEvent | null;
    }
  | { ok: false; error: 'not_found' | 'accept_not_allowed' };

/**
 * Accept, reject, or reset one recommendation. `missing_evidence` recommendations carry no
 * proposed text and can't be accepted (Req 7.4). Only keyword coverage can change; Job Match
 * and Evidence Coverage depend on strengths alone (design §6.3).
 */
export function applyDecision(input: {
  map: EvidenceMap;
  resumeText: string;
  recId: string;
  decision: DecisionKind;
  at: string;
}): DecisionResult {
  const map = clone(input.map);
  const rec = map.recommendations.find((r) => r.id === input.recId);
  if (!rec) return { ok: false, error: 'not_found' };
  if (input.decision === 'accept' && (rec.trustLabel === 'missing_evidence' || !rec.proposedText)) {
    return { ok: false, error: 'accept_not_allowed' };
  }
  rec.decision = DECISION_STATE[input.decision];

  const before = map.scores;
  const { scores, keywords } = recomputeScores(map, input.resumeText);
  map.keywords = keywords;
  map.scores = scores;
  const reason =
    rec.trustLabel === 'rewording_only'
      ? "Rewording improves clarity. It doesn't add evidence."
      : `You ${rec.decision === 'pending' ? 'undid a decision on' : rec.decision} a suggested change.`;
  const events = scoreEvents(map, before, scores, reason, `recommendation:${rec.id}`, input.at);
  map.scoreEvents.push(...events);
  return { ok: true, map, recommendation: rec, scoreEvent: events[0] ?? null };
}

/** The model's proposed rewrite for a confirmation; grounded before use (Req 8.3). */
export interface ConfirmationRewrite {
  originalText: string;
  proposedText: string;
  reason: string;
}

export type ConfirmationResult =
  | {
      ok: true;
      map: EvidenceMap;
      competency: Competency;
      recommendation: Recommendation | undefined;
      scoreEvent: ScoreEvent | null;
    }
  | { ok: false; error: 'not_found' | 'not_eligible' | 'already_confirmed' | 'limit_reached' };

export const confirmedCount = (map: Pick<EvidenceMap, 'competencies'>): number =>
  map.competencies.filter((c) => c.confirmationState === 'confirmed').length;

/** Whether the candidate can still confirm experience for `c`: weak or none, not yet confirmed (Req 8.1). */
export const canConfirm = (c: Pick<Competency, 'strength' | 'confirmationState'>): boolean =>
  c.confirmationState !== 'confirmed' && (c.strength === 'weak' || c.strength === 'none');

const raiseTo = (a: Strength, floor: Strength): Strength =>
  STRENGTH_ORDER.indexOf(a) >= STRENGTH_ORDER.indexOf(floor) ? a : floor;

/**
 * Store a candidate confirmation (Req 8.1–8.5). Only `weak` or `none` competencies qualify,
 * at most 3 per session. The statement becomes `candidate_confirmation` evidence; strength is
 * lifted to `moderate` and never higher (the cap holds until the resume itself shows it).
 * The rewrite becomes the competency's single `confirmed_by_candidate` recommendation only if
 * it passes the same grounding check against the resume plus the statement; otherwise it is
 * dropped and the confirmation still counts.
 */
export function applyConfirmation(input: {
  map: EvidenceMap;
  resumeText: string;
  competencyId: string;
  statement: string;
  rewrite: ConfirmationRewrite | null;
  at: string;
}): ConfirmationResult {
  const map = clone(input.map);
  const competency = map.competencies.find((c) => c.id === input.competencyId);
  if (!competency) return { ok: false, error: 'not_found' };
  if (competency.confirmationState === 'confirmed')
    return { ok: false, error: 'already_confirmed' };
  if (confirmedCount(map) >= LIMITS.confirmation.maxPerSession) {
    return { ok: false, error: 'limit_reached' };
  }
  if (competency.strength !== 'weak' && competency.strength !== 'none') {
    return { ok: false, error: 'not_eligible' };
  }

  const evidenceId = nextId(
    'k',
    map.competencies.flatMap((c) => c.evidence.map((e) => e.id)),
  );
  const statements = [...confirmationStatements(map), input.statement];
  competency.evidence.push({
    id: evidenceId,
    source: 'candidate_confirmation',
    quote: input.statement,
  });
  competency.strength = capStrength(
    raiseTo(competency.strength, 'moderate'),
    competency.evidence,
  ).strength;
  competency.confirmationState = 'confirmed';
  competency.interviewPriority = true;
  competency.readiness = competencyReadiness(competency.strength, null);

  let recommendation: Recommendation | undefined;
  const rewrite = input.rewrite;
  if (rewrite) {
    const check = validateRecommendation(
      {
        trustLabel: 'confirmed_by_candidate',
        originalText: rewrite.originalText,
        proposedText: rewrite.proposedText,
        sourceEvidence: [{ source: 'candidate_confirmation', quote: input.statement }],
      },
      {
        resumeText: input.resumeText,
        confirmations: statements,
        keywords: map.keywords.map((k) => k.term),
      },
    );
    const changed = rewrite.originalText.trim() !== rewrite.proposedText.trim();
    if (check.ok && changed) {
      // Reuse the competency's missing-evidence recommendation: at most one per confirmation.
      const existing = map.recommendations.find(
        (r) => r.competencyId === competency.id && r.trustLabel === 'missing_evidence',
      );
      if (existing) {
        existing.originalText = rewrite.originalText;
        existing.proposedText = rewrite.proposedText;
        existing.reason = rewrite.reason;
        existing.trustLabel = 'confirmed_by_candidate';
        existing.sourceEvidenceIds = [evidenceId];
        existing.decision = 'pending';
        recommendation = existing;
      } else {
        recommendation = {
          id: nextId(
            'r',
            map.recommendations.map((r) => r.id),
          ),
          competencyId: competency.id,
          originalText: rewrite.originalText,
          proposedText: rewrite.proposedText,
          reason: rewrite.reason,
          sourceEvidenceIds: [evidenceId],
          trustLabel: 'confirmed_by_candidate',
          decision: 'pending',
        };
        map.recommendations.push(recommendation);
        competency.recommendationIds.push(recommendation.id);
      }
    }
  }

  const before = map.scores;
  const { scores, keywords } = recomputeScores(map, input.resumeText);
  map.keywords = keywords;
  map.scores = scores;
  const events = scoreEvents(
    map,
    before,
    scores,
    `You confirmed ${competency.name} experience.`,
    `confirmation:${competency.id}`,
    input.at,
  );
  map.scoreEvents.push(...events);
  return {
    ok: true,
    map,
    competency,
    recommendation,
    scoreEvent: events.find((e) => e.metric === 'jobMatch') ?? events[0] ?? null,
  };
}
