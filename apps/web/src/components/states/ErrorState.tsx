import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface ErrorStateProps {
  title: string;
  message?: ReactNode;
  /** Required recovery action (Retry, Go back, Use text instead) — Req 14.2. */
  action: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}

export function ErrorState({
  title,
  message,
  action,
  secondaryAction,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-red-700/30 bg-red-50 p-6',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-700" />
        <h2 className="text-h4 font-semibold text-ink-950">{title}</h2>
      </div>
      {message && <p className="max-w-reading text-small text-ink-700">{message}</p>}
      <div className="flex flex-wrap gap-3">
        {action}
        {secondaryAction}
      </div>
    </div>
  );
}
