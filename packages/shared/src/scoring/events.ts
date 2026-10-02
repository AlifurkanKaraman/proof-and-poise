import type { ScoreEvent, ScoreMetric, ScoreSet } from '../schemas/evidenceMap';

export interface ScoreEventInput {
  id: string;
  metric: ScoreMetric;
  before: number | null;
  after: number | null;
  reason: string;
  sourceRef: string;
  at: string;
}

/** Create a score event, or null when the metric didn't change (design §6.3). */
export function createScoreEvent(input: ScoreEventInput): ScoreEvent | null {
  if (input.before === input.after) return null;
  return { ...input };
}

const METRICS: readonly ScoreMetric[] = [
  'jobMatch',
  'evidenceCoverage',
  'keywordCoverage',
  'parseability',
  'interviewReadiness',
];

/**
 * One score event per changed metric between two score sets.
 * `makeId` receives the metric so IDs stay unique within a change.
 */
export function diffScoreSets(
  before: ScoreSet,
  after: ScoreSet,
  ctx: { reason: string; sourceRef: string; at: string; makeId: (metric: ScoreMetric) => string },
): ScoreEvent[] {
  const events: ScoreEvent[] = [];
  for (const metric of METRICS) {
    const e = createScoreEvent({
      id: ctx.makeId(metric),
      metric,
      before: before[metric],
      after: after[metric],
      reason: ctx.reason,
      sourceRef: ctx.sourceRef,
      at: ctx.at,
    });
    if (e) events.push(e);
  }
  return events;
}

const METRIC_LABEL: Record<ScoreMetric, string> = {
  jobMatch: 'Job Match',
  evidenceCoverage: 'Evidence Coverage',
  keywordCoverage: 'Keyword Coverage',
  parseability: 'Resume Parseability',
  interviewReadiness: 'Interview Readiness',
};

/** Inline change text, e.g. "+6 Job Match: you confirmed Kubernetes experience." (Req 6.4). */
export function formatScoreEvent(
  e: Pick<ScoreEvent, 'metric' | 'before' | 'after' | 'reason'>,
): string {
  const label = METRIC_LABEL[e.metric];
  if (e.before === null || e.after === null) return `${label}: ${e.reason}`;
  const delta = e.after - e.before;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta} ${label}: ${e.reason}`;
}
