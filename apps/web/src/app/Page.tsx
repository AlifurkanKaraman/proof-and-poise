import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/** Standard page container with a single h1. */
export function Page({
  title,
  lead,
  children,
  className,
}: {
  title: string;
  lead?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto flex max-w-content flex-col gap-6 px-4 py-12 sm:px-6', className)}>
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 font-bold text-ink-950">{title}</h1>
        {lead && <p className="max-w-reading text-body text-ink-700">{lead}</p>}
      </header>
      {children}
    </div>
  );
}
