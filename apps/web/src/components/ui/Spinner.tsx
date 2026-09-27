import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

/** Decorative spinner. Pair with text or aria-busy on the parent. */
export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      aria-hidden="true"
      className={cn('size-4 animate-spin motion-reduce:animate-none', className)}
    />
  );
}
