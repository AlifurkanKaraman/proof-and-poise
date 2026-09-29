import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { Turn } from '@proof-and-poise/shared';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';

interface FeedbackAccordionProps {
  turns: Turn[];
  onPracticeAgain?: (turnId: string) => void;
  className?: string;
}

const DIMENSION_LABELS: Record<string, string> = {
  relevance: 'Relevance',
  specificity: 'Specificity',
  evidence: 'Evidence',
  starStructure: 'STAR Structure',
  clarity: 'Clarity',
  ownership: 'Ownership',
  roleConnection: 'Role Connection',
};

/**
 * Per-question feedback accordions with follow-ups nested (Req 12.1, 12.3).
 * Shows 7-dimension scoring and allows "Practice again" for questions below Proficient.
 */
export function FeedbackAccordion({ turns, onPracticeAgain, className }: FeedbackAccordionProps) {
  const [expandedTurns, setExpandedTurns] = useState<Set<string>>(new Set());

  const toggleTurn = (turnId: string) => {
    setExpandedTurns((prev) => {
      const next = new Set(prev);
      if (next.has(turnId)) {
        next.delete(turnId);
      } else {
        next.add(turnId);
      }
      return next;
    });
  };

  // Group turns by primary question (follow-ups nested under primary)
  const primaryTurns = turns.filter((t) => t.type !== 'follow-up');

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {primaryTurns.map((primary) => {
        const followUps = turns.filter(
          (t) => t.type === 'follow-up' && t.primaryIndex === primary.primaryIndex,
        );
        const isExpanded = expandedTurns.has(primary.id);

        // Calculate if below proficient (average score < 2.5 = below proficient)
        const scores = primary.evaluation
          ? Object.values(primary.evaluation.dimensions).map((d) => d.score)
          : [];
        const avgScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;
        const belowProficient = avgScore < 2.5;

        return (
          <div
            key={primary.id}
            className="rounded-lg border border-line-200 bg-paper-0"
          >
            <button
              onClick={() => toggleTurn(primary.id)}
              className="flex w-full items-center justify-between p-4 text-left hover:bg-paper-50"
              aria-expanded={isExpanded}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-indigo-100 px-2 py-1 text-caption font-semibold text-indigo-700">
                    Question {primary.primaryIndex}
                  </span>
                  <span className="text-caption text-ink-700">
                    {primary.questionType}
                  </span>
                </div>
                <p className="mt-2 text-small text-ink-950">{primary.question}</p>
              </div>
              {isExpanded ? (
                <ChevronUp className="ml-4 size-5 shrink-0 text-ink-700" aria-hidden />
              ) : (
                <ChevronDown className="ml-4 size-5 shrink-0 text-ink-700" aria-hidden />
              )}
            </button>

            {isExpanded && primary.evaluation && (
              <div className="border-t border-line-200 p-4">
                <TurnFeedback
                  turn={primary}
                  belowProficient={belowProficient}
                  onPracticeAgain={onPracticeAgain}
                />

                {/* Follow-ups nested */}
                {followUps.length > 0 && (
                  <div className="mt-6 space-y-4 border-t border-line-200 pt-6">
                    <p className="text-caption font-semibold uppercase tracking-wide text-ink-700">
                      Follow-up Questions
                    </p>
                    {followUps.map((followUp) => (
                      <div key={followUp.id} className="ml-4 border-l-2 border-indigo-600 pl-4">
                        <p className="mb-3 text-small font-semibold text-ink-950">
                          {followUp.question}
                        </p>
                        {followUp.evaluation && (
                          <TurnFeedback
                            turn={followUp}
                            belowProficient={false}
                            onPracticeAgain={undefined}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TurnFeedback({
  turn,
  belowProficient,
  onPracticeAgain,
}: {
  turn: Turn;
  belowProficient: boolean;
  onPracticeAgain?: (turnId: string) => void;
}) {
  if (!turn.evaluation) return null;

  const evaluation = turn.evaluation;

  return (
    <div className="flex flex-col gap-4">
      {/* Answer */}
      <div>
        <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-ink-700">
          Your Answer
        </p>
        <p className="text-small text-ink-700">{turn.text}</p>
      </div>

      {/* Strength and Improvement */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded border border-emerald-700/20 bg-emerald-50 p-3">
          <p className="mb-1 text-caption font-semibold text-emerald-900">Strength</p>
          <p className="text-small text-emerald-950">{evaluation.strength}</p>
        </div>
        <div className="rounded border border-amber-700/20 bg-amber-50 p-3">
          <p className="mb-1 text-caption font-semibold text-amber-900">Improvement</p>
          <p className="text-small text-amber-950">{evaluation.improvement}</p>
        </div>
      </div>

      {/* Dimension scores */}
      <div>
        <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-ink-700">
          Dimension Scores
        </p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {Object.entries(evaluation.dimensions).map(([key, dim]) => (
            <div key={key} className="flex items-center justify-between text-caption">
              <span className="text-ink-700">{DIMENSION_LABELS[key]}</span>
              <span className="font-mono font-semibold text-ink-950">
                {dim.score}/4
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Stronger outline */}
      {evaluation.strongerOutline && (
        <div className="rounded border border-indigo-600/20 bg-indigo-50 p-3">
          <p className="mb-2 text-caption font-semibold text-indigo-900">
            Stronger answer outline
          </p>
          <p className="text-small text-indigo-950 whitespace-pre-line">
            {evaluation.strongerOutline}
          </p>
        </div>
      )}

      {/* Practice again button (Req 12.3) */}
      {belowProficient && onPracticeAgain && (
        <Button
          onClick={() => onPracticeAgain(turn.id)}
          variant="secondary"
          size="sm"
          className="self-start"
        >
          Practice this question again
        </Button>
      )}
    </div>
  );
}
