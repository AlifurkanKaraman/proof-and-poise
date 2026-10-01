import { Info } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AnalysisStageSchema, type AnalysisStage, type ErrorCode } from '@proof-and-poise/shared';
import { Page } from '../../app/Page';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingStage } from '../../components/states/LoadingStage';
import { Button } from '../../components/ui/Button';
import { codeMessage, isApiError, userMessage } from '../../lib/api/errors';
import { useToast } from '../../components/ui/Toast';
import {
  useAnalysis,
  useConfirmation,
  useDecision,
  useStartInterview,
  useSubmitSetup,
} from '../../lib/api/queries';
import { draftSubmission, loadSetupDraft } from '../setup/setupForm';
import { AnalysisWorkspace, type WorkspaceActions } from './AnalysisWorkspace';
import { scoreToast } from './scoreToast';

const DECISION_DONE = {
  accept: 'Change accepted',
  reject: 'Change rejected',
  reset: 'Decision undone',
} as const;

/** Staged progress labels, in contract order (Req 5.1). */
const STAGE_LABELS: Record<AnalysisStage, string> = {
  reading_resume: 'Reading resume',
  mapping_competencies: 'Mapping competencies',
  checking_evidence: 'Checking evidence',
  drafting_recommendations: 'Drafting recommendations',
};
const STAGES = AnalysisStageSchema.options;
const STAGE_TEXT = STAGES.map((s) => STAGE_LABELS[s]);

function Progress({ stage }: { stage: AnalysisStage | null }) {
  return (
    <Page title="Analysis">
      <LoadingStage
        title="Analyzing your resume against the job"
        stages={STAGE_TEXT}
        // Queued shows the first stage as in progress.
        current={stage === null ? 0 : STAGES.indexOf(stage)}
      />
    </Page>
  );
}

export default function AnalysisPage() {
  const { id = '' } = useParams<{ id: string }>();
  const sessionId = id;
  const navigate = useNavigate();

  const analysis = useAnalysis(sessionId);
  const startInterview = useStartInterview(sessionId);
  const retry = useSubmitSetup();
  const [interviewError, setInterviewError] = useState<unknown>(null);
  const decision = useDecision(sessionId);
  const confirmation = useConfirmation(sessionId);
  const toast = useToast();

  // Optimistic decision with rollback in the hook (Req 7.5, design §10); the toast shows the
  // server's score change and its reason.
  const decide: WorkspaceActions['onDecide'] = (recId, choice) => {
    decision.mutate(
      { recId, decision: choice },
      { onSuccess: (res) => toast.show(scoreToast(res.scoreEvent, DECISION_DONE[choice])) },
    );
  };

  const actions: WorkspaceActions = {
    onDecide: decide,
    pendingRecId: decision.isPending ? decision.variables.recId : null,
    onConfirm: async (body) => {
      const res = await confirmation.mutateAsync(body);
      toast.show(scoreToast(res.scoreEvent, 'Experience confirmed'));
    },
  };

  // Back to setup with the entered values kept (Req 3.1, 4.4).
  const backToSetup = (state: { resumeMode?: 'paste'; step?: number }) =>
    void navigate('/prepare', { state: { ...state, reuseSession: true } });
  const pasteInstead = () => backToSetup({ resumeMode: 'paste', step: 0 });

  /** Resubmit what the candidate entered in this tab; without it, return to the review step. */
  const retryAnalysis = () => {
    const draft = loadSetupDraft();
    const submission = draft?.sessionId === sessionId ? draftSubmission(draft) : null;
    if (!submission) {
      backToSetup({ step: 2 });
      return;
    }
    retry.mutate({ sessionId, ...submission });
  };

  const handleStartInterview = async () => {
    setInterviewError(null);
    try {
      await startInterview.mutateAsync();
      void navigate(`/s/${sessionId}/interview`);
    } catch (error) {
      setInterviewError(error);
    }
  };

  const failure = (code: ErrorCode, message: string) => (
    <Page title="Analysis">
      <ErrorState
        title={code === 'EXTRACTION_FAILED' ? "We couldn't read your PDF" : 'The analysis failed'}
        message={message}
        action={
          code === 'EXTRACTION_FAILED' ? (
            <Button onClick={pasteInstead}>Paste text instead</Button>
          ) : (
            <Button onClick={retryAnalysis} loading={retry.isPending}>
              Retry
            </Button>
          )
        }
        secondaryAction={
          <Button variant="secondary" onClick={() => backToSetup({ step: 0 })}>
            Back to setup
          </Button>
        }
      />
    </Page>
  );

  if (retry.isError) return failure('INTERNAL', userMessage(retry.error));
  if (retry.isPending) return <Progress stage={null} />;

  if (analysis.isPending) return <Progress stage={null} />;

  if (analysis.isError) {
    const code = isApiError(analysis.error) ? analysis.error.code : 'INTERNAL';
    if (code === 'NOT_FOUND') {
      return (
        <Page title="Analysis">
          <ErrorState
            title="No analysis yet"
            message="This session doesn't have an analysis. Add your resume and a job to start one."
            action={<Button onClick={() => backToSetup({ step: 0 })}>Go to setup</Button>}
          />
        </Page>
      );
    }
    if (code === 'EXTRACTION_FAILED') return failure(code, userMessage(analysis.error));
    return (
      <Page title="Analysis">
        <ErrorState
          title="We couldn't load the analysis"
          message={userMessage(analysis.error)}
          action={<Button onClick={() => void analysis.refetch()}>Retry</Button>}
          secondaryAction={
            <Button variant="secondary" onClick={() => void navigate('/')}>
              Go home
            </Button>
          }
        />
      </Page>
    );
  }

  const data = analysis.data;
  if (data.status === 'queued') return <Progress stage={null} />;
  if (data.status === 'running') return <Progress stage={data.stage} />;
  if (data.status === 'failed') return failure(data.errorCode, codeMessage(data.errorCode));

  return (
    <Page
      title="Your analysis"
      lead="Review each requirement, the evidence behind it, and suggested resume changes."
    >
      {data.truncated && (
        // Req 4.5: tell the candidate when the resume was shortened before analysis.
        <p className="flex items-start gap-2 rounded-md border border-line-200 bg-paper-0 p-3 text-small text-ink-700">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-indigo-600" />
          Your resume was longer than the limit, so only the first part was analyzed.
        </p>
      )}
      {interviewError !== null && (
        <ErrorState
          title="We couldn't start the interview"
          message={userMessage(interviewError)}
          action={
            <Button onClick={() => void handleStartInterview()} loading={startInterview.isPending}>
              Retry
            </Button>
          }
        />
      )}
      {decision.isError && (
        <ErrorState
          title="We couldn't save your decision"
          message={`${userMessage(decision.error)} Your previous choice was restored.`}
          action={
            <Button onClick={() => decide(decision.variables.recId, decision.variables.decision)}>
              Retry
            </Button>
          }
          secondaryAction={
            <Button variant="secondary" onClick={() => decision.reset()}>
              Dismiss
            </Button>
          }
        />
      )}
      <AnalysisWorkspace
        evidenceMap={data.evidenceMap}
        resumeText={data.resumeText}
        actions={actions}
        onStartInterview={() => void handleStartInterview()}
        isStartingInterview={startInterview.isPending}
      />
    </Page>
  );
}
