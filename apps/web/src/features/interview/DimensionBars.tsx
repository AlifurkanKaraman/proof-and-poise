import { DIMENSIONS, type Dimension, type Evaluation } from '@proof-and-poise/shared';
import { cn } from '../../lib/cn';

export const DIMENSION_LABELS: Record<Dimension, string> = {
  relevance: 'Relevance',
  specificity: 'Specificity',
  evidence: 'Evidence',
  star: 'STAR structure',
  clarity: 'Clarity',
  ownership: 'Ownership',
  roleConnection: 'Role connection',
};

interface DimensionBarsProps {
  dimensions: Evaluation['dimensions'];
  /** Text for a dimension that did not apply to the answer. */
  naLabel: string;
  showRationale?: boolean;
  className?: string;
}

/**
 * The seven rubric dimensions as labelled bars. The score is always written out ("3/4"), so the
 * bar is a visual aid and never the only signal (Req 14.3).
 */
export function DimensionBars({
  dimensions,
  naLabel,
  showRationale = false,
  className,
}: DimensionBarsProps) {
  return (
    <ul className={cn('grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2', className)}>
      {DIMENSIONS.map((key) => {
        const dim = dimensions[key];
        const label = DIMENSION_LABELS[key];
        if (dim === null) {
          return (
            <li key={key} className="flex flex-col gap-1">
              <span className="text-small font-medium text-ink-950">{label}</span>
              <span className="text-caption text-ink-700">{naLabel}</span>
            </li>
          );
        }
        return (
          <li key={key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-small font-medium text-ink-950">{label}</span>
              <span className="font-mono text-small font-semibold tabular-nums text-ink-950">
                {dim.score}/4
              </span>
            </div>
            <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full bg-indigo-600"
                style={{ width: `${Math.max(0, Math.min(100, (dim.score / 4) * 100))}%` }}
              />
            </div>
            {showRationale && <p className="text-caption text-ink-700">{dim.rationale}</p>}
          </li>
        );
      })}
    </ul>
  );
}
