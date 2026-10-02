import { LIMITS } from '../limits';
import type { Importance, Strength } from '../schemas/common';
import { IMPORTANCE_WEIGHT, STRENGTH_VALUE } from '../scoring/weights';

export interface PlanCompetency {
  id: string;
  importance: Importance;
  strength: Strength;
  interviewPriority: boolean;
  confirmationState: 'none' | 'confirmed';
}

export interface CandidateQuestion {
  competencyIds: readonly string[];
  question: string;
}

export type PlannedKind = 'behavioral' | 'role_specific' | 'evidence_gap';

export interface PlannedQuestion {
  /** 1..5 in the order B1, R1, GAP, B2, R2. */
  index: number;
  kind: PlannedKind;
  competencyIds: string[];
  question: string;
}

/** `w × (1 − s)`: how much a competency needs probing. */
export const gapWeight = (c: Pick<PlanCompetency, 'importance' | 'strength'>) =>
  IMPORTANCE_WEIGHT[c.importance] * (1 - STRENGTH_VALUE[c.strength]);

/** Flagged ("Practice this in the interview") or confirmed competencies get a bonus (Req 7.4, 8.5). */
const isPrioritized = (c: PlanCompetency) =>
  c.interviewPriority || c.confirmationState === 'confirmed';

/** Plan priority: `w × (1 − s) + priorityBonus`. */
export const planPriority = (c: PlanCompetency) =>
  gapWeight(c) + (isPrioritized(c) ? LIMITS.interview.priorityBonus : 0);

/**
 * The evidence-gap target: argmax `w × (1 − s)`. Ties go to prioritized competencies,
 * then higher importance, then input order (Req 9.1).
 */
export function selectGapCompetency<C extends PlanCompetency>(competencies: readonly C[]): C {
  let best: C | undefined;
  for (const c of competencies) {
    if (best === undefined) {
      best = c;
      continue;
    }
    const d = gapWeight(c) - gapWeight(best);
    if (d > 1e-9) best = c;
    else if (Math.abs(d) <= 1e-9) {
      const pc = isPrioritized(c) ? 1 : 0;
      const pb = isPrioritized(best) ? 1 : 0;
      if (
        pc > pb ||
        (pc === pb && IMPORTANCE_WEIGHT[c.importance] > IMPORTANCE_WEIGHT[best.importance])
      ) {
        best = c;
      }
    }
  }
  if (best === undefined) throw new Error('selectGapCompetency: no competencies');
  return best;
}

function rankCandidates(
  candidates: readonly CandidateQuestion[],
  byId: ReadonlyMap<string, PlanCompetency>,
  take: number,
): CandidateQuestion[] {
  const scored = candidates.map((q, order) => ({
    q,
    order,
    score: Math.max(
      0,
      ...q.competencyIds.map((id) => {
        const c = byId.get(id);
        return c ? planPriority(c) : 0;
      }),
    ),
  }));
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.slice(0, take).map((s) => s.q);
}

/**
 * Compose the 5-question plan (design §7.3): keep the 2 behavioral and 2 role-specific
 * candidates whose competencies score highest on plan priority, plus the forced
 * evidence-gap question. Order: B1, R1, GAP, B2, R2.
 */
export function selectPlan(input: {
  competencies: readonly PlanCompetency[];
  behavioral: readonly CandidateQuestion[];
  roleSpecific: readonly CandidateQuestion[];
  gap: { competencyId: string; question: string };
}): PlannedQuestion[] {
  const { behavioral: nB, roleSpecific: nR } = LIMITS.interview.selectedQuestions;
  if (input.behavioral.length < nB || input.roleSpecific.length < nR) {
    throw new Error('selectPlan: not enough candidate questions');
  }
  const byId = new Map(input.competencies.map((c) => [c.id, c]));
  const [b1, b2] = rankCandidates(input.behavioral, byId, nB);
  const [r1, r2] = rankCandidates(input.roleSpecific, byId, nR);
  if (!b1 || !b2 || !r1 || !r2) throw new Error('selectPlan: not enough candidate questions');

  const item = (index: number, kind: PlannedKind, q: CandidateQuestion): PlannedQuestion => ({
    index,
    kind,
    competencyIds: [...q.competencyIds],
    question: q.question,
  });
  return [
    item(1, 'behavioral', b1),
    item(2, 'role_specific', r1),
    item(LIMITS.interview.gapPosition, 'evidence_gap', {
      competencyIds: [input.gap.competencyId],
      question: input.gap.question,
    }),
    item(4, 'behavioral', b2),
    item(5, 'role_specific', r2),
  ];
}
