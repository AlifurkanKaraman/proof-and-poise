import {
  DIMENSIONS,
  canPracticeAgain,
  type Dimension,
  type ReportQuestion,
  type Turn,
} from '@proof-and-poise/shared';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';

interface FeedbackAccordionProps {
  questions: ReportQuestion[];
  onPracticeAgain?: ((turnId: string) => void) | undefined;
  /** Practice attempts left (LIMITS.quotas.practiceEvaluations); 0 disables the button. */
  practiceRemaining?: number;
  className?: string;
}

const DIMENSION_LABELS: Record<Dimension, string> = {
  relevance: 'Relevance',
  specificity: 'Specificity',
  evidence: 'Evidence',
  star: 'STAR structure',
  clarity: 'Clarity',
  ownership: 'Ownership',
  roleConnection: 'Role connection',
};

const KIND_LABELS: Record<Turn['kind'], string> = {
  behavioral: 'Behavioral',
  role_specific: 'Role-specific',
  evidence_gap: 'Evidence gap',
  follow_up: 'Follow-up',
  practice: 'Practice',
};

/**
 * Per-question feedback accordions with follow-ups and practice attempts nested (Req 12.1, 12.3).
 * Shows the 7-dimension rubric and offers "Practice again" below Proficient.
 */
export function FeedbackAccordion({
  questions,
  onPracticeAgain,
  practiceRemaining = Infinity,
  className,
}: FeedbackAccordionProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const printing = usePrinting();

  const toggle = (turnId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(turnId)) next.delete(turnId);
      else next.add(turnId);
      return next;
    });
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {questions.map((q) => {
        const { primary } = q;
        // Collapsed panels aren't rendered, so open every question while printing.
        const isExpanded = printing || expanded.has(primary.id);
        const panelId = `feedback-${primary.id}`;
        const offerPractice = q.bestScore !== null && canPracticeAgain(q.bestScore);

        return (
          <div key={primary.id} className="rounded-lg border border-line-200 bg-paper-0">
            <h3>
              <button
                type="button"
                onClick={() => toggle(primary.id)}
                className="flex min-h-11 w-full items-center justify-between p-4 text-left hover:bg-paper-50"
                aria-expanded={isExpanded}
                aria-controls={panelId}
              >
                <span className="flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-indigo-100 px-2 py-1 text-caption font-semibold text-indigo-700">
                      Question {primary.label}
                    </span>
                    <span className="text-caption text-ink-700">{KIND_LABELS[primary.kind]}</span>
                    {q.bestScore !== null && (
                      <span className="text-caption font-medium text-ink-700">
                        Best score {q.bestScore.toFixed(1)} / 4
                      </span>
                    )}
                  </span>
                  <span className="mt-2 block text-small text-ink-950">{primary.question}</span>
                </span>
                {isExpanded ? (
                  <ChevronUp className="ml-4 size-5 shrink-0 text-ink-700" aria-hidden />
                ) : (
                  <ChevronDown className="ml-4 size-5 shrink-0 text-ink-700" aria-hidden />
                )}
              </button>
            </h3>

            {isExpanded && (
              <div id={panelId} className="border-t border-line-200 p-4">
                <TurnFeedback turn={primary} />

                {q.followUps.length > 0 && (
                  <NestedTurns title="Follow-up questions" turns={q.followUps} />
                )}
                {q.practiceAttempts.length > 0 && (
                  <NestedTurns title="Practice attempts" turns={q.practiceAttempts} />
                )}

                {offerPractice && onPracticeAgain && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      onClick={() => onPracticeAgain(primary.id)}
                      variant="secondary"
                      size="sm"
                      disabled={practiceRemaining <= 0}
                      aria-describedby={practiceRemaining <= 0 ? `${panelId}-quota` : undefined}
                    >
                      Practice this question again
                    </Button>
                    {practiceRemaining <= 0 && (
                      <span id={`${panelId}-quota`} className="text-caption text-ink-700">
                        No practice attempts left in this session.
                      </span>
                    )}
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

function NestedTurns({ title, turns }: { title: string; turns: Turn[] }) {
  return (
    <div className="mt-6 space-y-4 border-t border-line-200 pt-6">
      <p className="text-caption font-semibold uppercase tracking-wide text-ink-700">{title}</p>
      {turns.map((turn) => (
        <div key={turn.id} className="ml-4 border-l-2 border-indigo-600 pl-4">
          <p className="mb-3 text-small font-semibold text-ink-950">{turn.question}</p>
          <TurnFeedback turn={turn} />
        </div>
      ))}
    </div>
  );
}

function TurnFeedback({ turn }: { turn: Turn }) {
  const { evaluation, answer } = turn;
  if (!evaluation) return null;

  return (
    <div className="flex flex-col gap-4">
      {answer && (
        <div>
          <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-ink-700">
            Your answer
          </p>
          <p className="text-small text-ink-700">{answer.text}</p>
        </div>
      )}

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

      <div>
        <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-ink-700">
          Dimension scores
        </p>
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {DIMENSIONS.map((key) => {
            const dim = evaluation.dimensions[key];
            return (
              <li key={key} className="flex items-center justify-between text-caption">
                <span className="text-ink-700">{DIMENSION_LABELS[key]}</span>
                <span className="font-mono font-semibold text-ink-950">
                  {dim ? `${dim.score}/4` : 'Not applicable'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded border border-indigo-600/20 bg-indigo-50 p-3">
        <p className="mb-2 text-caption font-semibold text-indigo-900">Stronger answer outline</p>
        <ul className="list-inside list-disc space-y-1 text-small text-indigo-950">
          {evaluation.strongerOutline.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * True between `beforeprint` and `afterprint` (and while a print media query matches), so
 * printed or saved-as-PDF reports include every question's feedback. `flushSync` renders
 * the expanded content before the browser lays out the print copy.
 */
function usePrinting(): boolean {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const on = () => flushSync(() => setPrinting(true));
    const off = () => setPrinting(false);
    window.addEventListener('beforeprint', on);
    window.addEventListener('afterprint', off);
    const mql = typeof window.matchMedia === 'function' ? window.matchMedia('print') : null;
    const onChange = (e: MediaQueryListEvent) => (e.matches ? on() : off());
    mql?.addEventListener?.('change', onChange);
    return () => {
      window.removeEventListener('beforeprint', on);
      window.removeEventListener('afterprint', off);
      mql?.removeEventListener?.('change', onChange);
    };
  }, []);
  return printing;
}
