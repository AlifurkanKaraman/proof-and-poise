import { Copy, FilePen } from 'lucide-react';
import { useState } from 'react';
import { buildWorkingResume, type Recommendation } from '@proof-and-poise/shared';
import { EmptyState } from '../../components/states/EmptyState';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';

interface WorkingResumeProps {
  resumeText: string;
  recommendations: readonly Recommendation[];
}

/** Lines of `next` that don't appear in `prev` (multiset, so repeated lines count once each). */
export function changedLines(prev: string, next: string): boolean[] {
  const remaining = new Map<string, number>();
  for (const line of prev.split('\n')) remaining.set(line, (remaining.get(line) ?? 0) + 1);
  return next.split('\n').map((line) => {
    const left = remaining.get(line) ?? 0;
    if (left > 0) {
      remaining.set(line, left - 1);
      return false;
    }
    return line.trim() !== '';
  });
}

type CopyStatus = 'idle' | 'copied' | 'failed';

/**
 * The working resume: the original text with accepted recommendations applied (Req 7.6–7.7).
 * Changed lines carry a visible "Changed" label and a screen-reader prefix, not color alone
 * (Req 14.3).
 */
export function WorkingResume({ resumeText, recommendations }: WorkingResumeProps) {
  const working = buildWorkingResume(resumeText, recommendations);
  const lines = working.text.split('\n');
  const changed = changedLines(resumeText, working.text);
  const changedCount = changed.filter(Boolean).length;
  const [copy, setCopy] = useState<CopyStatus>('idle');

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(working.text);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  };

  return (
    <section aria-labelledby="working-resume-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="working-resume-heading" className="text-h3 font-semibold text-ink-950">
            Working resume
          </h2>
          <p className="text-small text-ink-700">
            {working.applied.length === 0
              ? 'Your original resume. Accepted changes will appear here.'
              : `${working.applied.length} accepted ${working.applied.length === 1 ? 'change' : 'changes'} applied, ${changedCount} ${changedCount === 1 ? 'line' : 'lines'} marked "Changed".`}
          </p>
        </div>
        <Button variant="secondary" onClick={() => void copyText()}>
          <Copy aria-hidden="true" className="size-4" />
          Copy as text
        </Button>
      </div>

      <p
        role="status"
        className={cn('text-small', copy === 'failed' ? 'text-red-700' : 'text-ink-700')}
      >
        {copy === 'copied' && 'Working resume copied to the clipboard.'}
        {copy === 'failed' &&
          'Your browser blocked clipboard access. Select the text below and copy it manually.'}
      </p>

      {working.unapplied.length > 0 && (
        <p className="rounded-md border border-amber-700/20 bg-amber-50 p-3 text-small text-ink-950">
          {working.unapplied.length === 1
            ? 'One accepted change'
            : `${working.unapplied.length} accepted changes`}{' '}
          couldn't be placed because the original wording wasn't found in your resume.
        </p>
      )}

      {lines.every((l) => l.trim() === '') ? (
        <EmptyState
          icon={FilePen}
          title="No resume text"
          description="Go back to setup to add your resume."
        />
      ) : (
        <ol
          aria-label="Working resume lines"
          className="rounded-lg border border-line-200 bg-paper-0 p-4 font-mono text-small"
        >
          {lines.map((line, i) =>
            changed[i] ? (
              <li
                key={i}
                className="flex flex-wrap items-baseline gap-2 border-l-4 border-emerald-700 bg-emerald-50 py-1 pl-2"
              >
                <span className="rounded border border-emerald-700/30 px-1 font-sans text-caption font-semibold text-emerald-700">
                  <span aria-hidden="true">Changed</span>
                  <span className="sr-only">Changed line:</span>
                </span>
                <mark className="whitespace-pre-wrap bg-transparent text-ink-950">{line}</mark>
              </li>
            ) : (
              <li key={i} className="min-h-5 whitespace-pre-wrap py-0.5 pl-3 text-ink-700">
                {line}
              </li>
            ),
          )}
        </ol>
      )}
    </section>
  );
}
