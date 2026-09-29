import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { LIMITS } from '@proof-and-poise/shared';
import { Page } from '../../app/Page';
import { Button } from '../../components/ui/Button';
import { SegmentedProgress, type Segment } from '../../components/ui/SegmentedProgress';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingStage } from '../../components/states/LoadingStage';
import { userMessage } from '../../lib/api/errors';
import { useInterview, useSubmitAnswer } from '../../lib/api/queries';
import { AnswerPanel } from './AnswerPanel';
import { FeedbackCard } from './FeedbackCard';
import { PrepTimer } from './PrepTimer';
import { QuestionCard } from './QuestionCard';

/**
 * Interview room page (Task 15, Req 9.2, 9.3, 10.1-10.3, 10.5).
 * Distraction-free layout with question, prep timer, answer capture, and feedback.
 */
export default function InterviewPage() {
  const { id } = useParams<{ id: string }>();
  const sessionId = id!;
  const navigate = useNavigate();

  const interview = useInterview(sessionId);
  const submitAnswer = useSubmitAnswer(sessionId);

  const [showTimer, setShowTimer] = useState(true);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | undefined>(undefined);

  const handleAnswer = async (answer: { type: 'text'; text: string } | { type: 'audio'; blob: Blob; contentType: string }) => {
    if (answer.type === 'audio') {
      // TODO: Upload audio and transcribe (task 18 endpoints)
      // For now, just submit as text placeholder
      setIsTranscribing(true);
      // Simulate transcription delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setIsTranscribing(false);
      setTranscript('This is a placeholder transcript. Transcription will be implemented in task 18.');
      return;
    }

    try {
      await submitAnswer.mutateAsync({
        turnId: currentTurn.id,
        text: answer.text,
      });
      setTranscript(undefined);
    } catch {
      // Error is handled by React Query error state
    }
  };

  const handleContinue = () => {
    // Refetch interview to get next question
    interview.refetch();
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
          action={
            <Button onClick={() => interview.refetch()}>
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

  const data = interview.data;

  if (!data || data.turns.length === 0) {
    return (
      <Page title="Interview">
        <ErrorState
          title="No interview questions"
          message="The interview has not been started yet."
          action={
            <Button onClick={() => navigate(`/s/${sessionId}/analysis`)}>
              Go back to analysis
            </Button>
          }
        />
      </Page>
    );
  }

  // Find current turn (first unanswered question)
  const currentTurnIndex = data.turns.findIndex((t) => !t.evaluation);
  const currentTurn = currentTurnIndex >= 0 ? data.turns[currentTurnIndex] : null;

  // If all questions answered, navigate to report
  if (!currentTurn) {
    navigate(`/s/${sessionId}/report`);
    return null;
  }

  // Show feedback if current turn has evaluation
  const showFeedback = currentTurn.evaluation !== undefined;

  // Build progress segments (Req 9.3)
  const segments: Segment[] = data.turns.map((turn, idx) => {
    const isFollowUp = turn.type === 'follow-up';
    const hasAnswer = turn.evaluation !== undefined;
    const isCurrent = idx === currentTurnIndex;

    return {
      label: isFollowUp ? `Q${turn.primaryIndex} Follow-up` : `Question ${turn.primaryIndex}`,
      state: hasAnswer ? 'complete' : isCurrent ? 'current' : 'future',
    };
  });

  const questionNumber = currentTurn.primaryIndex;
  const totalQuestions = LIMITS.interview.primaryQuestions;

  return (
    <Page
      title={`Question ${questionNumber} of ${totalQuestions}`}
      lead={showFeedback ? 'Review your feedback below' : 'Take your time to provide a thoughtful answer'}
    >
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-6">
          {/* Progress indicator (Req 9.3) */}
          <SegmentedProgress segments={segments} />

          {!showFeedback && (
            <>
              {/* Question card */}
              <QuestionCard turn={currentTurn} />

              {/* Prep timer (Req 9.3, WCAG 2.2.1) */}
              {showTimer && <PrepTimer onHide={() => setShowTimer(false)} />}

              {/* Answer panel (Req 10.1, 10.2, 10.3) */}
              <AnswerPanel
                onSubmit={handleAnswer}
                isSubmitting={submitAnswer.isPending}
                isTranscribing={isTranscribing}
                transcript={transcript}
                onTranscriptEdit={setTranscript}
              />
            </>
          )}

          {/* Feedback (Req 11.1, 11.5) */}
          {showFeedback && currentTurn.evaluation && (
            <FeedbackCard
              evaluation={currentTurn.evaluation}
              onContinue={handleContinue}
              isContinuing={interview.isFetching}
            />
          )}
        </div>
      </div>
    </Page>
  );
}
