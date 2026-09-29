import { Lightbulb } from 'lucide-react';
import { cn } from '../../lib/cn';

import type { StarOutline } from '@proof-and-poise/shared';

interface STAROutlinesProps {
  outlines: StarOutline[];
  className?: string;
}

/**
 * 2-3 suggested STAR story outlines built from existing evidence (Req 12.1).
 * No invented details - only facts from resume, confirmations, or answers.
 */
export function STAROutlines({ outlines, className }: STAROutlinesProps) {
  if (outlines.length === 0) return null;

  return (
    <div className={cn('rounded-lg border border-line-200 bg-paper-0 p-6', className)}>
      <div className="mb-4 flex items-center gap-2">
        <Lightbulb className="size-5 text-indigo-600" aria-hidden />
        <h2 className="text-h3 font-semibold text-ink-950">STAR Story Outlines</h2>
      </div>

      <p className="mb-6 text-small text-ink-700">
        Use these outlines to structure your interview responses. They're built from your actual
        experience.
      </p>

      <div className="flex flex-col gap-6">
        {outlines.map((outline, idx) => (
          <div
            key={`${outline.competencyId}-${idx}`}
            className="rounded-lg border border-indigo-600/20 bg-indigo-50 p-4"
          >
            <p className="mb-4 text-small font-semibold text-indigo-900">{outline.title}</p>

            <div className="space-y-3">
              <div>
                <p className="text-caption font-semibold uppercase tracking-wide text-indigo-700">
                  Situation
                </p>
                <p className="mt-1 text-small text-indigo-950">{outline.situation}</p>
              </div>

              <div>
                <p className="text-caption font-semibold uppercase tracking-wide text-indigo-700">
                  Task
                </p>
                <p className="mt-1 text-small text-indigo-950">{outline.task}</p>
              </div>

              <div>
                <p className="text-caption font-semibold uppercase tracking-wide text-indigo-700">
                  Action
                </p>
                <p className="mt-1 text-small text-indigo-950">{outline.action}</p>
              </div>

              <div>
                <p className="text-caption font-semibold uppercase tracking-wide text-indigo-700">
                  Result
                </p>
                <p className="mt-1 text-small text-indigo-950">{outline.result}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
