import { useNavigate, useParams } from 'react-router';
import { Page } from '../../app/Page';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingStage } from '../../components/states/LoadingStage';
import { useAnalysis, useStartInterview } from '../../lib/api/queries';
import { userMessage } from '../../lib/api/errors';
import { AnalysisWorkspace } from './AnalysisWorkspace';

const ANALYSIS_STAGES = [
  'Reading resume',
  'Analyzing job description',
  'Mapping competencies',
  'Generating recommendations',
];

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const sessionId = id!;
  const navigate = useNavigate();

  const analysis = useAnalysis(sessionId);
  const startInterview = useStartInterview(sessionId);

  const handleStartInterview = async () => {
    try {
      await startInterview.mutateAsync();
      navigate(`/s/${sessionId}/interview`);
    } catch {
      // Error is handled by React Query error state
    }
  };

  if (analysis.isLoading) {
    return (
      <Page title="Analysis">
        <LoadingStage
          title="Analyzing your profile"
          stages={ANALYSIS_STAGES}
          current={0}
        />
      </Page>
    );
  }

  if (analysis.isError) {
    return (
      <Page title="Analysis">
        <ErrorState
          title="Analysis failed"
          message={userMessage(analysis.error)}
          action={
            <Button onClick={() => analysis.refetch()}>
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

  const data = analysis.data;

  if (!data) {
    return (
      <Page title="Analysis">
        <ErrorState
          title="No analysis data"
          message="The analysis has not been started yet."
          action={
            <Button onClick={() => navigate('/')}>
              Go home
            </Button>
          }
        />
      </Page>
    );
  }

  if (data.status === 'queued' || data.status === 'processing') {
    const stage = data.status === 'queued' ? 0 : 1;
    return (
      <Page title="Analysis">
        <LoadingStage
          title="Analyzing your profile"
          stages={ANALYSIS_STAGES}
          current={stage}
        />
      </Page>
    );
  }

  if (data.status === 'failed') {
    return (
      <Page title="Analysis">
        <ErrorState
          title="Analysis failed"
          message="We encountered an issue while analyzing your profile. Please try again."
          action={
            <Button onClick={() => navigate('/prepare')}>
              Start over
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

  // data.status === 'ready'
  return (
    <Page
      title="Your Analysis"
      lead="Review your competencies, recommendations, and keywords to prepare for your interview."
    >
      <AnalysisWorkspace
        evidenceMap={data.evidenceMap}
        onStartInterview={handleStartInterview}
        isStartingInterview={startInterview.isPending}
      />
    </Page>
  );
}
