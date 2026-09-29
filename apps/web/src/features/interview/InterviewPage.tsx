import { LIMITS, type Evaluation, type Turn } from '@proof-and-poise/shared';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Page } from '../../app/Page';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingStage } from '../../components/states/LoadingStage';
import { Button } from '../../components/ui/Button';
import { SegmentedProgress, type Segment } from '../../components/ui/SegmentedProgress';
import { userMessage } from '../../lib/api/errors';
import { useInterview, useSubmitAnswer } from '../../lib/api/queries';
import { AnswerPanel, type PanelAnswer } from './AnswerPanel';
import { FeedbackCard } from './FeedbackCard';
import { PrepTimer } from './PrepTimer';
import { QuestionCard } from './QuestionCard';

interface Feedback {
  evaluation: Evaluation;
  hasNext: boolean;
}

/**
 * Interview room page (Task 15, Req 9.2, 9.3, 10.1-10.3, 10.5, 11.1).
 * Distraction-free layout with question, prep timer, answer capture, and feedback.
 */
export default function InterviewPage() {
  const { id } = useParams<{ id: string }>();
  const sessionId = id ?? '';
  const navigate = useNavigate();

  const interview = useInterview(sessionId);
  const submitAnswer = useSubmitAnswer(sessionId);

  const [showTimer, setShowTimer] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | undefined>(undefined);

  const goToReport = () => navigate(`/s/${sessionId}/report`);

  const handleAnswer = async (turn: Turn, answer: PanelAnswer) => {
    if (answer.type === 'audio') {
      // Audio upload and transcription arrive with task 18; until then show a reviewable stub.
      setIsTranscribing(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setIsTranscribing(false);
      setTranscript('Transcription is not available yet. Type or edit your answer here.');
      return;
    }
    const edited = transcript !== undefined;
    try {
      const res = await submitAnswer.mutateAsync({
        turnId: turn.id,
        answer: { text: answer.text, source: edited ? 'transcribed' : 'typed', edited },
      });
      setFeedback({ evaluation: res.evaluation, hasNext: res.next !== null });
      setTranscript(undefined);
    } catch {
      // The mutation error is rendered below.
    }
  };

  const handleContinue = () => {
    if (feedback && !feedback.hasNext) {
      goToReport();
      return;
    }
    setFeedback(null);
    setShowTimer(true);
    setTranscript(undefined);
  };

  if (interview.isLoading) {
    return (
      <Page title="Interview">
        <LoadingStage
          title="Preparing interview"
          stages={['Loading questions', 'Setting up recording', 'Ready']}
          current={0}
        />
      </Page>
    );
  }

  if (interview.isError) {
    return (
      <Page title="Interview">
        <ErrorState
          title="Interview failed to load"
          message={userMessage(interview.error)}
          action={<Button onClick={() => interview.refetch()}>Retry</Button>}
          secondaryAction={
            <Button variant="secondary" onClick={() => navigate(`/s/${sessionId}/analysis`)}>
              Back to analysis
            </Button>
          }
        />
      </Page>
    );
  }

  const data = interview.data;
  if (!data || data.turns.length === 0) {
    return (
      <Page title="Interview">
        <ErrorState
          title="No interview questions"
          message="The interview has not been started yet."
          action={
            <Button onClick={() => navigate(`/s/${sessionId}/analysis`)}>Back to analysis</Button>
          }
        />
      </Page>
    );
  }

  const currentTurn = data.turns.find((t) => t.status !== 'evaluated');

  // Everything answered and no feedback pending: the interview is over.
  if (!currentTurn && !feedback) {
    return (
      <Page title="Interview complete">
        <ErrorState
          title="Interview complete"
          message="You answered every question. Your readiness report is ready."
          action={<Button onClick={goToReport}>View your report</Button>}
        />
      </Page>
    );
  }

  // Build progress segments (Req 9.3): follow-ups render as sub-steps.
  const pendingId = feedback ? undefined : currentTurn?.id;
  const segments: Segment[] = data.turns.map((turn) => ({
    id: turn.id,
    label:
      turn.kind === 'follow_up' ? `Question ${turn.label} (follow-up)` : `Question ${turn.label}`,
    state:
      turn.id === pendingId ? 'current' : turn.status === 'evaluated' ? 'complete' : 'upcoming',
    subStep: turn.kind === 'follow_up',
  }));

  const shown = feedback ? undefined : currentTurn;
  const questionNumber =
    (shown ?? data.turns.filter((t) => t.status === 'evaluated').at(-1))?.index ?? 1;
  const totalQuestions = LIMITS.interview.primaryQuestions;

  return (
    <Page
      title={`Question ${questionNumber} of ${totalQuestions}`}
      lead={
        feedback ? 'Review your feedback below' : 'Take your time to provide a thoughtful answer'
      }
    >
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-6">
          <SegmentedProgress
            segments={segments}
            summary={`Question ${questionNumber} of ${totalQuestions}`}
          />

          {shown && (
            <>
              <QuestionCard turn={shown} />

              {/* Optional prep timer (Req 9.3, WCAG 2.2.1) */}
              {showTimer && <PrepTimer onHide={() => setShowTimer(false)} />}

              {submitAnswer.isError && (
                <p role="alert" className="text-small font-medium text-error-700">
                  {userMessage(submitAnswer.error)}
                </p>
              )}

              <AnswerPanel
                onSubmit={(answer) => void handleAnswer(shown, answer)}
                isSubmitting={submitAnswer.isPending}
                isTranscribing={isTranscribing}
                transcript={transcript}
                onTranscriptEdit={setTranscript}
              />
            </>
          )}

          {feedback && (
            <FeedbackCard
              evaluation={feedback.evaluation}
              onContinue={handleContinue}
              isLast={!feedback.hasNext}
              isContinuing={interview.isFetching}
            />
          )}
        </div>
      </div>
    </Page>
  );
}
