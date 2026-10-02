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
 * Optional 30-second preparation timer (Req 9.3, WCAG 2.2.1).
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
        'flex items-center gap-4 rounded-lg border p-4',
        isComplete ? 'border-emerald-700/20 bg-emerald-50' : 'border-line-200 bg-paper-0',
        className,
      )}
      role="timer"
      aria-label={`Preparation timer: ${secondsLeft} seconds remaining`}
    >
      <div className="flex items-center gap-3">
        <Clock
          className={cn('size-5', isComplete ? 'text-emerald-700' : 'text-indigo-600')}
          aria-hidden
        />
        <div>
          <p className="text-small font-semibold text-ink-950">
            {isComplete ? 'Preparation complete' : 'Preparation time'}
          </p>
          <p
            className={cn(
              'font-mono text-h2 font-bold tabular-nums',
              isComplete ? 'text-emerald-700' : 'text-ink-950',
            )}
            aria-live="polite"
          >
            {isComplete ? '0:00' : `0:${secondsLeft.toString().padStart(2, '0')}`}
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {!isComplete && (
          <Button
            variant="secondary"
            size="sm"
            className="min-w-11"
            onClick={togglePause}
            aria-label={isPaused ? 'Resume timer' : 'Pause timer'}
          >
            {isPaused ? (
              <Play className="size-4" aria-hidden />
            ) : (
              <Pause className="size-4" aria-hidden />
            )}
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          className="min-w-11"
          onClick={onHide}
          aria-label="Hide timer"
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
