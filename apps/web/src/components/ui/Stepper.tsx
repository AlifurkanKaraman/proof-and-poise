import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface StepperProps {
  steps: string[];
  /** Zero-based index of the current step. */
  current: number;
  className?: string;
}

export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <nav aria-label="Setup progress" className={className}>
      <ol className="flex flex-wrap items-center gap-3 sm:gap-6">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={label}
              aria-current={active ? 'step' : undefined}
              className="flex items-center gap-2"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-8 items-center justify-center rounded-full border text-small font-semibold',
                  done && 'border-emerald-700 bg-emerald-700 text-paper-0',
                  active && 'border-indigo-600 bg-indigo-600 text-paper-0',
                  !done && !active && 'border-line-200 bg-paper-0 text-ink-700',
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className={cn('text-small', active ? 'font-semibold text-ink-950' : 'text-ink-700')}
              >
                <span className="sr-only">
                  Step {i + 1} of {steps.length}:{' '}
                </span>
                {label}
                {done && <span className="sr-only"> (completed)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
