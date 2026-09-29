import { Download, Printer } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { Page } from '../../app/Page';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingStage } from '../../components/states/LoadingStage';
import { userMessage } from '../../lib/api/errors';
import { useReport, useDeleteSession } from '../../lib/api/queries';
import { CompetencyStatusList } from './CompetencyStatusList';
import { DeleteDataDialog } from './DeleteDataDialog';
import { FeedbackAccordion } from './FeedbackAccordion';
import { PrioritizedActions } from './PrioritizedActions';
import { ReadinessRing } from './ReadinessRing';
import { STAROutlines } from './STAROutlines';
import './print.css';

/**
 * Readiness report page (Task 19, Req 12.1-12.4, 2.5).
 * Shows readiness score, summary, competency status, feedback, STAR outlines,
 * prioritized actions, and delete data option. Includes print stylesheet.
 */
export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const sessionId = id!;
  const navigate = useNavigate();

  const report = useReport(sessionId);
  const deleteSession = useDeleteSession(sessionId);

  const handlePrint = () => {
    window.print();
  };

  const handleDelete = async () => {
    try {
      await deleteSession.mutateAsync();
      // After deletion, token is invalid (401), navigate to home
      navigate('/');
    } catch {
      // Error handled by React Query
    }
  };

  const handlePracticeAgain = (turnId: string) => {
    // Navigate back to interview with practice mode
    navigate(`/s/${sessionId}/interview?practice=${turnId}`);
  };

  if (report.isLoading) {
    return (
      <Page title="Readiness Report">
        <LoadingStage
          title="Generating your report"
          stages={['Computing scores', 'Analyzing performance', 'Building recommendations']}
          current={1}
        />
      </Page>
    );
  }

  if (report.isError) {
    return (
      <Page title="Readiness Report">
        <ErrorState
          title="Report failed to load"
          message={userMessage(report.error)}
          action={
            <Button onClick={() => report.refetch()}>
              Retry
            </Button>
          }
          secondaryAction={
            <Button variant="secondary" onClick={() => navigate('/')}>
              Go home
            </Button>
          }
        />
      </Page>
    );
  }

  const data = report.data;

  if (!data) {
    return (
      <Page title="Readiness Report">
        <ErrorState
          title="No report available"
          message="Complete the interview to generate your readiness report."
          action={
            <Button onClick={() => navigate(`/s/${sessionId}/interview`)}>
              Go to interview
            </Button>
          }
        />
      </Page>
    );
  }

  return (
    <Page
      title="Your Readiness Report"
      lead="Review your interview readiness and next steps"
      className="print-page"
    >
      <div className="mx-auto max-w-5xl">
        {/* Actions bar (hidden in print) */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <Button onClick={handlePrint} variant="secondary" size="sm">
              <Printer className="mr-2 size-4" aria-hidden />
              Print
            </Button>
            <DeleteDataDialog onConfirm={handleDelete} isDeleting={deleteSession.isPending} />
          </div>
          <Button onClick={() => navigate('/')}>
            Start new session
          </Button>
        </div>

        <div className="flex flex-col gap-8">
          {/* Readiness Ring (Req 12.1) */}
          <ReadinessRing
            score={data.readinessScore}
            explanation={data.readinessExplanation}
          />

          {/* Summary (Req 12.1: 2-4 sentences) */}
          <div className="rounded-lg border border-line-200 bg-paper-0 p-6">
            <h2 className="mb-4 text-h3 font-semibold text-ink-950">Summary</h2>
            <p className="text-body text-ink-700 leading-relaxed">
              {data.summary}
            </p>
          </div>

          {/* Competency Status (Req 12.1) */}
          <CompetencyStatusList competencies={data.competencies} />

          {/* Strongest Evidence and Weakest Areas (Req 12.1) */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-emerald-700/20 bg-emerald-50 p-6">
              <h3 className="mb-3 text-small font-semibold text-emerald-900">
                Strongest Evidence
              </h3>
              <ul className="space-y-2">
                {data.strongestEvidence.map((item, idx) => (
                  <li key={idx} className="text-small text-emerald-950">
                    <span className="font-semibold">{item.competency}:</span> {item.evidence}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-amber-700/20 bg-amber-50 p-6">
              <h3 className="mb-3 text-small font-semibold text-amber-900">
                Weakest Areas
              </h3>
              <ul className="space-y-2">
                {data.weakestAreas.map((item, idx) => (
                  <li key={idx} className="text-small text-amber-950">
                    <span className="font-semibold">{item.competency}:</span> {item.gap}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* STAR Outlines (Req 12.1: 2-3 outlines) */}
          <STAROutlines outlines={data.starOutlines} />

          {/* Prioritized Actions (Req 12.1, 12.2: exactly 3) */}
          <PrioritizedActions actions={data.actions} />

          {/* Feedback per question (Req 12.1, 12.3) */}
          <div className="rounded-lg border border-line-200 bg-paper-0 p-6">
            <h2 className="mb-4 text-h3 font-semibold text-ink-950">
              Question-by-Question Feedback
            </h2>
            <FeedbackAccordion
              turns={data.interview.turns}
              onPracticeAgain={handlePracticeAgain}
            />
          </div>
        </div>
      </div>
    </Page>
  );
}
