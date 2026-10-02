import { ListChecks } from 'lucide-react';
import type { PrioritizedAction } from '@proof-and-poise/shared';
import { Card } from '../../components/ui/Card';
import { IconTile } from '../../components/ui/IconTile';
import { cn } from '../../lib/cn';

interface PrioritizedActionsProps {
  actions: PrioritizedAction[];
  /** competencyId → display name. */
  competencyNames: Record<string, string>;
  className?: string;
}

/**
 * Exactly three prioritized actions (Req 12.1, 12.2) as a numbered sequence: do the first one
 * first. Each references a competency and a concrete next step.
 */
export function PrioritizedActions({
  actions,
  competencyNames,
  className,
}: PrioritizedActionsProps) {
  return (
    <Card tone="tinted" padding="lg" className={className}>
      <div className="mb-2 flex items-center gap-3">
        <IconTile icon={ListChecks} tone="indigo" />
        <h2 className="font-heading text-h3 font-semibold text-ink-950">Next Steps</h2>
      </div>

      <p className="mb-6 max-w-reading text-small text-ink-700">
        Do these in order. The first one will move your score the most.
      </p>

      <ol className="flex flex-col">
        {[...actions]
          .sort((a, b) => a.priority - b.priority)
          .map((action, idx, all) => (
            <li key={action.priority} className="flex items-stretch gap-4">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-small font-bold text-paper-0"
                >
                  {idx + 1}
                </span>
                {idx < all.length - 1 && <span className="my-1 w-px flex-1 bg-indigo-100" />}
              </div>
              <div className={cn('min-w-0 flex-1', idx < all.length - 1 && 'pb-6')}>
                <p className="text-small font-semibold text-ink-950">
                  <span className="sr-only">Step {idx + 1}: </span>
                  {competencyNames[action.competencyId] ?? action.competencyId}
                </p>
                <p className="mt-1 text-small text-ink-700">{action.step}</p>
              </div>
            </li>
          ))}
      </ol>
    </Card>
  );
}
