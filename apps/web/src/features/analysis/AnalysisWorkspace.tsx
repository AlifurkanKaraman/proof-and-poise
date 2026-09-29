import { Award, Lightbulb, Target } from 'lucide-react';
import type { EvidenceMap } from '@proof-and-poise/shared';
import { Button } from '../../components/ui/Button';
import { ScoreRing } from '../../components/ui/ScoreRing';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { cn } from '../../lib/cn';

interface AnalysisWorkspaceProps {
  evidenceMap: EvidenceMap;
  onStartInterview: () => void;
  isStartingInterview?: boolean;
}

export function AnalysisWorkspace({
  evidenceMap,
  onStartInterview,
  isStartingInterview,
}: AnalysisWorkspaceProps) {
  const { competencies, keywords, recommendations, scores } = evidenceMap;

  // Group competencies by importance
  const required = competencies.filter((c) => c.importance === 'required');
  const preferred = competencies.filter((c) => c.importance === 'preferred');
  const bonus = competencies.filter((c) => c.importance === 'bonus');

  // Group recommendations by trust label
  const missingEvidence = recommendations.filter((r) => r.trustLabel === 'missing_evidence');
  const rewordingOnly = recommendations.filter((r) => r.trustLabel === 'rewording_only');

  // Count matched vs required keywords
  const matchedKeywords = keywords.filter((k) => k.matched);
  const requiredKeywords = keywords.filter((k) => k.required);
  const matchedRequired = requiredKeywords.filter((k) => k.matched);

  return (
    <div className="flex flex-col gap-6">
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="competencies">
            Competencies ({competencies.length})
          </TabsTrigger>
          <TabsTrigger value="recommendations">
            Recommendations ({recommendations.length})
          </TabsTrigger>
          <TabsTrigger value="keywords">
            Keywords ({matchedKeywords.length}/{keywords.length})
          </TabsTrigger>
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
                  {preferred.length} preferred, and {bonus.length} bonus
                </p>
                <p>
                  <strong className="font-semibold text-ink-950">
                    {matchedRequired.length} of {requiredKeywords.length} required keywords matched
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

            {/* Start Interview CTA */}
            <div className="rounded-lg border border-indigo-600/20 bg-indigo-50 p-6">
              <h2 className="mb-2 text-h3 font-semibold text-ink-950">Ready for the interview?</h2>
              <p className="mb-4 text-small text-ink-700">
                Practice answering competency-based questions to improve your readiness score.
              </p>
              <Button onClick={onStartInterview} disabled={isStartingInterview}>
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
            {bonus.length > 0 && (
              <CompetencySection title="Bonus" competencies={bonus} />
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
            {rewordingOnly.length > 0 && (
              <RecommendationSection
                title="Rewording Suggestions"
                description="Minor improvements to better highlight your experience."
                recommendations={rewordingOnly}
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
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-caption font-medium text-amber-700">
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
      </Tabs>
    </div>
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
        <Icon className="size-5 text-indigo-600" />
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

function CompetencyCard({ competency }: CompetencyCardProps) {
  const strengthMap = {
    strong: { status: 'verified' as const, label: 'Strong' },
    weak: { status: 'weak' as const, label: 'Weak' },
    unverified: { status: 'missing' as const, label: 'Unverified' },
  };
  const { status, label } = strengthMap[competency.strength];

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
                — {evidence.source === 'resume' ? 'From Resume' : 'Confirmed by you'}
              </footer>
            </blockquote>
          ))}
          {competency.evidence.length > 2 && (
            <p className="text-caption text-ink-700">
              +{competency.evidence.length - 2} more
            </p>
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
    </div>
  );
}

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
  recommendation: EvidenceMap['recommendations'][number];
}

function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const isMissing = recommendation.trustLabel === 'missing_evidence';

  return (
    <div
      className={cn(
        'rounded-lg border p-6',
        isMissing
          ? 'border-amber-700/20 bg-amber-50'
          : 'border-line-200 bg-paper-0',
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-4">
        <p className="text-small font-semibold text-ink-950">{recommendation.reason}</p>
        <StatusBadge
          status={isMissing ? 'missing' : 'rewording'}
          className="shrink-0"
        />
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
    </div>
  );
}
