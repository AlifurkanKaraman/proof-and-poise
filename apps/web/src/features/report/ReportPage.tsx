import type { Report } from '@proof-and-poise/shared';
import { Printer } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Page } from '../../app/Page';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingStage } from '../../components/states/LoadingStage';
import { Button } from '../../components/ui/Button';
import { ApiError, userMessage } from '../../lib/api/errors';
import { useCreateReport, useDeleteSession, useReport } from '../../lib/api/queries';
import { CompetencyStatusList } from './CompetencyStatusList';
import { DeleteDataDialog } from './DeleteDataDialog';
import { FeedbackAccordion } from './FeedbackAccordion';
import { PrioritizedActions } from './PrioritizedActions';
import { ReadinessRing } from './ReadinessRing';
import { STAROutlines } from './STAROutlines';
import './print.css';

/**
 * Readiness report page (Task 19, Req 12.1-12.4, 2.5).
 * Loads the report; if none exists yet (404) it is created once, since the interview is complete.
 */
export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const sessionId = id!;
  const navigate = useNavigate();

  const report = useReport(sessionId);
  const createReport = useCreateReport(sessionId);
  const deleteSession = useDeleteSession(sessionId);

  const notCreated = report.error instanceof ApiError && report.error.code === 'NOT_FOUND';
  const { mutate: create, isIdle: createIdle } = createReport;

  useEffect(() => {
    if (notCreated && createIdle) create();
  }, [notCreated, createIdle, create]);

  const handleDelete = async () => {
    try {
      await deleteSession.mutateAsync();
      // The token is invalid after deletion (401), so leave the session.
      navigate('/');
    } catch {
      // Surfaced through React Query state.
    }
  };

  if (report.isLoading || createReport.isPending || (notCreated && createIdle)) {
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

  if (createReport.isError || (report.isError && !notCreated)) {
    return (
      <Page title="Readiness Report">
        <ErrorState
          title="Report failed to load"
          message={userMessage(createReport.error ?? report.error)}
          action={
            <Button
              onClick={() => {
                if (createReport.isError) createReport.mutate();
                else void report.refetch();
              }}
            >
              Retry
            </Button>
          }
          secondaryAction={
            <Button variant="secondary" onClick={() => navigate(`/s/${sessionId}/interview`)}>
              Back to interview
            </Button>
          }
        />
      </Page>
    );
  }

  const data = report.data ?? createReport.data;

  if (!data) {
    return (
      <Page title="Readiness Report">
        <ErrorState
          title="No report available"
          message="Complete the interview to generate your readiness report."
          action={
            <Button onClick={() => navigate(`/s/${sessionId}/interview`)}>Go to interview</Button>
          }
        />
      </Page>
    );
  }

  return (
    <ReportView
      report={data}
      onPrint={() => window.print()}
      onDelete={handleDelete}
      isDeleting={deleteSession.isPending}
      onStartOver={() => navigate('/')}
      onPracticeAgain={(turnId) => navigate(`/s/${sessionId}/interview?practice=${turnId}`)}
    />
  );
}

interface ReportViewProps {
  report: Report;
  onPrint: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  onStartOver: () => void;
  onPracticeAgain: (turnId: string) => void;
}

/** Presentation of a finished report (Req 12.1-12.4). */
export function ReportView({
  report: data,
  onPrint,
  onDelete,
  isDeleting,
  onStartOver,
  onPracticeAgain,
}: ReportViewProps) {
  const names = Object.fromEntries(data.competencies.map((c) => [c.competencyId, c.name]));
  const nameOf = (competencyId: string) => names[competencyId] ?? competencyId;

  return (
    <Page
      title="Your Readiness Report"
      lead="Review your interview readiness and next steps"
      className="print-page"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <Button onClick={onPrint} variant="secondary" size="sm">
              <Printer className="mr-2 size-4" aria-hidden />
              Print
            </Button>
            <DeleteDataDialog onConfirm={onDelete} isDeleting={isDeleting} />
          </div>
          <Button onClick={onStartOver}>Start new session</Button>
        </div>

        <div className="flex flex-col gap-8">
          <ReadinessRing readiness={data.readiness} />

          <div className="rounded-lg border border-line-200 bg-paper-0 p-6">
            <h2 className="mb-4 text-h3 font-semibold text-ink-950">Summary</h2>
            <p className="text-body leading-relaxed text-ink-700">{data.summary}</p>
          </div>

          <CompetencyStatusList competencies={data.competencies} />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-emerald-700/20 bg-emerald-50 p-6">
              <h2 className="mb-3 text-small font-semibold text-emerald-900">Strongest evidence</h2>
              <ul className="space-y-2">
                {data.strongestEvidence.map((item) => (
                  <li key={item.evidenceId} className="text-small text-emerald-950">
                    <span className="font-semibold">{nameOf(item.competencyId)}:</span> “
                    {item.quote}”
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-amber-700/20 bg-amber-50 p-6">
              <h2 className="mb-3 text-small font-semibold text-amber-900">Weakest areas</h2>
              <ul className="space-y-2">
                {data.weakestAreas.map((item) => (
                  <li key={item.competencyId} className="text-small text-amber-950">
                    <span className="font-semibold">{nameOf(item.competencyId)}:</span>{' '}
                    {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <STAROutlines outlines={data.starOutlines} />
          <PrioritizedActions actions={data.actions} competencyNames={names} />

          <div className="rounded-lg border border-line-200 bg-paper-0 p-6">
            <h2 className="mb-4 text-h3 font-semibold text-ink-950">
              Question-by-question feedback
            </h2>
            <FeedbackAccordion questions={data.questions} onPracticeAgain={onPracticeAgain} />
          </div>
        </div>
      </div>
    </Page>
  );
}
