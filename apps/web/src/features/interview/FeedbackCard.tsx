import { Award, CheckCircle, Lightbulb, TrendingUp } from 'lucide-react';
import { DIMENSIONS, type Dimension, type Evaluation } from '@proof-and-poise/shared';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';

interface FeedbackCardProps {
  evaluation: Evaluation;
  onContinue: () => void;
  isContinuing?: boolean | undefined;
  /** No next question: the button leads to the report. */
  isLast?: boolean | undefined;
  className?: string;
}

const DIMENSION_LABELS: Record<Dimension, string> = {
  relevance: 'Relevance',
  specificity: 'Specificity',
  evidence: 'Evidence',
  star: 'STAR structure',
  clarity: 'Clarity',
  ownership: 'Ownership',
  roleConnection: 'Role connection',
};

/**
 * Displays feedback after answer submission (Req 11.1, 11.3).
 * Shows 7-dimension scoring with rationales, strength, improvement, and stronger outline.
 */
export function FeedbackCard({
  evaluation,
  onContinue,
  isContinuing,
  isLast,
  className,
}: FeedbackCardProps) {
  // Weighted score is computed deterministically by the server (design §8).
  const averageScore = evaluation.weightedScore;

  const scoreColor = (score: number) => {
    if (score >= 3.5) return 'text-emerald-700';
    if (score >= 2.5) return 'text-indigo-600';
    if (score >= 1.5) return 'text-amber-700';
    return 'text-error-700';
  };

  const scoreBg = (score: number) => {
    if (score >= 3.5) return 'bg-emerald-50';
    if (score >= 2.5) return 'bg-indigo-50';
    if (score >= 1.5) return 'bg-amber-50';
    return 'bg-error-50';
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-6 rounded-lg border border-line-200 bg-paper-0 p-6',
        className,
      )}
    >
      {/* Overall score */}
      <div className="flex items-start gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-indigo-100">
          <Award className="size-8 text-indigo-700" aria-hidden />
        </div>
        <div className="flex-1">
          <p className="text-h3 font-semibold text-ink-950">Answer Feedback</p>
          <p className="mt-1 text-small text-ink-700">
            Average score:{' '}
            <span className={cn('font-semibold', scoreColor(averageScore))}>
              {averageScore.toFixed(1)}/4.0
            </span>
          </p>
        </div>
      </div>

      {/* Strength and Improvement (Req 11.5) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-emerald-700/20 bg-emerald-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle className="size-5 text-emerald-700" aria-hidden />
            <p className="text-small font-semibold text-emerald-900">Strength</p>
          </div>
          <p className="text-small text-emerald-950">{evaluation.strength}</p>
        </div>

        <div className="rounded-lg border border-amber-700/20 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="size-5 text-amber-700" aria-hidden />
            <p className="text-small font-semibold text-amber-900">Improvement</p>
          </div>
          <p className="text-small text-amber-950">{evaluation.improvement}</p>
        </div>
      </div>

      {/* Dimension scores (Req 11.1) */}
      <div>
        <p className="mb-3 text-small font-semibold text-ink-950">Dimension Scores</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {DIMENSIONS.map((key) => {
            const dim = evaluation.dimensions[key];
            const label = DIMENSION_LABELS[key];
            // A null dimension was not applicable to this answer.
            if (dim === null) {
              return (
                <div key={key} className="rounded border border-line-200 p-3">
                  <p className="text-caption font-semibold uppercase tracking-wide text-ink-950">
                    {label}
                  </p>
                  <p className="text-caption text-ink-700">Not assessed for this question.</p>
                </div>
              );
            }
            return (
              <div key={key} className={cn('rounded border p-3', scoreBg(dim.score))}>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-caption font-semibold uppercase tracking-wide text-ink-950">
                    {label}
                  </p>
                  <span className={cn('font-mono text-small font-bold', scoreColor(dim.score))}>
                    {dim.score}/4
                  </span>
                </div>
                <p className="text-caption text-ink-700">{dim.rationale}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stronger outline (Req 11.5) */}
      {evaluation.strongerOutline.length > 0 && (
        <div className="rounded-lg border border-indigo-600/20 bg-indigo-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Lightbulb className="size-5 text-indigo-700" aria-hidden />
            <p className="text-small font-semibold text-indigo-900">Stronger answer outline</p>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-small text-indigo-950">
            {evaluation.strongerOutline.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Continue button */}
      <Button onClick={onContinue} disabled={isContinuing} size="lg" className="w-full">
        {isContinuing ? 'Loading...' : isLast ? 'View your report' : 'Continue to next question'}
      </Button>
    </div>
  );
}
