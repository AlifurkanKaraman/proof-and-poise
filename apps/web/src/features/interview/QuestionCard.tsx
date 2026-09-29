import { MessageCircle } from 'lucide-react';
import type { Turn } from '@proof-and-poise/shared';
import { cn } from '../../lib/cn';

interface QuestionCardProps {
  turn: Turn;
  className?: string;
}

/**
 * Displays the current interview question with its type and competency label (Req 9.1, 9.2).
 */
export function QuestionCard({ turn, className }: QuestionCardProps) {
  const isFollowUp = turn.type === 'follow-up';
  const label = isFollowUp ? 'Follow-up' : turn.questionType;

  return (
    <div
      className={cn(
        'rounded-lg border border-line-200 bg-paper-0 p-6',
        className,
      )}
      role="region"
      aria-label="Interview question"
    >
      <div className="mb-4 flex items-start gap-3">
        <MessageCircle className="size-5 shrink-0 text-indigo-600" aria-hidden />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-indigo-100 px-2 py-1 text-caption font-semibold text-indigo-700">
              {label}
            </span>
            {turn.competencyLabel && (
              <span className="text-caption text-ink-700">
                · {turn.competencyLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="text-body text-ink-950 leading-relaxed">
        {turn.question}
      </p>

      {isFollowUp && (
        <p className="mt-3 text-small italic text-ink-700">
          This question builds on your previous answer.
        </p>
      )}
    </div>
  );
}
