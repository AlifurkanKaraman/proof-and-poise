import { cn } from '../../lib/cn';

/** Decorative placeholder block. Wrap groups in an element with aria-busy / a status label. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-line-200 motion-reduce:animate-none', className)}
    />
  );
}
