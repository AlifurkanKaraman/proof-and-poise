import {
  ArrowRight,
  Check,
  ChevronDown,
  FileCheck2,
  FilePenLine,
  FileText,
  Lightbulb,
  MessageSquare,
  Quote,
  ShieldCheck,
  Tags,
  Target,
  TriangleAlert,
  Undo2,
  UserCheck,
  X,
  type LucideIcon,
} from 'lucide-react';
import { createContext, useContext, useState } from 'react';
import {
  canConfirm,
  LIMITS,
  type Competency,
  type ConfirmationRequest,
  type DecisionRequest,
  type EvidenceMap,
  type Recommendation,
  type Strength,
  type TrustLabel,
} from '@proof-and-poise/shared';
import { EmptyState } from '../../components/states/EmptyState';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { IconTile } from '../../components/ui/IconTile';
import { ScoreRing } from '../../components/ui/ScoreRing';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs';
import { StatusBadge, type EvidenceStatus } from '../../components/ui/StatusBadge';
import { cn, focusRing, focusRingOnDark } from '../../lib/cn';
import { ConfirmExperienceDialog } from './ConfirmExperienceDialog';
import { TailorPanel } from './TailorPanel';
import { WorkingResume } from './WorkingResume';

/** Decision and confirmation wiring (Req 7.4–7.5, 8.1). Without it the workspace is read-only. */
export interface WorkspaceActions {
  onDecide: (recId: string, decision: DecisionRequest['decision']) => void;
  /** Recommendation whose decision request is in flight. */
  pendingRecId: string | null;
  /** Resolves on success; rejects with an ApiError the dialog shows. */
  onConfirm: (body: ConfirmationRequest) => Promise<void>;
}

interface WorkspaceContextValue {
  actions: WorkspaceActions | undefined;
  competencies: Map<string, Competency>;
  confirmationsLeft: number;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  actions: undefined,
  competencies: new Map(),
  confirmationsLeft: 0,
});

interface AnalysisWorkspaceProps {
  evidenceMap: EvidenceMap;
  onStartInterview: () => void;
  isStartingInterview?: boolean;
  actions?: WorkspaceActions;
  /** Original resume text from GET analysis; enables the working-resume tab (Req 7.7). */
  resumeText?: string;
}

const isProven = (c: Competency) => c.strength === 'strong' || c.strength === 'moderate';
const isGap = (c: Competency) => c.strength === 'weak' || c.strength === 'none';

