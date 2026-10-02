import { LIMITS, type Report } from '@proof-and-poise/shared';
import { BadgeCheck, FileText, MessagesSquare, Plus, Printer, Repeat, Target } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Page } from '../../app/Page';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingStage } from '../../components/states/LoadingStage';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { IconTile } from '../../components/ui/IconTile';
import { ApiError, isApiError, userMessage } from '../../lib/api/errors';
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

  // GET is 404 until the report is created, and again after a practice answer makes it
  // stale (design §8); either way POST builds it (idempotent, Req 12.5).
  const notCreated = report.error instanceof ApiError && report.error.code === 'NOT_FOUND';
  const { mutate: create, isIdle: createIdle, reset: resetCreate } = createReport;

  useEffect(() => {
    if (notCreated && createIdle) create();
  }, [notCreated, createIdle, create]);

  // A fresh 404 after a successful create (e.g. the cache was dropped) builds it again.
  useEffect(() => {
    if (notCreated && createReport.isSuccess) resetCreate();
  }, [notCreated, createReport.isSuccess, resetCreate]);

  const handleDelete = async () => {
    try {
      await deleteSession.mutateAsync();
      // Token and cache are cleared in the mutation; the token is now a 401, so go home.
      navigate('/', { replace: true });
    } catch {
      // Shown in the dialog through `deleteError`.
    }
  };

  const generating =
    report.isLoading || createReport.isPending || (notCreated && !createReport.isError);

  if (generating) {
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

  if (createReport.isError || report.isError) {
    const failed = createReport.isError;
    const problem = reportProblem(failed ? createReport.error : report.error);
    const toInterview = (
      <Button
        variant={problem.canRetry ? 'secondary' : 'primary'}
        onClick={() => navigate(problem.home ? '/' : `/s/${sessionId}/interview`)}
      >
        {problem.home ? 'Start over' : 'Back to interview'}
      </Button>
    );
    return (
      <Page title="Readiness Report">
        <ErrorState
          title={problem.title}
          message={problem.message}
          action={
            problem.canRetry ? (
              <Button
                onClick={() => {
                  if (failed) create();
                  else void report.refetch();
                }}
              >
                Retry
              </Button>
            ) : (
              toInterview
            )
          }
          secondaryAction={problem.canRetry ? toInterview : undefined}
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
      deleteError={deleteSession.isError ? userMessage(deleteSession.error) : null}
      onStartOver={() => navigate('/')}
      onPracticeAgain={(turnId) =>
        navigate(`/s/${sessionId}/interview?practice=${encodeURIComponent(turnId)}`)
      }
    />
  );
}

interface ReportProblem {
  title: string;
  message: string;
  canRetry: boolean;
  /** The session is gone (deleted or expired): the only way on is a new session. */
  home: boolean;
}

/** Report errors mapped to a recovery (design §8, §10). */
export function reportProblem(error: unknown): ReportProblem {
  const code = isApiError(error) ? error.code : 'INTERNAL';
  const network = isApiError(error) && error.kind === 'network';
  const base = { title: 'Report failed to load', message: userMessage(error) };
  if (network) return { ...base, canRetry: true, home: false };
  switch (code) {
    case 'CONFLICT':
      return {
        title: 'Finish the interview first',
        message: 'Answer every question to generate your readiness report.',
        canRetry: false,
        home: false,
      };
    case 'NOT_FOUND':
      return {
        title: 'No interview found',
        message: 'Start the interview to generate your readiness report.',
        canRetry: false,
        home: false,
      };
    case 'QUOTA_EXCEEDED':
      return {
        title: 'Report limit reached',
        message: `You can generate up to ${LIMITS.quotas.reports} reports per session. Start a new session to practice more.`,
        canRetry: false,
        home: true,
      };
    case 'UNAUTHORIZED':
      return { ...base, canRetry: false, home: true };
    default:
      // CAPACITY_REACHED, MODEL_OUTPUT_INVALID, UPSTREAM_UNAVAILABLE, INTERNAL: no quota was
      // used for a failed build, so trying again is safe.
      return { ...base, title: 'Report could not be generated', canRetry: true, home: false };
  }
}

/** Practice attempts left in this session; answered attempts are listed in the report. */
export function practiceRemaining(report: Report): number {
  const used = report.questions.reduce((n, q) => n + q.practiceAttempts.length, 0);
  return Math.max(0, LIMITS.quotas.practiceEvaluations - used);
}

interface ReportViewProps {
  report: Report;
  onPrint: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  deleteError?: string | null;
  onStartOver: () => void;
  onPracticeAgain: (turnId: string) => void;
}

/** Presentation of a finished report (Req 12.1-12.4). */
export function ReportView({
  report: data,
  onPrint,
  onDelete,
  isDeleting,
  deleteError = null,
  onStartOver,
  onPracticeAgain,
}: ReportViewProps) {
  const names = Object.fromEntries(data.competencies.map((c) => [c.competencyId, c.name]));
  const remaining = practiceRemaining(data);
  const nameOf = (competencyId: string) => names[competencyId] ?? competencyId;

  return (
    <Page
      title="Your Readiness Report"
      lead="Here is what your resume and your answers show, and what to do next."
      className="print-page"
    >
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <Button onClick={onPrint} variant="secondary" size="sm">
              <Printer className="size-4" aria-hidden="true" />
              Print
            </Button>
            <DeleteDataDialog onConfirm={onDelete} isDeleting={isDeleting} error={deleteError} />
          </div>
          <Button onClick={onStartOver}>
            <Plus className="size-5" aria-hidden="true" />
            Start new session
          </Button>
        </div>

        <div className="flex flex-col gap-6">
          <ReadinessRing readiness={data.readiness} />

          <Card padding="lg">
            <div className="mb-3 flex items-center gap-3">
              <IconTile icon={FileText} tone="indigo" />
              <h2 className="font-heading text-h3 font-semibold text-ink-950">Summary</h2>
            </div>
            <p className="max-w-reading text-body leading-relaxed text-ink-700">{data.summary}</p>
          </Card>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card tone="success" padding="lg">
              <div className="mb-4 flex items-center gap-3">
                <IconTile icon={BadgeCheck} tone="emerald" />
                <h2 className="font-heading text-h4 font-semibold text-ink-950">
                  Strongest evidence
                </h2>
              </div>
              {data.strongestEvidence.length === 0 && (
                <p className="text-small text-ink-700">
                  No resume line is strong enough to highlight yet.
                </p>
              )}
              <ul className="flex flex-col gap-4">
                {data.strongestEvidence.map((item) => (
                  <li key={item.evidenceId}>
                    <p className="mb-1 text-caption font-semibold text-emerald-700">
                      {nameOf(item.competencyId)}
                    </p>
                    <blockquote className="border-l-2 border-emerald-700 pl-3 text-small leading-relaxed text-ink-950">
                      <mark className="rounded-sm bg-indigo-100 px-1 text-ink-950 box-decoration-clone">
                        “{item.quote}”
                      </mark>
                    </blockquote>
                  </li>
                ))}
              </ul>
            </Card>

            <Card tone="attention" padding="lg">
              <div className="mb-4 flex items-center gap-3">
                <IconTile icon={Target} tone="amber" />
                <h2 className="font-heading text-h4 font-semibold text-ink-950">Weakest areas</h2>
              </div>
              <ul className="flex flex-col gap-4">
                {data.weakestAreas.map((item) => (
                  <li key={item.competencyId}>
                    <p className="mb-1 text-caption font-semibold text-amber-700">
                      {nameOf(item.competencyId)}
                    </p>
                    <p className="text-small leading-relaxed text-ink-950">{item.reason}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <PrioritizedActions actions={data.actions} competencyNames={names} />
          <STAROutlines outlines={data.starOutlines} />
          <CompetencyStatusList competencies={data.competencies} />

          <Card padding="lg">
            <div className="mb-2 flex items-center gap-3">
              <IconTile icon={MessagesSquare} tone="indigo" />
              <h2 className="font-heading text-h3 font-semibold text-ink-950">
                Question-by-question feedback
              </h2>
            </div>
            {/* Practice quota (Req 12.3, LIMITS.quotas.practiceEvaluations). */}
            <p className="mb-5 flex items-center gap-2 text-small text-ink-700">
              <Repeat className="size-4 shrink-0" aria-hidden="true" />
              {remaining > 0
                ? `${remaining} of ${LIMITS.quotas.practiceEvaluations} practice attempts left in this session.`
                : 'You have used every practice attempt in this session.'}
            </p>
            <FeedbackAccordion
              questions={data.questions}
              onPracticeAgain={onPracticeAgain}
              practiceRemaining={remaining}
            />
          </Card>
        </div>
      </div>
    </Page>
  );
}
