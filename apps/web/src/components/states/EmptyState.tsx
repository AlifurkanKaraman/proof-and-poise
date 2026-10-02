import { Inbox, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-dashed border-line-200 bg-paper-0 px-6 py-12 text-center',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-8 text-ink-700" />
      <h2 className="text-h4 font-semibold text-ink-950">{title}</h2>
      {description && <p className="max-w-reading text-small text-ink-700">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
