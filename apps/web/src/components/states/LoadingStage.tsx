import { Check, Circle } from 'lucide-react';
import { useId } from 'react';
import { Spinner } from '../ui/Spinner';
import { cn } from '../../lib/cn';

export interface LoadingStageProps {
  title: string;
  /** Ordered stage labels, e.g. Reading resume → Mapping competencies → … */
  stages: string[];
  /** Zero-based index of the stage in progress. */
  current: number;
  className?: string;
}

/** Staged checklist for long operations (analysis). Announces the current stage politely. */
export function LoadingStage({ title, stages, current, className }: LoadingStageProps) {
  const titleId = useId();
  const currentLabel = stages[current];
  return (
    <section
      aria-busy="true"
      aria-labelledby={titleId}
      className={cn('rounded-lg border border-line-200 bg-paper-0 p-6 shadow-xs', className)}
    >
      <h2 id={titleId} className="text-h4 font-semibold text-ink-950">
        {title}
      </h2>
      <p role="status" className="sr-only">
        {currentLabel ? `${currentLabel}…` : ''}
      </p>
      <ol className="mt-4 flex flex-col gap-3">
        {stages.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={label}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-3 text-small',
                done && 'text-emerald-700',
                active && 'font-medium text-ink-950',
                !done && !active && 'text-ink-700',
              )}
            >
              {done ? (
                <Check aria-hidden="true" className="size-4" />
              ) : active ? (
                <Spinner className="text-indigo-600" />
              ) : (
                <Circle aria-hidden="true" className="size-4" />
              )}
              <span>
                {label}
                {done && <span className="sr-only"> (done)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
