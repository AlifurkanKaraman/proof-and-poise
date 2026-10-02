import { Award, Check, Lightbulb, MessageSquare, Target, Undo2, X } from 'lucide-react';
import { createContext, useContext, useState } from 'react';
import {
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
import { ScoreRing } from '../../components/ui/ScoreRing';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs';
import { StatusBadge, type EvidenceStatus } from '../../components/ui/StatusBadge';
import { cn } from '../../lib/cn';
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

export function AnalysisWorkspace({
  evidenceMap,
  onStartInterview,
  isStartingInterview,
  actions,
  resumeText,
}: AnalysisWorkspaceProps) {
  const { competencies, keywords, recommendations, scores } = evidenceMap;
  const [tab, setTab] = useState('overview');
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

  // Count matched vs required keywords
  const matchedKeywords = keywords.filter((k) => k.matched);
  const requiredKeywords = keywords.filter((k) => k.required);
  const matchedRequired = requiredKeywords.filter((k) => k.matched);

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
            <div className="flex flex-col gap-6">
              {/* Scores */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <ScoreCard
                  label="Job Match"
                  value={scores.jobMatch}
                  icon={Target}
                  description="Overall alignment with the job requirements"
                />
                <ScoreCard
                  label="Evidence Coverage"
                  value={scores.evidenceCoverage}
                  icon={Award}
                  description="How well your resume backs up your competencies"
                />
                <ScoreCard
                  label="Keyword Match"
                  value={scores.keywordCoverage}
                  icon={Lightbulb}
                  description="Required keywords found in your resume"
                />
                <ScoreCard
                  label="Parseability"
                  value={scores.parseability}
                  icon={Award}
                  description="How well structured your resume is"
                />
              </div>

              {/* Summary */}
              <div className="rounded-lg border border-line-200 bg-paper-0 p-6">
                <h2 className="mb-4 text-h3 font-semibold text-ink-950">Summary</h2>
                <div className="flex flex-col gap-3 text-small text-ink-700">
                  <p>
                    <strong className="font-semibold text-ink-950">
                      {required.length} required competencies
                    </strong>
                    {', '}
                    {preferred.length} preferred, and {contextual.length} contextual
                  </p>
                  <p>
                    <strong className="font-semibold text-ink-950">
                      {matchedRequired.length} of {requiredKeywords.length} required keywords
                      matched
                    </strong>
                  </p>
                  <p>
                    <strong className="font-semibold text-ink-950">
                      {recommendations.length} recommendations
                    </strong>
                    {' to strengthen your resume'}
                  </p>
                </div>
              </div>

              {/* Step 1: tailor the resume (main flow), step 2: practice (design §7.6) */}
              {canTailor && (
                <div className="rounded-lg border border-indigo-600/20 bg-indigo-50 p-6">
                  <p className="text-caption font-semibold text-indigo-700">Step 1</p>
                  <h2 className="mb-2 text-h3 font-semibold text-ink-950">
                    Tailor your resume for this job
                  </h2>
                  <p className="mb-4 text-small text-ink-700">
                    List the job keywords your resume already proves, confirm real experience for
                    the gaps, then copy or download the tailored resume.
                  </p>
                  <Button onClick={() => setTab('tailor')}>Tailor my resume</Button>
                </div>
              )}
              <div className="rounded-lg border border-line-200 bg-paper-0 p-6">
                {canTailor && <p className="text-caption font-semibold text-ink-700">Step 2</p>}
                <h2 className="mb-2 text-h3 font-semibold text-ink-950">
                  Ready for the interview?
                </h2>
                <p className="mb-4 text-small text-ink-700">
                  Practice answering competency-based questions to improve your readiness score.
                </p>
                <Button
                  variant={canTailor ? 'secondary' : 'primary'}
                  onClick={onStartInterview}
                  disabled={isStartingInterview}
                >
                  {isStartingInterview ? 'Starting interview...' : 'Start Interview'}
                </Button>
              </div>
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
                <div className="rounded-lg border border-line-200 bg-paper-0 p-6 text-center">
                  <p className="text-small text-ink-700">
                    No recommendations at this time. Your resume looks good!
                  </p>
                </div>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {keywords.map((keyword) => (
                <div
                  key={keyword.term}
                  className={cn(
                    'rounded-lg border p-4',
                    keyword.matched
                      ? 'border-emerald-700/20 bg-emerald-50'
                      : 'border-line-200 bg-paper-0',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={cn(
                        'font-mono text-small font-semibold',
                        keyword.matched ? 'text-emerald-700' : 'text-ink-950',
                      )}
                    >
                      {keyword.term}
                    </p>
                    {keyword.required && (
                      <span className="rounded border border-amber-700/20 bg-amber-50 px-1.5 py-0.5 text-caption font-medium text-amber-700">
                        Required
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-caption text-ink-700">
                    {keyword.matched ? 'Found in resume' : 'Not found'}
                  </p>
                </div>
              ))}
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
                  return competency ? <ConfirmAction competency={competency} /> : null;
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

interface ScoreCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  description: string;
}

function ScoreCard({ label, value, icon: Icon, description }: ScoreCardProps) {
  const tone = value >= 80 ? 'emerald' : value >= 60 ? 'indigo' : 'amber';
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-line-200 bg-paper-0 p-6">
      <div className="flex w-full items-center justify-between">
        <Icon aria-hidden="true" className="size-5 text-indigo-600" />
        <ScoreRing value={value} label="" size={64} tone={tone} />
      </div>
      <div className="w-full">
        <p className="text-small font-semibold text-ink-950">{label}</p>
        <p className="text-caption text-ink-700">{description}</p>
      </div>
    </div>
  );
}

interface CompetencySectionProps {
  title: string;
  competencies: EvidenceMap['competencies'];
}

function CompetencySection({ title, competencies }: CompetencySectionProps) {
  return (
    <section>
      <h2 className="mb-4 text-h3 font-semibold text-ink-950">{title}</h2>
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

  return (
    <div className="rounded-lg border border-line-200 bg-paper-0 p-6">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-body font-semibold text-ink-950">{competency.name}</h3>
          <p className="mt-1 text-small text-ink-700">{competency.description}</p>
        </div>
        <StatusBadge status={status} label={label} className="shrink-0" />
      </div>

      {competency.evidence.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-caption font-semibold uppercase tracking-wide text-ink-700">
            Evidence ({competency.evidence.length})
          </p>
          {competency.evidence.slice(0, 2).map((evidence) => (
            <blockquote
              key={evidence.id}
              className="border-l-2 border-indigo-600 bg-paper-50 pl-3 pr-2 py-2 text-small italic text-ink-700"
            >
              "{evidence.quote}"
              <footer className="mt-1 text-caption not-italic text-ink-700">
                — {evidence.source === 'resume' ? 'From your resume' : 'Confirmed by you'}
              </footer>
            </blockquote>
          ))}
          {competency.evidence.length > 2 && (
            <p className="text-caption text-ink-700">+{competency.evidence.length - 2} more</p>
          )}
        </div>
      )}

      {competency.missingEvidence && (
        <div className="mt-4 rounded bg-amber-50 p-3">
          <p className="text-caption font-semibold uppercase tracking-wide text-amber-700">
            Suggested for interview
          </p>
          <p className="mt-1 text-small text-ink-950">{competency.suggestedInterviewTopic}</p>
        </div>
      )}

      {(competency.strength === 'weak' || competency.strength === 'none') && (
        <div className="mt-4">
          <ConfirmAction competency={competency} />
        </div>
      )}
    </div>
  );
}

/** "I have this experience" for weak/none competencies (Req 8.1), or its outcome. */
function ConfirmAction({ competency }: { competency: Competency }) {
  const { actions, confirmationsLeft } = useContext(WorkspaceContext);
  if (competency.confirmationState === 'confirmed') {
    return <StatusBadge status="confirmed" />;
  }
  if (!actions) return null;
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
        'rounded-lg border p-6',
        isMissing ? 'border-amber-700/20 bg-amber-50' : 'border-line-200 bg-paper-0',
        recommendation.decision === 'accepted' && 'border-emerald-700/40',
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          {competency && (
            <p className="text-caption font-semibold uppercase tracking-wide text-ink-700">
              {competency.name}
            </p>
          )}
          <p className="text-small font-semibold text-ink-950">{recommendation.reason}</p>
        </div>
        <StatusBadge status={TRUST_BADGES[recommendation.trustLabel]} className="shrink-0" />
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <p className="text-caption font-semibold uppercase tracking-wide text-ink-700">
            Original
          </p>
          <p className="mt-1 text-small text-ink-700">{recommendation.originalText}</p>
        </div>

        {recommendation.proposedText && (
          <div>
            <p className="text-caption font-semibold uppercase tracking-wide text-emerald-700">
              Suggested
            </p>
            <p className="mt-1 text-small text-ink-950">{recommendation.proposedText}</p>
          </div>
        )}
      </div>

      {isMissing ? (
        // Req 7.4: no Accept for missing evidence; confirm it or practice it instead.
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {competency && <ConfirmAction competency={competency} />}
          {/* No contract route marks a topic as an interview priority yet (frontend.md). */}
          <Button variant="ghost" size="sm" disabled>
            <MessageSquare aria-hidden="true" className="size-4" />
            Practice this in the interview (Coming soon)
          </Button>
        </div>
      ) : (
        actions && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
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
