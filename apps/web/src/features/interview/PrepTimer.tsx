import { Clock, Pause, Play, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LIMITS } from '@proof-and-poise/shared';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';

interface PrepTimerProps {
  onHide: () => void;
  className?: string;
}

/**
 * Optional 30-second preparation timer (Req 9.3, WCAG 2.2.1), shown as a quiet pill.
 * - Pausable
 * - Hideable
 * - Informational only (never auto-submits)
 */
export function PrepTimer({ onHide, className }: PrepTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(LIMITS.interview.prepTimerSec);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused || secondsLeft === 0) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, secondsLeft]);

  const togglePause = () => {
    setIsPaused((prev) => !prev);
  };

  const isComplete = secondsLeft === 0;

  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center gap-3 self-start rounded-full border py-1 pr-1 pl-4',
        isComplete ? 'border-emerald-100 bg-emerald-50' : 'border-line-200 bg-paper-0 shadow-xs',
        className,
      )}
      role="timer"
      aria-label={`Preparation timer: ${secondsLeft} seconds remaining`}
    >
      <Clock
        className={cn('size-4 shrink-0', isComplete ? 'text-emerald-700' : 'text-indigo-700')}
        aria-hidden="true"
      />
      <p className="text-small font-medium text-ink-700">
        {isComplete ? 'Preparation complete' : 'Preparation time'}
      </p>
      <p
        className={cn(
          'font-mono text-body font-bold tabular-nums',
          isComplete ? 'text-emerald-700' : 'text-ink-950',
        )}
      >
        {isComplete ? '0:00' : `0:${secondsLeft.toString().padStart(2, '0')}`}
      </p>

      <div className="flex items-center">
        {!isComplete && (
          <Button
            variant="ghost"
            size="sm"
            className="min-w-11 rounded-full"
            onClick={togglePause}
            aria-label={isPaused ? 'Resume timer' : 'Pause timer'}
          >
            {isPaused ? (
              <Play className="size-4" aria-hidden="true" />
            ) : (
              <Pause className="size-4" aria-hidden="true" />
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="min-w-11 rounded-full"
          onClick={onHide}
          aria-label="Hide timer"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
