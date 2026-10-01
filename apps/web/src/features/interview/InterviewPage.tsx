import { LIMITS, type AnswerRequest, type Evaluation, type Turn } from '@proof-and-poise/shared';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Page } from '../../app/Page';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingStage } from '../../components/states/LoadingStage';
import { Button } from '../../components/ui/Button';
import { SegmentedProgress, type Segment } from '../../components/ui/SegmentedProgress';
import { isApiError, userMessage } from '../../lib/api/errors';
import {
  useInterview,
  useStartPractice,
  useSubmitAnswer,
  useTranscribeRecording,
} from '../../lib/api/queries';
import { AnswerPanel, type PanelAnswer, type TranscriptionProblem } from './AnswerPanel';
import { FeedbackCard } from './FeedbackCard';
import { PrepTimer } from './PrepTimer';
import { QuestionCard } from './QuestionCard';

interface Feedback {
  evaluation: Evaluation;
  hasNext: boolean;
}

/** Transcript under review: what the service returned and the candidate's edited copy. */
interface Review {
  original: string;
  text: string;
}

/** Recording/transcription failures the candidate can act on (Req 10.2, 10.4). */
export function transcriptionProblem(error: unknown): TranscriptionProblem {
  const code = isApiError(error) ? error.code : 'INTERNAL';
  if (code === 'QUOTA_EXCEEDED') {
    return {
      message: 'You have used the recording allowance for this session. Type your answer instead.',
      canRetry: false,
    };
  }
  return { message: userMessage(error), canRetry: true };
}

/**
 * Interview room page (Tasks 15-16, Req 9.2, 9.3, 10.1-10.5, 11.1).
 * Distraction-free layout with question, prep timer, answer capture, and feedback.
 */
export default function InterviewPage() {
  const { id } = useParams<{ id: string }>();
  const sessionId = id ?? '';
  const navigate = useNavigate();

  const interview = useInterview(sessionId);
  const submitAnswer = useSubmitAnswer(sessionId);
  const transcribe = useTranscribeRecording(sessionId);

  // Abort in-flight polling when leaving the page.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  // "Practice again" from the report arrives as ?practice=<turnId> (Req 12.3, task 20).
  const [searchParams] = useSearchParams();
  const practiceId = searchParams.get('practice');
  const startPractice = useStartPractice(sessionId);
  const practiceStarted = useRef(false);
  const { mutate: mutatePractice } = startPractice;
  useEffect(() => {
    if (!practiceId || practiceStarted.current) return;
    practiceStarted.current = true;
    mutatePractice(practiceId, {
      // Drop the param so a reload does not create another attempt.
      onSuccess: () => navigate(`/s/${sessionId}/interview`, { replace: true }),
    });
  }, [practiceId, mutatePractice, navigate, sessionId]);

  const [showTimer, setShowTimer] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [problem, setProblem] = useState<TranscriptionProblem | null>(null);

  const goToReport = () => navigate(`/s/${sessionId}/report`);

  const submit = async (turn: Turn, answer: AnswerRequest) => {
    try {
      const res = await submitAnswer.mutateAsync({ turnId: turn.id, answer });
      setFeedback({ evaluation: res.evaluation, hasNext: res.next !== null });
      setReview(null);
      setProblem(null);
    } catch {
      // The mutation error is rendered below.
    }
  };

  const handleAnswer = async (turn: Turn, answer: PanelAnswer) => {
    if (answer.type === 'text') {
      await submit(turn, { text: answer.text, source: 'typed', edited: false });
      return;
    }
    if (answer.type === 'transcript') {
      // Req 10.4: the reviewed transcript is submitted; `edited` records any change.
      const edited = review !== null && answer.text !== review.original.trim();
      await submit(turn, { text: answer.text, source: 'transcribed', edited });
      return;
    }
    // Recorded: upload → transcribe → poll; the candidate reviews before submitting.
    setProblem(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const text = await transcribe.mutateAsync({
        turnId: turn.id,
        blob: answer.blob,
        contentType: answer.contentType,
        durationMs: answer.durationMs,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setReview({ original: text, text });
    } catch (error) {
      if (!controller.signal.aborted) setProblem(transcriptionProblem(error));
    }
  };

  const handleContinue = () => {
    if (feedback && !feedback.hasNext) {
      goToReport();
      return;
    }
    setFeedback(null);
    setShowTimer(true);
    setReview(null);
    setProblem(null);
  };

  if (practiceId && startPractice.isError) {
    return (
      <Page title="Practice">
        <ErrorState
          title="Could not start practice"
          message={userMessage(startPractice.error)}
          action={<Button onClick={goToReport}>Back to your report</Button>}
        />
      </Page>
    );
  }

  if (interview.isLoading || (practiceId && !startPractice.isError)) {
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
                isTranscribing={transcribe.isPending}
                transcript={review?.text}
                onTranscriptEdit={(text) => setReview((r) => (r ? { ...r, text } : r))}
                onDiscardTranscript={() => {
                  setReview(null);
                  setProblem(null);
                }}
                transcriptionError={problem}
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
