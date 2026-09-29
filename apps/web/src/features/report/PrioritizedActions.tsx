import { ArrowRight, Target } from 'lucide-react';
import { cn } from '../../lib/cn';

interface Action {
  competency: string;
  action: string;
}

interface PrioritizedActionsProps {
  actions: [Action, Action, Action];
  className?: string;
}

/**
 * Exactly three prioritized actions (Req 12.1, 12.2).
 * Each references a competency and a concrete next step.
 */
export function PrioritizedActions({ actions, className }: PrioritizedActionsProps) {
  return (
    <div className={cn('rounded-lg border border-line-200 bg-paper-0 p-6', className)}>
      <div className="mb-4 flex items-center gap-2">
        <Target className="size-5 text-indigo-600" aria-hidden />
        <h2 className="text-h3 font-semibold text-ink-950">Next Steps</h2>
      </div>

      <p className="mb-6 text-small text-ink-700">
        Focus on these three actions to improve your interview readiness.
      </p>

      <div className="flex flex-col gap-4">
        {actions.map((action, idx) => (
          <div
            key={idx}
            className="flex items-start gap-4 rounded-lg border border-line-200 bg-paper-50 p-4"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-100">
              <span className="text-small font-bold text-indigo-700">{idx + 1}</span>
            </div>

            <div className="flex-1">
              <p className="text-small font-semibold text-ink-950">{action.competency}</p>
              <div className="mt-2 flex items-start gap-2">
                <ArrowRight className="mt-0.5 size-4 shrink-0 text-indigo-600" aria-hidden />
                <p className="text-small text-ink-700">{action.action}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
