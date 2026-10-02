import { ChevronDown } from 'lucide-react';
import { Collapsible } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn, focusRing } from '../../lib/cn';

export interface DisclosureProps {
  /** Trigger text, e.g. "How is this calculated?" */
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

/** Accessible show/hide region (button with aria-expanded + aria-controls). */
export function Disclosure({ summary, children, defaultOpen = false, className }: DisclosureProps) {
  return (
    <Collapsible.Root defaultOpen={defaultOpen} className={cn('group', className)}>
      <Collapsible.Trigger
        className={cn(
          'inline-flex min-h-11 items-center gap-1 rounded-sm text-small font-medium text-indigo-700 hover:text-indigo-600',
          focusRing,
        )}
      >
        {summary}
        <ChevronDown
          aria-hidden="true"
          className="size-4 transition-transform duration-micro ease-standard group-data-[state=open]:rotate-180"
        />
      </Collapsible.Trigger>
      <Collapsible.Content className="pt-2 text-small text-ink-700">{children}</Collapsible.Content>
    </Collapsible.Root>
  );
}
