import {
  ArrowRight,
  FileText,
  Lightbulb,
  MessageSquareText,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react';
import type { Evaluation } from '@proof-and-poise/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { IconTile } from '../../components/ui/IconTile';
import { cn } from '../../lib/cn';
import { DimensionBars } from './DimensionBars';

interface FeedbackCardProps {
  evaluation: Evaluation;
  onContinue: () => void;
  isContinuing?: boolean | undefined;
  /** No next question: the button leads to the report. */
  isLast?: boolean | undefined;
  className?: string;
}

/** A word and an encouraging line for the overall score; the number is always shown too. */
function verdict(score: number): { word: string; line: string } {
  if (score >= 3.5) return { word: 'Strong', line: 'A strong answer. Nicely done.' };
  if (score >= 2.5) return { word: 'Solid', line: 'A solid base. One change would lift it.' };
  if (score >= 1.5)
    return { word: 'Developing', line: 'A good start. Here is how to build on it.' };
  return { word: 'Needs work', line: 'Every first attempt starts here. Use the outline below.' };
}

/**
 * Feedback after an answer (Req 11.1, 11.3, 11.5): overall score, one strength and one
 * improvement, the seven rubric dimensions, and a stronger outline. One primary action.
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
  const { word, line } = verdict(averageScore);

  return (
    <Card tone="raised" padding="lg" className={cn('flex flex-col gap-8', className)}>
      <div className="flex flex-wrap items-center gap-4">
        <IconTile icon={MessageSquareText} size="lg" />
        <div className="min-w-[12rem] flex-1">
          <h2 className="font-heading text-h3 font-semibold text-ink-950">Answer feedback</h2>
          <p className="text-small text-ink-700">{line}</p>
        </div>
        <p className="rounded-full bg-ink-100 px-4 py-2 text-small text-ink-700">
          <span className="font-semibold text-ink-950">{word}</span> ·{' '}
          <span className="font-mono font-bold tabular-nums text-ink-950">
            {averageScore.toFixed(1)}/4.0
          </span>
        </p>
      </div>

      {/* Strength and Improvement (Req 11.5) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card tone="success" padding="md" className="flex gap-3">
          <ThumbsUp className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
          <div>
            <h3 className="text-small font-semibold text-ink-950">Strength</h3>
            <p className="mt-1 text-small text-ink-700">{evaluation.strength}</p>
          </div>
        </Card>
        <Card tone="attention" padding="md" className="flex gap-3">
          <TrendingUp className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <h3 className="text-small font-semibold text-ink-950">Improvement</h3>
            <p className="mt-1 text-small text-ink-700">{evaluation.improvement}</p>
          </div>
        </Card>
      </div>

      {/* Dimension scores (Req 11.1) */}
      <div>
        <h3 className="mb-4 text-small font-semibold text-ink-950">Dimension scores</h3>
        <DimensionBars
          dimensions={evaluation.dimensions}
          naLabel="Not assessed for this question."
          showRationale
        />
      </div>

      {/* Stronger outline (Req 11.5) */}
      {evaluation.strongerOutline.length > 0 && (
        <Card tone="tinted" padding="md">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="size-5 text-indigo-700" aria-hidden="true" />
            <h3 className="text-small font-semibold text-ink-950">A stronger answer could go</h3>
          </div>
          <ol className="list-decimal space-y-1.5 pl-5 text-small text-ink-950 marker:font-semibold marker:text-indigo-700">
            {evaluation.strongerOutline.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </Card>
      )}

      <Button
        onClick={onContinue}
        disabled={isContinuing}
        size="lg"
        className="w-full sm:w-auto sm:self-end"
      >
        {isContinuing ? (
          'Loading...'
        ) : isLast ? (
          <>
            <FileText className="size-5" aria-hidden="true" />
            View your report
          </>
        ) : (
          <>
            Continue to next question
            <ArrowRight className="size-5" aria-hidden="true" />
          </>
        )}
      </Button>
    </Card>
  );
}
