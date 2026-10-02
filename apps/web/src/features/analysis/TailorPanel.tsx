import { ArrowRight, Check, Plus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  scoreTrail,
  tailoringPlan,
  type EvidenceMap,
  type TrailMetric,
} from '@proof-and-poise/shared';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';

const METRIC_LABELS: Record<TrailMetric, string> = {
  jobMatch: 'Job match',
  keywordCoverage: 'Keyword match',
  evidenceCoverage: 'Evidence coverage',
};

interface TailorPanelProps {
  evidenceMap: EvidenceMap;
  resumeText: string;
  /** Terms the candidate chose to list in Skills. */
  added: readonly string[];
  onToggle: (term: string) => void;
  onAddAll: (terms: string[]) => void;
  /** "I have this experience" for a competency, or null when confirming isn't possible. */
  renderConfirm: (competencyId: string) => ReactNode;
  onOpenResume: () => void;
}

/**
 * Tailor tab (design §7.6): deterministic, truthful resume tailoring for this job. Keywords
 * the resume already proves can be listed in Skills; keywords it doesn't show are never
 * added, only confirmed by the candidate (Req 8) or left as gaps.
 */
export function TailorPanel({
  evidenceMap,
  resumeText,
  added,
  onToggle,
  onAddAll,
  renderConfirm,
  onOpenResume,
}: TailorPanelProps) {
  const plan = tailoringPlan(evidenceMap, resumeText);
  const trail = scoreTrail(evidenceMap.scores, evidenceMap.scoreEvents);
  const addedSet = new Set(added);
  const remaining = plan.addToSkills.filter((s) => !addedSet.has(s.term)).map((s) => s.term);

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="tailor-scores-heading"
        className="rounded-lg border border-line-200 bg-paper-0 p-6"
      >
        <h2 id="tailor-scores-heading" className="text-h3 font-semibold text-ink-950">
          Tailor your resume for this job
        </h2>
        <p className="mt-1 text-small text-ink-700">
          Every change uses only what your resume or your own confirmations show. These scores are
          this app's estimate of fit with this job, not an employer's ATS score.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {trail.map((t) => (
            <div key={t.metric} className="rounded-md border border-line-200 p-3">
              <dt className="text-small font-medium text-ink-700">{METRIC_LABELS[t.metric]}</dt>
              <dd className="mt-1 flex items-center gap-2 text-h3 font-semibold text-ink-950">
                <span>{t.atAnalysis}</span>
                <ArrowRight aria-hidden="true" className="size-4 text-ink-700" />
                <span>{t.now}</span>
                <span className="sr-only">{`(${t.atAnalysis} at analysis, ${t.now} now)`}</span>
                {t.now !== t.atAnalysis && (
                  <span
                    className={cn(
                      'text-small font-semibold',
                      t.now > t.atAnalysis ? 'text-emerald-700' : 'text-red-700',
                    )}
                  >
                    {t.now > t.atAnalysis ? '+' : ''}
                    {t.now - t.atAnalysis}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-small text-ink-700">
          Scores rise when you accept supported changes in Recommendations or confirm real
          experience below.
        </p>
      </section>

      <section
        aria-labelledby="tailor-skills-heading"
        className="rounded-lg border border-line-200 bg-paper-0 p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="tailor-skills-heading" className="text-h3 font-semibold text-ink-950">
              List proven keywords in Skills
            </h2>
            <p className="mt-1 max-w-reading text-small text-ink-700">
              {plan.hasSkillsSection
                ? "Your resume already shows these job keywords, but your Skills section doesn't list them."
                : 'Your resume already shows these job keywords. It has no Skills section, so one is added at the end.'}{' '}
              Listing them puts them where recruiters and screening tools look first. Our keyword
              match already counts them, so it won't change.
            </p>
          </div>
          {remaining.length > 1 && (
            <Button variant="secondary" onClick={() => onAddAll(remaining)}>
              <Plus aria-hidden="true" className="size-4" />
              Add all ({remaining.length})
            </Button>
          )}
        </div>
        {plan.addToSkills.length === 0 ? (
          <p className="mt-4 text-small text-ink-700">
            Nothing to add: every job keyword your resume shows is already in your Skills section.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {plan.addToSkills.map((s) => {
              const isAdded = addedSet.has(s.term);
              return (
                <li
                  key={s.term}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line-200 p-3"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink-950">{s.term}</span>
                    {s.required && (
                      <span className="rounded border border-amber-700/30 px-1.5 text-caption font-semibold text-amber-700">
                        Required
                      </span>
                    )}
                    <span className="text-caption text-ink-700">
                      {s.source === 'resume' ? 'Shown in your resume' : 'From your confirmation'}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant={isAdded ? 'secondary' : 'primary'}
                    aria-pressed={isAdded}
                    aria-label={
                      isAdded ? `Remove ${s.term} from Skills` : `Add ${s.term} to Skills`
                    }
                    onClick={() => onToggle(s.term)}
                  >
                    {isAdded ? (
                      <>
                        <Check aria-hidden="true" className="size-4" />
                        Added
                      </>
                    ) : (
                      <>
                        <Plus aria-hidden="true" className="size-4" />
                        Add to Skills
                      </>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {added.length > 0 && (
          <Button className="mt-4" variant="secondary" onClick={onOpenResume}>
            View and download the tailored resume
          </Button>
        )}
      </section>

      <section
        aria-labelledby="tailor-gaps-heading"
        className="rounded-lg border border-line-200 bg-paper-0 p-6"
      >
        <h2 id="tailor-gaps-heading" className="text-h3 font-semibold text-ink-950">
          Job keywords your resume doesn't show
        </h2>
        <p className="mt-1 max-w-reading text-small text-ink-700">
          These are never added for you. If you have real experience, confirm it in your own words
          and it counts toward your scores. Otherwise, treat it as a gap to prepare for in the
          interview.
        </p>
        {plan.notShown.length === 0 ? (
          <p className="mt-4 text-small text-ink-700">
            Your resume shows every keyword we found in this job description.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {plan.notShown.map((g) => (
              <li
                key={g.term}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line-200 p-3"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <X aria-hidden="true" className="size-4 text-ink-700" />
                  <span className="font-medium text-ink-950">{g.term}</span>
                  <span className="sr-only">Not shown in your resume.</span>
                  {g.required && (
                    <span className="rounded border border-amber-700/30 px-1.5 text-caption font-semibold text-amber-700">
                      Required
                    </span>
                  )}
                </span>
                {g.competencyId !== null ? (
                  renderConfirm(g.competencyId)
                ) : (
                  <span className="text-small text-ink-700">Gap: prepare to discuss it</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
