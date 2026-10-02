import type {
  AnalysisStatusResponse,
  ConfirmationResponse,
  DecisionRequest,
  DecisionResponse,
  Recommendation,
  RecommendationDecision,
  ScoreEvent,
} from '@proof-and-poise/shared';

/** Pure cache updates for the analysis query, kept out of the hooks so they're unit-testable. */

const DECISION_STATE: Record<DecisionRequest['decision'], RecommendationDecision> = {
  accept: 'accepted',
  reject: 'rejected',
  reset: 'pending',
};

type Analysis = AnalysisStatusResponse | undefined;

const appendEvent = (events: ScoreEvent[], e: ScoreEvent | null) =>
  e === null || events.some((x) => x.id === e.id) ? events : [...events, e];

const replaceRec = (recs: Recommendation[], rec: Recommendation) =>
  recs.some((r) => r.id === rec.id) ? recs.map((r) => (r.id === rec.id ? rec : r)) : [...recs, rec];

/** Optimistic decision (design §10): flip the recommendation's state before the server answers. */
export function applyOptimisticDecision(
  data: Analysis,
  recId: string,
  decision: DecisionRequest['decision'],
): Analysis {
  if (data?.status !== 'ready') return data;
  const next = DECISION_STATE[decision];
  return {
    ...data,
    evidenceMap: {
      ...data.evidenceMap,
      recommendations: data.evidenceMap.recommendations.map((r) =>
        r.id === recId ? { ...r, decision: next } : r,
      ),
    },
  };
}

/** Merge the server's authoritative decision result (recommendation, scores, event). */
export function mergeDecision(data: Analysis, res: DecisionResponse): Analysis {
  if (data?.status !== 'ready') return data;
  const map = data.evidenceMap;
  return {
    ...data,
    evidenceMap: {
      ...map,
      recommendations: replaceRec(map.recommendations, res.recommendation),
      scores: res.scores,
      scoreEvents: appendEvent(map.scoreEvents, res.scoreEvent),
    },
  };
}

/** Merge a confirmation result: the updated competency, optional recommendation, scores, event. */
export function mergeConfirmation(data: Analysis, res: ConfirmationResponse): Analysis {
  if (data?.status !== 'ready') return data;
  const map = data.evidenceMap;
  return {
    ...data,
    evidenceMap: {
      ...map,
      competencies: map.competencies.map((c) => (c.id === res.competency.id ? res.competency : c)),
      recommendations: res.recommendation
        ? replaceRec(map.recommendations, res.recommendation)
        : map.recommendations,
      scores: res.scores,
      scoreEvents: appendEvent(map.scoreEvents, res.scoreEvent),
    },
  };
}
