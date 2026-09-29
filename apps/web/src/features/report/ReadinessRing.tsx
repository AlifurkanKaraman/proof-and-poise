import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { Report } from '@proof-and-poise/shared';
import { Button } from '../../components/ui/Button';
import { ScoreRing } from '../../components/ui/ScoreRing';
import { cn } from '../../lib/cn';

interface ReadinessRingProps {
  readiness: Report['readiness'];
  className?: string;
}

const LABEL_TONE = {
  emerald: 'text-emerald-700',
  indigo: 'text-indigo-700',
  amber: 'text-amber-700',
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

  return (
    <div className={cn('rounded-lg border border-line-200 bg-paper-0 p-6', className)}>
      <div className="flex flex-col items-center gap-6 md:flex-row">
        <div className="flex shrink-0 flex-col items-center gap-4">
          <ScoreRing value={score} label="" size={160} tone={tone} />
          <div className="text-center">
            <p className="text-h2 font-bold text-ink-950">Interview Readiness</p>
            <p className={cn('text-body font-semibold', LABEL_TONE[tone])}>{label}</p>
          </div>
        </div>

        <div className="flex-1">
          <p className="text-body text-ink-950 leading-relaxed">
            Your readiness combines how you answered in the interview with how well your resume
            matches the role.
          </p>

          <div className="mt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
              aria-controls="readiness-explanation"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="mr-2 size-4" aria-hidden />
                  Hide calculation
                </>
              ) : (
                <>
                  <ChevronDown className="mr-2 size-4" aria-hidden />
                  How is this calculated?
                </>
              )}
            </Button>

            {isExpanded && (
              <div
                id="readiness-explanation"
                className="mt-4 rounded border border-line-200 bg-paper-50 p-4"
              >
                <p className="text-small text-ink-700 leading-relaxed">
                  Interview performance {interviewPerformance}/100 × {performanceWeight * 100}% +
                  job match {jobMatch}/100 × {jobMatchWeight * 100}% = {score}/100.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
