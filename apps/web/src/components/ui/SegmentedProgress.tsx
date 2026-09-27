import { cn } from '../../lib/cn';

export type SegmentState = 'complete' | 'current' | 'upcoming';

export interface Segment {
  id: string;
  label: string;
  state: SegmentState;
  /** Follow-up sub-steps render narrower and attached to their parent. */
  subStep?: boolean;
}

export interface SegmentedProgressProps {
  segments: Segment[];
  /** Visible summary, e.g. "Question 3 of 5". */
  summary: string;
  className?: string;
}

const stateText: Record<SegmentState, string> = {
  complete: 'completed',
  current: 'current',
  upcoming: 'not started',
};

export function SegmentedProgress({ segments, summary, className }: SegmentedProgressProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <p className="text-small font-medium text-ink-700">{summary}</p>
      <ol aria-label="Interview progress" className="flex items-center gap-1">
        {segments.map((s) => (
          <li
            key={s.id}
            aria-current={s.state === 'current' ? 'step' : undefined}
            className={cn(
              'h-2 rounded-full',
              s.subStep ? 'w-4 flex-none' : 'flex-1',
              s.state === 'complete' && 'bg-emerald-700',
              s.state === 'current' && 'bg-indigo-600',
              s.state === 'upcoming' && 'bg-line-200',
            )}
          >
            <span className="sr-only">
              {s.label}: {stateText[s.state]}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
