import { Check, ClipboardCheck, FileText, MessagesSquare, SearchCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, matchPath, useLocation } from 'react-router';
import { cn, focusRing } from '../lib/cn';

interface Stage {
  key: 'prepare' | 'analysis' | 'interview' | 'report';
  label: string;
  icon: LucideIcon;
}

const STAGES: readonly Stage[] = [
  { key: 'prepare', label: 'Prepare', icon: FileText },
  { key: 'analysis', label: 'Analysis', icon: SearchCheck },
  { key: 'interview', label: 'Interview', icon: MessagesSquare },
  { key: 'report', label: 'Report', icon: ClipboardCheck },
];

/** Where the person is in the journey, derived from the URL (design §10). */
export function useJourney(): { current: number; sessionId: string | null } | null {
  const { pathname } = useLocation();
  if (matchPath('/prepare', pathname)) return { current: 0, sessionId: null };
  const m = matchPath('/s/:id/:stage', pathname);
  const id = m?.params.id;
  const idx = STAGES.findIndex((s) => s.key === m?.params.stage);
  if (!id || idx < 0) return null;
  return { current: idx, sessionId: id };
}

/**
 * Always-visible four-step progress for the session flow, so a candidate knows where they are
 * and what comes next. Finished steps link back; later steps are plain text (Req 14).
 */
export function JourneyNav() {
  const journey = useJourney();
  if (!journey) return null;
  const { current, sessionId } = journey;

  return (
    <div className="border-b border-line-200 bg-paper-0">
      <nav aria-label="Progress" className="mx-auto max-w-content px-4 sm:px-6">
        <ol className="flex items-center gap-1 py-2 sm:gap-2">
          {STAGES.map((stage, i) => {
            const done = i < current;
            const active = i === current;
            const Icon = stage.icon;
            const body = (
              <>
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full',
                    done && 'bg-emerald-100 text-emerald-700',
                    active && 'bg-indigo-600 text-paper-0',
                    !done && !active && 'bg-ink-100 text-ink-700',
                  )}
                >
                  {done ? (
                    <Check className="size-4" strokeWidth={2.25} />
                  ) : (
                    <Icon className="size-4" strokeWidth={1.75} />
                  )}
                </span>
                <span className={cn('hidden sm:inline', active && 'font-semibold text-ink-950')}>
                  {stage.label}
                </span>
                <span className="sr-only sm:hidden">{stage.label}</span>
                {done && <span className="sr-only"> (completed)</span>}
                {active && <span className="sr-only"> (current step)</span>}
              </>
            );
            const itemClass = cn(
              'inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-small',
              active ? 'text-ink-950' : 'text-ink-700',
            );
            const target = done && sessionId ? `/s/${sessionId}/${stage.key}` : null;
            return (
              <li
                key={stage.key}
                aria-current={active ? 'step' : undefined}
                className="flex min-w-0 flex-1 items-center gap-1 sm:flex-none sm:gap-2"
              >
                {target ? (
                  <Link to={target} className={cn(itemClass, 'hover:bg-ink-100', focusRing)}>
                    {body}
                  </Link>
                ) : (
                  <span className={itemClass}>{body}</span>
                )}
                {i < STAGES.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-px min-w-3 flex-1 sm:w-8 sm:flex-none',
                      done ? 'bg-emerald-700/40' : 'bg-line-300',
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
