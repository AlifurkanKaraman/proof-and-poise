import type { ScoreEvent, ScoreMetric } from '@proof-and-poise/shared';
import type { ToastOptions } from '../../components/ui/Toast';

export const METRIC_LABELS: Record<ScoreMetric, string> = {
  jobMatch: 'Job match',
  evidenceCoverage: 'Evidence coverage',
  keywordCoverage: 'Keyword match',
  parseability: 'Parseability',
  interviewReadiness: 'Interview readiness',
};

/** Every score change is shown with its reason (design §10, Req 7.5). */
export function scoreToast(event: ScoreEvent | null, fallback: string): ToastOptions {
  if (event === null) {
    return { title: fallback, description: 'Your scores did not change.', tone: 'success' };
  }
  const label = METRIC_LABELS[event.metric];
  const after = event.after ?? '–';
  const title =
    event.before === null ? `${label}: ${after}` : `${label}: ${event.before} → ${after}`;
  return { title, description: event.reason, tone: 'success' };
}