export function AnalysisWorkspace({
  evidenceMap,
  onStartInterview,
  isStartingInterview,
  actions,
  resumeText,
}: AnalysisWorkspaceProps) {
  const [tab, setTab] = useState('overview');
  const { competencies, keywords, recommendations, scores } = evidenceMap;
  // Job keywords the candidate chose to list in Skills (design §7.6). Kept in memory only,
  // like the setup draft; a reload starts again from the saved analysis.
  const [skillAdditions, setSkillAdditions] = useState<string[]>([]);
  const toggleSkill = (term: string) =>
    setSkillAdditions((prev) =>
      prev.includes(term) ? prev.filter((t) => t !== term) : [...prev, term],
    );
  const canTailor = resumeText !== undefined;
  const context: WorkspaceContextValue = {
    actions,
    competencies: new Map(competencies.map((c) => [c.id, c])),
    // Req 8.4: at most 3 confirmations per session.
    confirmationsLeft:
      LIMITS.confirmation.maxPerSession -
      competencies.filter((c) => c.confirmationState === 'confirmed').length,
  };

  // Group competencies by importance
  const required = competencies.filter((c) => c.importance === 'required');
  const preferred = competencies.filter((c) => c.importance === 'preferred');
  const contextual = competencies.filter((c) => c.importance === 'contextual');

  // Group recommendations by trust label
  const missingEvidence = recommendations.filter((r) => r.trustLabel === 'missing_evidence');
  // Every label other than missing_evidence carries proposed text the candidate can accept.
  const changes = recommendations.filter((r) => r.trustLabel !== 'missing_evidence');

  const matchedKeywords = keywords.filter((k) => k.matched);
  const missingKeywords = keywords.filter((k) => !k.matched);

  // Verdict inputs: the strongest proof (required first) and the most important gap.
  const strongest =
    required.find((c) => c.strength === 'strong' && c.evidence.length > 0) ??
    competencies.find((c) => c.strength === 'strong' && c.evidence.length > 0) ??
    competencies.find((c) => isProven(c) && c.evidence.length > 0);
  const gap =
    required.find((c) => c.strength === 'none') ??
    required.find((c) => c.strength === 'weak') ??
    competencies.find(isGap);

  const goToGapFix = () => {
    const hasRec = gap && recommendations.some((r) => r.competencyId === gap.id);
    setTab(hasRec ? 'recommendations' : 'competencies');
  };

  return (
    <WorkspaceContext.Provider value={context}>
      <div className="flex flex-col gap-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {canTailor && <TabsTrigger value="tailor">Tailor resume</TabsTrigger>}
            <TabsTrigger value="competencies">Competencies ({competencies.length})</TabsTrigger>
            <TabsTrigger value="recommendations">
              Recommendations ({recommendations.length})
            </TabsTrigger>
            <TabsTrigger value="keywords">
              Keywords ({matchedKeywords.length}/{keywords.length})
            </TabsTrigger>
            {resumeText !== undefined && <TabsTrigger value="resume">Resume</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview">
            <div className="flex flex-col gap-8">
              <Verdict
                competencies={competencies}
                gapName={gap?.name}
                onStartInterview={onStartInterview}
                isStartingInterview={isStartingInterview}
                onTailor={canTailor ? () => setTab('tailor') : undefined}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <Card tone="success" className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <IconTile icon={ShieldCheck} tone="emerald" />
                    <h2 className="text-h4 font-semibold text-ink-950">Your strongest proof</h2>
                  </div>
                  {strongest ? (
                    <>
                      <p className="text-small font-semibold text-ink-950">{strongest.name}</p>
                      <EvidenceQuote evidence={strongest.evidence[0]!} />
                    </>
                  ) : (
                    <p className="text-small text-ink-700">
                      No requirement is strongly backed yet. The recommendations show where to
                      start.
                    </p>
                  )}
                </Card>

                <Card tone="attention" className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <IconTile icon={TriangleAlert} tone="amber" />
                    <h2 className="text-h4 font-semibold text-ink-950">Your biggest gap</h2>
                  </div>
                  {gap ? (
                    <>
                      <p className="text-small font-semibold text-ink-950">{gap.name}</p>
                      <p className="text-small text-ink-700">
                        {gap.strength === 'none'
                          ? 'Nothing in your resume shows this yet.'
                          : 'Your resume mentions this, but without clear proof.'}{' '}
                        If you have done it, say so truthfully; if not, practice it in the
                        interview.
                      </p>
                      <div>
                        <Button variant="secondary" size="sm" onClick={goToGapFix}>
                          See how to close it
                          <ArrowRight aria-hidden="true" className="size-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-small text-ink-700">
                      No major gaps. Practicing out loud is the best next step.
                    </p>
                  )}
                </Card>
              </div>

              <section aria-labelledby="scores-heading" className="flex flex-col gap-4">
                <div>
                  <h2 id="scores-heading" className="text-h3 font-semibold text-ink-950">
                    How your resume scores
                  </h2>
                  <p className="text-small text-ink-700">
                    Calculated from your resume and the job, not guessed by the AI.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <ScoreCard
                    label="Job Match"
                    value={scores.jobMatch}
                    icon={Target}
                    description="Alignment with the job requirements"
                  />
                  <ScoreCard
                    label="Evidence Coverage"
                    value={scores.evidenceCoverage}
                    icon={ShieldCheck}
                    description="Requirements your resume backs up"
                  />
                  <ScoreCard
                    label="Keyword Match"
                    value={scores.keywordCoverage}
                    icon={Tags}
                    description="Required keywords found"
                  />
                  <ScoreCard
                    label="Parseability"
                    value={scores.parseability}
                    icon={FileCheck2}
                    description="How readable your resume is to tools"
                  />
                </div>
              </section>
            </div>
          </TabsContent>

          <TabsContent value="competencies">
            <div className="flex flex-col gap-8">
              {required.length > 0 && (
                <CompetencySection title="Required" competencies={required} />
              )}
              {preferred.length > 0 && (
                <CompetencySection title="Preferred" competencies={preferred} />
              )}
              {contextual.length > 0 && (
                <CompetencySection title="Contextual" competencies={contextual} />
              )}
              {competencies.length === 0 && (
                <EmptyState
                  title="No competencies found"
                  description="We couldn't pull requirements from this job description. Go back to setup and paste a fuller description."
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="recommendations">
            <div className="flex flex-col gap-8">
              {missingEvidence.length > 0 && (
                <RecommendationSection
                  title="Missing Evidence"
                  description="Add these experiences to strengthen your resume."
                  recommendations={missingEvidence}
                />
              )}
              {changes.length > 0 && (
                <RecommendationSection
                  title="Suggested Changes"
                  description="Nothing changes in your resume until you accept it. You can undo until the interview starts."
                  recommendations={changes}
                />
              )}
              {recommendations.length === 0 && (
                <Card className="text-center">
                  <p className="text-small text-ink-700">
                    No recommendations at this time. Your resume looks good!
                  </p>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="keywords">
            {keywords.length === 0 && (
              <EmptyState
                title="No keywords found"
                description="This job description didn't list specific skills or tools to match."
              />
            )}
            <div className="flex flex-col gap-8">
              {matchedKeywords.length > 0 && (
                <KeywordGroup
                  title={`Found in your resume (${matchedKeywords.length})`}
                  keywords={matchedKeywords}
                  matched
                />
              )}
              {missingKeywords.length > 0 && (
                <KeywordGroup
                  title={`Not found (${missingKeywords.length})`}
                  keywords={missingKeywords}
                  matched={false}
                />
              )}
            </div>
          </TabsContent>

          {resumeText !== undefined && (
            <TabsContent value="tailor">
              <TailorPanel
                evidenceMap={evidenceMap}
                resumeText={resumeText}
                added={skillAdditions}
                onToggle={toggleSkill}
                onAddAll={(terms) =>
                  setSkillAdditions((prev) => [...prev, ...terms.filter((t) => !prev.includes(t))])
                }
                renderConfirm={(id) => {
                  const competency = context.competencies.get(id);
                  // Keyed by competency so a dialog is never reused for another one.
                  return competency ? (
                    <ConfirmAction key={competency.id} competency={competency} />
                  ) : null;
                }}
                onOpenResume={() => setTab('resume')}
              />
            </TabsContent>
          )}
          {resumeText !== undefined && (
            <TabsContent value="resume">
              <WorkingResume
                resumeText={resumeText}
                recommendations={recommendations}
                skillAdditions={skillAdditions}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </WorkspaceContext.Provider>
  );
}

interface VerdictProps {
  competencies: Competency[];
  gapName: string | undefined;
  onStartInterview: () => void;
  isStartingInterview: boolean | undefined;
  /** Present when the resume text is available: Step 1 of the main flow. */
  onTailor: (() => void) | undefined;
}

/**
 * The first thing a candidate reads: a plain-words verdict, the proof meter (one segment per
 * requirement) and the single next action. Segments are decorative; counts are in the text.
 */
function Verdict({
  competencies,
  gapName,
  onStartInterview,
  isStartingInterview,
  onTailor,
}: VerdictProps) {
  const total = competencies.length;
  const proven = competencies.filter(isProven).length;
  const weak = competencies.filter((c) => c.strength === 'weak').length;
  const none = competencies.filter((c) => c.strength === 'none').length;

  return (
    <Card tone="dark" padding="lg" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h2 className="max-w-reading font-heading text-h2 font-bold tracking-tight">
          {total === 0
            ? "We couldn't find requirements to check"
            : `Your resume already proves ${proven} of ${total} requirements.`}
        </h2>
        <p className="max-w-reading text-body text-line-300">
          {gapName
            ? `The biggest gap is ${gapName}. Practicing it now is the fastest way to feel ready.`
            : 'Nothing major is missing. Practicing out loud is the best next step.'}
        </p>
      </div>

      {total > 0 && (
        <div className="flex flex-col gap-2">
          <div aria-hidden="true" className="flex gap-1.5">
            {competencies.map((c) => (
              <span
                key={c.id}
                className={cn(
                  'h-2 flex-1 rounded-full',
                  isProven(c) && 'bg-emerald-100',
                  c.strength === 'weak' && 'bg-amber-100/70',
                  c.strength === 'none' && 'bg-ink-800',
                )}
              />
            ))}
          </div>
          <p className="text-small text-line-300">
            {proven} proven
            {weak > 0 && ` · ${weak} weak`}
            {none > 0 && ` · ${none} without evidence`}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {onTailor && (
          // Step 1 of the main flow: tailor the resume, then practice (design §7.6).
          <Button size="lg" onClick={onTailor} className={focusRingOnDark}>
            <FilePenLine aria-hidden="true" className="size-4" />
            Tailor my resume
          </Button>
        )}
        <Button
          size="lg"
          variant={onTailor ? 'secondary' : 'primary'}
          onClick={onStartInterview}
          disabled={isStartingInterview}
          className={focusRingOnDark}
        >
          {isStartingInterview ? 'Starting interview...' : 'Start Interview'}
          {!isStartingInterview && <ArrowRight aria-hidden="true" className="size-4" />}
        </Button>
        <p className="text-small text-line-300">
          {onTailor
            ? 'Step 1: tailor your resume with only what you can prove. Step 2: practice the interview.'
            : 'Five questions, aimed at your weakest evidence.'}
        </p>
      </div>
    </Card>
  );
}

interface ScoreCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  description: string;
}

function ScoreCard({ label, value, icon: Icon, description }: ScoreCardProps) {
  const tone = value >= 80 ? 'emerald' : value >= 60 ? 'indigo' : 'amber';
  const meaning = value >= 80 ? 'Strong' : value >= 60 ? 'Solid, room to grow' : 'Needs attention';
  return (
    <Card className="flex items-center gap-4" padding="md">
      <ScoreRing value={value} label="" size={64} tone={tone} />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-small font-semibold text-ink-950">
          <Icon aria-hidden="true" className="size-4 shrink-0 text-ink-700" strokeWidth={1.75} />
          {label}
        </p>
        <p className="text-small font-medium text-ink-950">{meaning}</p>
        <p className="text-caption text-ink-700">{description}</p>
      </div>
    </Card>
  );
}

/** A verbatim resume line, marked like a highlighter pass over the document. */
function EvidenceQuote({ evidence }: { evidence: Competency['evidence'][number] }) {
  const mine = evidence.source !== 'resume';
  const SourceIcon = mine ? UserCheck : FileText;
  return (
    <figure className="rounded-r-lg border-l-4 border-indigo-600 bg-indigo-50 py-2 pr-3 pl-3">
      <blockquote className="flex gap-2 text-small text-ink-950">
        <Quote aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-indigo-700" />
        <p>
          <mark className="box-decoration-clone rounded-sm bg-indigo-100 px-0.5 text-ink-950">
            {evidence.quote}
          </mark>
        </p>
      </blockquote>
      <figcaption className="mt-1.5 flex items-center gap-1.5 pl-6 text-caption text-ink-700">
        <SourceIcon aria-hidden="true" className="size-3.5" />
        {mine ? 'Confirmed by you' : 'From your resume'}
      </figcaption>
    </figure>
  );
}

interface KeywordGroupProps {
  title: string;
  keywords: EvidenceMap['keywords'];
  matched: boolean;
}

function KeywordGroup({ title, keywords, matched }: KeywordGroupProps) {
  return (
    <section>
      <h2 className="mb-3 text-h4 font-semibold text-ink-950">{title}</h2>
      <ul className="flex flex-wrap gap-2">
        {keywords.map((keyword) => (
          <li
            key={keyword.term}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-small',
              matched
                ? 'border-emerald-700/20 bg-emerald-50 text-emerald-700'
                : keyword.required
                  ? 'border-amber-700 bg-paper-0 text-amber-700'
                  : 'border-line-300 bg-paper-0 text-ink-700',
            )}
          >
            {matched ? (
              <Check aria-hidden="true" className="size-4" strokeWidth={2.25} />
            ) : (
              <X aria-hidden="true" className="size-4" strokeWidth={2.25} />
            )}
            <span className="font-mono font-medium">{keyword.term}</span>
            {keyword.required && (
              <span className="rounded-sm bg-paper-0 px-1 text-caption font-semibold">
                Required
              </span>
            )}
            <span className="sr-only">{matched ? ' (found in resume)' : ' (not found)'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface CompetencySectionProps {
  title: string;
  competencies: EvidenceMap['competencies'];
}

function CompetencySection({ title, competencies }: CompetencySectionProps) {
  const proven = competencies.filter(isProven).length;
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-h3 font-semibold text-ink-950">{title}</h2>
        <p className="text-small text-ink-700">
          {proven} of {competencies.length} proven
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {competencies.map((competency) => (
          <CompetencyCard key={competency.id} competency={competency} />
        ))}
      </div>
    </section>
  );
}

interface CompetencyCardProps {
  competency: EvidenceMap['competencies'][number];
}

/** Every contract strength gets an icon + text badge, never color alone (Req 14.3, design §9.3). */
export const STRENGTH_BADGES: Record<Strength, { status: EvidenceStatus; label: string }> = {
  strong: { status: 'verified', label: 'Strong evidence' },
  moderate: { status: 'verified', label: 'Moderate evidence' },
  weak: { status: 'weak', label: 'Weak evidence' },
  none: { status: 'missing', label: 'No evidence' },
};

function CompetencyCard({ competency }: CompetencyCardProps) {
  const { status, label } = STRENGTH_BADGES[competency.strength];
  const [expanded, setExpanded] = useState(false);
  const extra = competency.evidence.length - 1;
  const shown = expanded ? competency.evidence : competency.evidence.slice(0, 1);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-body font-semibold text-ink-950">{competency.name}</h3>
          <p className="mt-1 text-small text-ink-700">{competency.description}</p>
        </div>
        <StatusBadge status={status} label={label} className="shrink-0" />
      </div>

      {shown.length > 0 && (
        <div className="flex flex-col gap-2">
          {shown.map((evidence) => (
            <EvidenceQuote key={evidence.id} evidence={evidence} />
          ))}
          {extra > 0 && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className={cn(
                'inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md px-2 text-small font-medium text-indigo-700 hover:bg-indigo-50',
                focusRing,
              )}
            >
              <ChevronDown
                aria-hidden="true"
                className={cn('size-4 transition-transform', expanded && 'rotate-180')}
              />
              {expanded
                ? 'Show less'
                : `Show ${extra} more proof ${extra === 1 ? 'line' : 'lines'}`}
            </button>
          )}
        </div>
      )}

      {competency.missingEvidence && (
        <div className="flex gap-3 rounded-lg bg-amber-50 p-3">
          <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-700" />
          <div>
            <p className="text-small font-semibold text-ink-950">Worth practicing</p>
            <p className="mt-0.5 text-small text-ink-700">{competency.suggestedInterviewTopic}</p>
          </div>
        </div>
      )}

      {isGap(competency) && (
        <div>
          <ConfirmAction competency={competency} />
        </div>
      )}
    </Card>
  );
}

/** "I have this experience" for weak/none competencies (Req 8.1), or its outcome. */
function ConfirmAction({ competency }: { competency: Competency }) {
  const { actions, confirmationsLeft } = useContext(WorkspaceContext);
  if (competency.confirmationState === 'confirmed') {
    return <StatusBadge status="confirmed" />;
  }
  // Req 8.1: never offer a confirmation the API would reject as not eligible.
  if (!actions || !canConfirm(competency)) return null;
  if (confirmationsLeft <= 0) {
    return (
      <p className="text-small text-ink-700">
        You have used all {LIMITS.confirmation.maxPerSession} confirmations for this session.
      </p>
    );
  }
  return <ConfirmExperienceDialog competency={competency} onSubmit={actions.onConfirm} />;
}

const TRUST_BADGES: Record<TrustLabel, EvidenceStatus> = {
  verified_from_resume: 'verified',
  confirmed_by_candidate: 'confirmed',
  missing_evidence: 'missing',
  rewording_only: 'rewording',
};

const DECISION_TEXT = { accepted: 'Accepted', rejected: 'Rejected' } as const;

interface RecommendationSectionProps {
  title: string;
  description: string;
  recommendations: EvidenceMap['recommendations'];
}

function RecommendationSection({
  title,
  description,
  recommendations,
}: RecommendationSectionProps) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-h3 font-semibold text-ink-950">{title}</h2>
        <p className="text-small text-ink-700">{description}</p>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {recommendations.map((rec) => (
          <RecommendationCard key={rec.id} recommendation={rec} />
        ))}
      </div>
    </section>
  );
}

interface RecommendationCardProps {
  recommendation: Recommendation;
}

function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const { actions, competencies } = useContext(WorkspaceContext);
  const isMissing = recommendation.trustLabel === 'missing_evidence';
  const competency = competencies.get(recommendation.competencyId);
  const pending = actions?.pendingRecId === recommendation.id;
  const decided = recommendation.decision !== 'pending';

  return (
    <article
      aria-busy={pending || undefined}
      aria-label={competency ? `Recommendation for ${competency.name}` : 'Recommendation'}
      className={cn(
        'flex flex-col gap-4 rounded-xl border p-5 shadow-sm sm:p-6',
        isMissing ? 'border-amber-100 bg-amber-50' : 'border-line-200 bg-paper-0',
        recommendation.decision === 'accepted' && 'border-emerald-700/40 bg-emerald-50',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {competency && <p className="text-small font-medium text-ink-700">{competency.name}</p>}
          <p className="text-body font-semibold text-ink-950">{recommendation.reason}</p>
        </div>
        <StatusBadge status={TRUST_BADGES[recommendation.trustLabel]} className="shrink-0" />
      </div>

      <div className={cn('grid gap-3', recommendation.proposedText && 'md:grid-cols-2')}>
        <div className="rounded-lg bg-ink-100 p-3">
          <p className="text-caption font-semibold text-ink-700">Original</p>
          <p className="mt-1 text-small text-ink-700">{recommendation.originalText}</p>
        </div>

        {recommendation.proposedText && (
          <div className="rounded-lg border-l-4 border-emerald-700 bg-emerald-50 p-3">
            <p className="text-caption font-semibold text-emerald-700">Suggested</p>
            <p className="mt-1 text-small text-ink-950">{recommendation.proposedText}</p>
          </div>
        )}
      </div>

      {isMissing ? (
        // Req 7.4: no Accept for missing evidence; confirm it or practice it instead.
        <div className="flex flex-wrap items-center gap-3">
          {competency && <ConfirmAction competency={competency} />}
          {/* No contract route marks a topic as an interview priority yet (frontend.md). */}
          <Button variant="ghost" size="sm" disabled>
            <MessageSquare aria-hidden="true" className="size-4" />
            Practice this in the interview (Coming soon)
          </Button>
        </div>
      ) : (
        actions && (
          <div className="flex flex-wrap items-center gap-3">
            {decided ? (
              <>
                <p className="inline-flex items-center gap-1.5 text-small font-semibold text-ink-950">
                  {recommendation.decision === 'accepted' ? (
                    <Check aria-hidden="true" className="size-4 text-emerald-700" />
                  ) : (
                    <X aria-hidden="true" className="size-4 text-ink-700" />
                  )}
                  {DECISION_TEXT[recommendation.decision as keyof typeof DECISION_TEXT]}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={pending}
                  onClick={() => actions.onDecide(recommendation.id, 'reset')}
                >
                  <Undo2 aria-hidden="true" className="size-4" />
                  Undo
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  loading={pending}
                  onClick={() => actions.onDecide(recommendation.id, 'accept')}
                >
                  <Check aria-hidden="true" className="size-4" />
                  Accept
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => actions.onDecide(recommendation.id, 'reject')}
                >
                  <X aria-hidden="true" className="size-4" />
                  Reject
                </Button>
              </>
            )}
          </div>
        )
      )}
    </article>
  );
}
