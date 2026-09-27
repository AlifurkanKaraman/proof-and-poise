import { motion } from 'framer-motion';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { StatusBadge, statusConfig } from '../../components/ui/StatusBadge';
import { useMotionPreset } from '../../design/useReducedMotion';
import { cn, focusRing } from '../../lib/cn';
import {
  previewCompetencies,
  previewProfile,
  previewResumeLines,
  type PreviewCompetency,
} from './previewData';

/**
 * Landing-page "evidence thread" preview (Req 1.2, design §9). Fictional local data only;
 * no network requests (Req 1.5).
 *
 * Keyboard: a single-select radio group with a roving tabindex. Arrow keys move and select,
 * Home/End jump to the ends; Space/Enter also select. The linked resume lines are highlighted
 * and the result is announced through a polite live region.
 */
export function EvidenceThreadPreview() {
  const [selectedId, setSelectedId] = useState(previewCompetencies[0]?.id ?? '');
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const evidenceId = `${baseId}-evidence`;
  const statusId = `${baseId}-status`;
  const labelId = `${baseId}-label`;

  const selected = previewCompetencies.find((c) => c.id === selectedId);
  const linked = new Set(selected?.evidenceLineIds ?? []);

  const selectAt = (index: number) => {
    const count = previewCompetencies.length;
    const next = previewCompetencies[(index + count) % count];
    if (!next) return;
    setSelectedId(next.id);
    radios.current[(index + count) % count]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const moves: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowRight: index + 1,
      ArrowUp: index - 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: previewCompetencies.length - 1,
    };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    selectAt(target);
  };

  return (
    <section
      aria-labelledby={labelId}
      className="rounded-xl border border-line-200 bg-paper-0 p-4 text-ink-950 shadow-md sm:p-6"
    >
      <header className="flex flex-col gap-1">
        <h2 id={labelId} className="text-h4 font-bold">
          Interactive preview
        </h2>
        <p className="text-caption text-ink-700">
          Fictional sample: {previewProfile.candidate} applying for {previewProfile.job}.
        </p>
      </header>

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-2">
          <p id={`${baseId}-reqs`} className="text-small font-semibold">
            Job requirements
          </p>
          <div
            role="radiogroup"
            aria-labelledby={`${baseId}-reqs`}
            aria-describedby={statusId}
            className="flex flex-col gap-2"
          >
            {previewCompetencies.map((c, index) => {
              const checked = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  ref={(el) => {
                    radios.current[index] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  aria-controls={evidenceId}
                  tabIndex={checked ? 0 : -1}
                  onClick={() => setSelectedId(c.id)}
                  onKeyDown={(e) => onKeyDown(e, index)}
                  className={cn(
                    'flex min-h-11 flex-col items-start gap-1 rounded-md border px-3 py-2 text-left',
                    'transition-colors duration-micro ease-standard',
                    checked
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-line-200 bg-paper-0 hover:bg-paper-50',
                    focusRing,
                  )}
                >
                  <span className="text-small font-semibold">{c.name}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={c.status} />
                    <span className="text-caption text-ink-700">{c.importance}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-small font-semibold">Resume excerpt</p>
          <ul
            id={evidenceId}
            aria-label="Resume excerpt (fictional)"
            className="flex flex-col gap-2"
          >
            {previewResumeLines.map((line) => {
              const isLinked = linked.has(line.id);
              return (
                <li
                  key={line.id}
                  data-linked={isLinked || undefined}
                  className={cn(
                    'relative rounded-md border py-2 pr-3 pl-6 text-small transition-colors duration-standard ease-standard',
                    isLinked && selected?.status === 'verified'
                      ? 'border-emerald-700/30 bg-emerald-50'
                      : isLinked
                        ? 'border-dashed border-amber-700/50 bg-amber-50'
                        : 'border-line-200 bg-paper-50 text-ink-700',
                  )}
                >
                  {isLinked && selected && <Thread key={selected.id} status={selected.status} />}
                  <span className="block text-caption text-ink-700">{line.section}</span>
                  {isLinked && <span className="sr-only">Linked evidence: </span>}
                  {line.text}
                </li>
              );
            })}
          </ul>
          {selected?.status === 'missing' && (
            <p className="flex items-center gap-2 rounded-md border border-dashed border-amber-700/50 px-3 py-2 text-small text-amber-700">
              <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 shrink-0">
                <circle
                  cx="6"
                  cy="6"
                  r="4.5"
                  className="fill-none stroke-amber-700"
                  strokeWidth="1.5"
                />
              </svg>
              No resume line shows this yet.
            </p>
          )}
        </div>
      </div>

      <p
        id={statusId}
        aria-live="polite"
        className="mt-4 border-t border-line-200 pt-4 text-small text-ink-700"
      >
        {selected && describe(selected)}
      </p>
    </section>
  );
}

function describe(c: PreviewCompetency): string {
  const lines = c.evidenceLineIds.length;
  const highlighted =
    lines === 0
      ? 'No resume lines highlighted.'
      : `${lines} resume line${lines === 1 ? '' : 's'} highlighted.`;
  return `${c.name}: ${statusConfig[c.status].label}. ${c.explanation} ${highlighted}`;
}

/**
 * Decorative 1.5px thread beside a linked line: solid emerald when verified, dashed amber when
 * weak (design §9). The verified thread draws in; reduced motion makes it appear instantly.
 */
function Thread({ status }: { status: PreviewCompetency['status'] }) {
  const draw = useMotionPreset('threadDraw');
  const verified = status === 'verified';
  return (
    <svg aria-hidden="true" className="absolute top-2 left-2 h-[calc(100%-1rem)] w-2">
      <circle
        cx="4"
        cy="6"
        r="2.5"
        strokeWidth="1.5"
        className={verified ? 'fill-emerald-700 stroke-emerald-700' : 'fill-none stroke-amber-700'}
      />
      {verified ? (
        <motion.line
          x1="4"
          y1="10"
          x2="4"
          y2="100%"
          strokeWidth="1.5"
          className="stroke-emerald-700"
          initial={draw.initial}
          animate={draw.animate}
          transition={draw.transition}
        />
      ) : (
        <line
          x1="4"
          y1="10"
          x2="4"
          y2="100%"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          className="stroke-amber-700"
        />
      )}
    </svg>
  );
}
