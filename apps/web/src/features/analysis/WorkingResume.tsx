import { FilePen } from 'lucide-react';
import {
  applySkillAdditions,
  buildWorkingResume,
  type Recommendation,
} from '@proof-and-poise/shared';
import { EmptyState } from '../../components/states/EmptyState';
import { SectionErrorBoundary } from '../../components/states/SectionErrorBoundary';
import { ExportPanel } from './ExportPanel';

interface WorkingResumeProps {
  resumeText: string;
  recommendations: readonly Recommendation[];
  /** Job keywords the candidate chose to list in Skills (Tailor tab, design §7.6). */
  skillAdditions?: readonly string[];
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

/**
 * The working resume: the original text with accepted recommendations applied (Req 7.6–7.7).
 * Changed lines carry a visible "Changed" label and a screen-reader prefix, not color alone
 * (Req 14.3). Downloads are DOCX or PDF through `ExportPanel` (Req 7.7, 7.10).
 */
export function WorkingResume({
  resumeText,
  recommendations,
  skillAdditions = [],
}: WorkingResumeProps) {
  const working = buildWorkingResume(resumeText, recommendations);
  const text = applySkillAdditions(working.text, skillAdditions);
  const lines = text.split('\n');
  const changed = changedLines(resumeText, text);
  const changedCount = changed.filter(Boolean).length;

  const summary =
    working.applied.length === 0 && skillAdditions.length === 0
      ? 'Your original resume. Accepted changes and added skills appear here.'
      : [
          working.applied.length > 0 &&
            `${working.applied.length} accepted ${working.applied.length === 1 ? 'change' : 'changes'}`,
          skillAdditions.length > 0 &&
            `${skillAdditions.length} ${skillAdditions.length === 1 ? 'skill' : 'skills'} added`,
        ]
          .filter(Boolean)
          .join(', ') +
        `; ${changedCount} ${changedCount === 1 ? 'line' : 'lines'} marked "Changed".`;

  return (
    <section aria-labelledby="working-resume-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="working-resume-heading" className="text-h3 font-semibold text-ink-950">
          Tailored resume
        </h2>
        <p className="text-small text-ink-700">{summary}</p>
      </div>

      {working.unapplied.length > 0 && (
        <p className="rounded-md border border-amber-700/20 bg-amber-50 p-3 text-small text-ink-950">
          {working.unapplied.length === 1
            ? 'One accepted change'
            : `${working.unapplied.length} accepted changes`}{' '}
          couldn't be placed because the original wording wasn't found in your resume.
        </p>
      )}

      {text.trim() !== '' && (
        // Any render failure in the export panel stays here, not on the route (Req 14.2).
        <SectionErrorBoundary
          title="Couldn't show the download options"
          message="Your tailored resume below is unchanged. Try again to reload this section."
        >
          <ExportPanel text={text} />
        </SectionErrorBoundary>
      )}

      {lines.every((l) => l.trim() === '') ? (
        <EmptyState
          icon={FilePen}
          title="No resume text"
          description="Go back to setup to add your resume."
        />
      ) : (
        <ol
          aria-label="Tailored resume lines"
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
