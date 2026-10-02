import { canPracticeAgain, type ReportQuestion, type Turn } from '@proof-and-poise/shared';
import { ChevronDown, Lightbulb, Repeat, ThumbsUp, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { cn, focusRing } from '../../lib/cn';
import { DimensionBars } from '../interview/DimensionBars';

interface FeedbackAccordionProps {
  questions: ReportQuestion[];
  onPracticeAgain?: ((turnId: string) => void) | undefined;
  /** Practice attempts left (LIMITS.quotas.practiceEvaluations); 0 disables the button. */
  practiceRemaining?: number;
  className?: string;
}

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
          <Card key={primary.id} padding="none" className="overflow-hidden">
            <h3>
              <button
                type="button"
                onClick={() => toggle(primary.id)}
                className={cn(
                  'flex min-h-11 w-full items-start justify-between gap-4 p-4 text-left hover:bg-ink-100 sm:p-5',
                  focusRing,
                )}
                aria-expanded={isExpanded}
                aria-controls={panelId}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-caption font-semibold text-indigo-700">
                      Question {primary.label}
                    </span>
                    <span className="text-caption text-ink-700">{KIND_LABELS[primary.kind]}</span>
                    {q.bestScore !== null && (
                      <span className="text-caption font-medium text-ink-950">
                        Best score {q.bestScore.toFixed(1)} / 4
                      </span>
                    )}
                  </span>
                  <span className="mt-2 block text-small text-ink-950">{primary.question}</span>
                </span>
                <ChevronDown
                  className={cn(
                    'mt-1 size-5 shrink-0 text-ink-700 transition-transform duration-micro ease-standard',
                    isExpanded && 'rotate-180',
                  )}
                  aria-hidden="true"
                />
              </button>
            </h3>

            {isExpanded && (
              <div id={panelId} className="border-t border-line-200 p-4 sm:p-5">
                <TurnFeedback turn={primary} />

                {q.followUps.length > 0 && (
                  <NestedTurns title="Follow-up questions" turns={q.followUps} />
                )}
                {q.practiceAttempts.length > 0 && (
                  <NestedTurns title="Practice attempts" turns={q.practiceAttempts} />
                )}

                {offerPractice && onPracticeAgain && (
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Button
                      onClick={() => onPracticeAgain(primary.id)}
                      variant="secondary"
                      size="sm"
                      disabled={practiceRemaining <= 0}
                      aria-describedby={practiceRemaining <= 0 ? `${panelId}-quota` : undefined}
                    >
                      <Repeat className="size-4" aria-hidden="true" />
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
          </Card>
        );
      })}
    </div>
  );
}

function NestedTurns({ title, turns }: { title: string; turns: Turn[] }) {
  return (
    <div className="mt-6 space-y-5 border-t border-line-200 pt-6">
      <p className="text-small font-semibold text-ink-950">{title}</p>
      {turns.map((turn) => (
        <div key={turn.id} className="border-l-2 border-indigo-600 pl-4">
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
    <div className="flex flex-col gap-5">
      {answer && (
        <div>
          <p className="mb-1.5 text-caption font-semibold text-ink-700">Your answer</p>
          <p className="rounded-lg bg-ink-100 p-3 text-small text-ink-950">{answer.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card tone="success" padding="none" className="flex gap-3 p-4">
          <ThumbsUp className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />
          <div>
            <p className="text-caption font-semibold text-ink-950">Strength</p>
            <p className="mt-1 text-small text-ink-700">{evaluation.strength}</p>
          </div>
        </Card>
        <Card tone="attention" padding="none" className="flex gap-3 p-4">
          <TrendingUp className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <p className="text-caption font-semibold text-ink-950">Improvement</p>
            <p className="mt-1 text-small text-ink-700">{evaluation.improvement}</p>
          </div>
        </Card>
      </div>

      <div>
        <p className="mb-3 text-caption font-semibold text-ink-700">Dimension scores</p>
        <DimensionBars dimensions={evaluation.dimensions} naLabel="Not applicable" />
      </div>

      <Card tone="tinted" padding="none" className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Lightbulb className="size-4 text-indigo-700" aria-hidden="true" />
          <p className="text-caption font-semibold text-ink-950">Stronger answer outline</p>
        </div>
        <ul className="list-inside list-disc space-y-1 text-small text-ink-950">
          {evaluation.strongerOutline.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ul>
      </Card>
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
