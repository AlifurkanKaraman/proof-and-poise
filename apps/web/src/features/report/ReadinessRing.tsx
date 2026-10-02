import { CheckCircle2, ChevronDown, ChevronUp, Target, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import type { Report } from '@proof-and-poise/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ScoreRing } from '../../components/ui/ScoreRing';
import { cn } from '../../lib/cn';

interface ReadinessRingProps {
  readiness: Report['readiness'];
  className?: string;
}

const LEVELS = {
  emerald: {
    icon: CheckCircle2,
    text: 'text-emerald-700',
    note: 'You answered like someone who is ready. Keep the examples fresh.',
  },
  indigo: {
    icon: TrendingUp,
    text: 'text-indigo-700',
    note: 'You are closer than it may feel. Two or three focused changes will move this.',
  },
  amber: {
    icon: Target,
    text: 'text-amber-700',
    note: 'Not there yet, and that is useful to know today. The steps below show where to start.',
  },
} as const;

/**
 * Readiness score ring with two-term explanation (Req 12.1).
 * Score is 0-100 integer from deterministic scoring functions.
 */
export function ReadinessRing({ readiness, className }: ReadinessRingProps) {
  const { score, interviewPerformance, jobMatch, performanceWeight, jobMatchWeight } = readiness;
  const [isExpanded, setIsExpanded] = useState(false);

  const tone = score >= 75 ? 'emerald' : score >= 50 ? 'indigo' : 'amber';
  const label = score >= 75 ? 'Ready' : score >= 50 ? 'Developing' : 'Needs Practice';
  const level = LEVELS[tone];
  const LevelIcon = level.icon;

  const parts = [
    { name: 'Interview performance', value: interviewPerformance, weight: performanceWeight },
    { name: 'Resume match to the job', value: jobMatch, weight: jobMatchWeight },
  ];

  return (
    <Card tone="raised" padding="lg" className={className}>
      <div className="flex flex-col items-center gap-8 md:flex-row md:items-center">
        <div className="shrink-0">
          <ScoreRing value={score} label="" size={168} tone={tone} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div>
            <p className="font-heading text-h2 font-bold text-ink-950">Interview Readiness</p>
            <p className={cn('mt-1 flex items-center gap-2 text-body font-semibold', level.text)}>
              <LevelIcon className="size-5" aria-hidden="true" />
              <span>{label}</span>
            </p>
            <p className="mt-2 max-w-reading text-body text-ink-700">{level.note}</p>
          </div>

          <ul className="flex flex-col gap-3">
            {parts.map((p) => (
              <li key={p.name} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-small">
                  <span className="font-medium text-ink-950">{p.name}</span>
                  <span className="text-ink-700">
                    <span className="font-mono font-semibold text-ink-950">{p.value}/100</span>
                    {' · '}
                    counts for {Math.round(p.weight * 100)}%
                  </span>
                </div>
                <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-indigo-600"
                    style={{ width: `${Math.max(0, Math.min(100, p.value))}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="print:hidden">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
              aria-controls="readiness-explanation"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="size-4" aria-hidden="true" />
                  Hide calculation
                </>
              ) : (
                <>
                  <ChevronDown className="size-4" aria-hidden="true" />
                  How is this calculated?
                </>
              )}
            </Button>

            {isExpanded && (
              <div
                id="readiness-explanation"
                className="mt-4 rounded-lg border border-line-200 bg-ink-100 p-4"
              >
                <p className="text-small leading-relaxed text-ink-700">
                  Interview performance {interviewPerformance}/100 × {performanceWeight * 100}% +
                  job match {jobMatch}/100 × {jobMatchWeight * 100}% = {score}/100.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
