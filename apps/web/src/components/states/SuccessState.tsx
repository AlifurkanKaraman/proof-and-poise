import { CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface SuccessStateProps {
  title: string;
  message?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function SuccessState({ title, message, action, className }: SuccessStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-emerald-700/30 bg-emerald-50 p-6',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700" />
        <h2 className="text-h4 font-semibold text-ink-950">{title}</h2>
      </div>
      {message && <p className="max-w-reading text-small text-ink-700">{message}</p>}
      {action}
    </div>
  );
}
