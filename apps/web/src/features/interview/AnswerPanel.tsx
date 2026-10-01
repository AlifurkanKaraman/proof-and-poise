import { Keyboard, Mic, Pause, Play, RotateCcw, Send } from 'lucide-react';
import { useState } from 'react';
import { LIMITS, type AudioContentType } from '@proof-and-poise/shared';
import { Button } from '../../components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs';
import { Textarea } from '../../components/ui/Textarea';
import { Spinner } from '../../components/ui/Spinner';
import { cn } from '../../lib/cn';
import { useRecorder } from './useRecorder';

export type PanelAnswer =
  | { type: 'text'; text: string }
  | { type: 'audio'; blob: Blob; contentType: AudioContentType; durationMs: number }
  | { type: 'transcript'; text: string };

export interface TranscriptionProblem {
  message: string;
  /** False for quota errors: retrying the same recording cannot succeed. */
  canRetry: boolean;
}

interface AnswerPanelProps {
  onSubmit: (answer: PanelAnswer) => void;
  isSubmitting: boolean;
  isTranscribing?: boolean | undefined;
  transcript?: string | undefined;
  onTranscriptEdit?: (text: string) => void;
  /** Clears the transcript under review (Re-record). */
  onDiscardTranscript?: () => void;
  transcriptionError?: TranscriptionProblem | null | undefined;
  className?: string;
}

/**
 * Answer capture panel with Record/Type tabs (Req 10.1, 10.2, 10.3).
 * Handles microphone states, recording, typed answers, and transcription review.
 */
export function AnswerPanel({
  onSubmit,
  isSubmitting,
  isTranscribing,
  transcript,
  onTranscriptEdit,
  onDiscardTranscript,
  transcriptionError,
  className,
}: AnswerPanelProps) {
  const [activeTab, setActiveTab] = useState<'record' | 'type'>('record');
  const [typedAnswer, setTypedAnswer] = useState('');
  const recorder = useRecorder();

  const handleRecordSubmit = () => {
    const { state } = recorder;
    if ((state.phase === 'recorded' || state.phase === 'playing') && recorder.contentType) {
      if (state.phase === 'playing') recorder.pausePlayback();
      onSubmit({
        type: 'audio',
        blob: state.blob,
        contentType: recorder.contentType,
        durationMs: state.durationMs,
      });
    }
  };

  // "Type instead" keeps what the candidate has so far (Req 10.2): the transcript, if any.
  const typeInstead = () => {
    if (transcript && typedAnswer.trim() === '') setTypedAnswer(transcript);
    setActiveTab('type');
  };

  const reRecord = () => {
    recorder.reset();
    onDiscardTranscript?.();
  };

  const hasTranscript = transcript !== undefined;
  const transcriptLength = transcript?.trim().length ?? 0;
  const typeInsteadButton = (
    <Button variant="secondary" onClick={typeInstead} className="mt-3">
      <Keyboard className="mr-2 size-4" aria-hidden />
      Type instead
    </Button>
  );

  const handleTypeSubmit = () => {
    const trimmed = typedAnswer.trim();
    if (trimmed.length >= LIMITS.answer.min && trimmed.length <= LIMITS.answer.max) {
      onSubmit({ type: 'text', text: trimmed });
    }
  };

  const isTypeValid =
    typedAnswer.trim().length >= LIMITS.answer.min &&
    typedAnswer.trim().length <= LIMITS.answer.max;

  const canSubmitAudio =
    (recorder.state.phase === 'recorded' || recorder.state.phase === 'playing') &&
    !isSubmitting &&
    !isTranscribing;

  const canSubmitTranscript =
    hasTranscript &&
    transcriptLength >= LIMITS.answer.min &&
    transcriptLength <= LIMITS.answer.max &&
    !isSubmitting;

  const canSubmitText = isTypeValid && !isSubmitting;

  return (
    <div className={cn('rounded-lg border border-line-200 bg-paper-0 p-6', className)}>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'record' | 'type')}>
        <TabsList>
          <TabsTrigger value="record">
            <Mic className="mr-2 size-4" aria-hidden />
            Record
          </TabsTrigger>
          <TabsTrigger value="type">
            <Keyboard className="mr-2 size-4" aria-hidden />
            Type
          </TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="mt-4">
          <div className="flex flex-col gap-4">
            {/* Microphone states (Req 10.2) */}
            {recorder.state.micState === 'not-requested' && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <p className="text-small text-ink-700">
                  Click the button below to enable your microphone and record your answer.
                </p>
                <Button onClick={recorder.requestMicrophone}>
                  <Mic className="mr-2 size-4" aria-hidden />
                  Enable Microphone
                </Button>
              </div>
            )}

            {recorder.state.micState === 'requesting' && (
              <div className="flex flex-col items-center gap-4 py-8">
                <Spinner className="size-8" />
                <p className="text-small text-ink-700">Requesting microphone access...</p>
              </div>
            )}

            {recorder.state.micState === 'denied' && (
              <div className="rounded border border-amber-700/20 bg-amber-50 p-4">
                <p className="text-small font-semibold text-amber-900">Microphone access denied</p>
                <p className="mt-2 text-small text-amber-900">
                  Please enable microphone access in your browser settings, then refresh the page.
                  Or switch to the <strong>Type</strong> tab to write your answer.
                </p>
                {typeInsteadButton}
              </div>
            )}

            {recorder.state.micState === 'unavailable' && (
              <div className="rounded border border-amber-700/20 bg-amber-50 p-4">
                <p className="text-small font-semibold text-amber-900">Microphone unavailable</p>
                <p className="mt-2 text-small text-amber-900">
                  No microphone detected or this page is not served over HTTPS. Please switch to the{' '}
                  <strong>Type</strong> tab to write your answer.
                </p>
                {typeInsteadButton}
              </div>
            )}

            {recorder.state.micState === 'unsupported' && (
              <div className="rounded border border-amber-700/20 bg-amber-50 p-4">
                <p className="text-small font-semibold text-amber-900">
                  Recording format not supported
                </p>
                <p className="mt-2 text-small text-amber-900">
                  Your browser doesn't support the required audio formats. Please switch to the{' '}
                  <strong>Type</strong> tab to write your answer.
                </p>
                {typeInsteadButton}
              </div>
            )}

            {/* Recording controls (Req 10.1) */}
            {recorder.state.micState === 'granted' && recorder.state.phase === 'idle' && (
              <div className="flex flex-col items-center gap-4 py-8">
                <p className="text-small text-ink-700">
                  Record your answer. You have up to {LIMITS.recording.maxSeconds} seconds.
                </p>
                <Button onClick={recorder.startRecording} size="lg">
                  <Mic className="mr-2 size-5" aria-hidden />
                  Start Recording
                </Button>
              </div>
            )}

            {recorder.state.phase === 'recording' && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="flex items-center gap-3">
                  <div className="size-3 animate-pulse rounded-full bg-error-700" aria-hidden />
                  <p className="font-mono text-h2 font-bold tabular-nums text-error-700">
                    {Math.floor(recorder.elapsedSeconds / 60)}:
                    {(recorder.elapsedSeconds % 60).toString().padStart(2, '0')}
                  </p>
                </div>
                <p className="text-caption text-ink-700">{recorder.remainingSeconds}s remaining</p>
                <Button onClick={recorder.stopRecording} size="lg">
                  <Pause className="mr-2 size-5" aria-hidden />
                  Stop Recording
                </Button>
              </div>
            )}

            {(recorder.state.phase === 'recorded' || recorder.state.phase === 'playing') &&
              !isTranscribing &&
              !hasTranscript && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between rounded border border-line-200 bg-paper-50 p-4">
                    <div>
                      <p className="text-small font-semibold text-ink-950">Recording complete</p>
                      <p className="text-caption text-ink-700">
                        Duration: {Math.floor(recorder.elapsedSeconds / 60)}:
                        {(recorder.elapsedSeconds % 60).toString().padStart(2, '0')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={
                          recorder.state.phase === 'playing'
                            ? recorder.pausePlayback
                            : recorder.playRecording
                        }
                        aria-label={
                          recorder.state.phase === 'playing' ? 'Pause playback' : 'Play recording'
                        }
                      >
                        {recorder.state.phase === 'playing' ? (
                          <Pause className="size-4" aria-hidden />
                        ) : (
                          <Play className="size-4" aria-hidden />
                        )}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={recorder.reset}
                        aria-label="Re-record"
                      >
                        <RotateCcw className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={handleRecordSubmit}
                    disabled={!canSubmitAudio}
                    size="lg"
                    className="w-full"
                  >
                    <Send className="mr-2 size-5" aria-hidden />
                    {isSubmitting ? 'Submitting...' : 'Transcribe answer'}
                  </Button>
                </div>
              )}

            {/* Transcription failure: retry, re-record, or type instead (Req 10.2, 10.4) */}
            {transcriptionError && !isTranscribing && !hasTranscript && (
              <div role="alert" className="rounded border border-error-700/20 bg-paper-50 p-4">
                <p className="text-small font-semibold text-error-700">
                  We could not transcribe your recording
                </p>
                <p className="mt-2 text-small text-ink-700">{transcriptionError.message}</p>
                <div className="flex flex-wrap gap-3">
                  {transcriptionError.canRetry && canSubmitAudio && (
                    <Button onClick={handleRecordSubmit} className="mt-3">
                      <RotateCcw className="mr-2 size-4" aria-hidden />
                      Try again
                    </Button>
                  )}
                  {typeInsteadButton}
                </div>
              </div>
            )}

            {/* Transcription review (Req 10.5) */}
            {isTranscribing && (
              <div role="status" className="flex flex-col items-center gap-4 py-8">
                <Spinner className="size-8" />
                <p className="text-small text-ink-700">Transcribing your answer...</p>
              </div>
            )}

            {hasTranscript && onTranscriptEdit && (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-2 text-small font-semibold text-ink-950">
                    Review and edit transcript
                  </p>
                  <p className="mb-4 text-caption text-ink-700">
                    Review the transcription below. You can edit it to correct any errors before
                    submitting.
                  </p>
                  <Textarea
                    value={transcript}
                    onChange={(e) => onTranscriptEdit(e.target.value)}
                    minLength={LIMITS.answer.min}
                    maxLength={LIMITS.answer.max}
                    rows={6}
                    label="Transcript"
                    error={
                      transcriptLength < LIMITS.answer.min
                        ? `Answer must be at least ${LIMITS.answer.min} characters.`
                        : undefined
                    }
                  />
                </div>

                <div className="flex gap-3">
                  <Button variant="secondary" onClick={reRecord} disabled={isSubmitting}>
                    <RotateCcw className="mr-2 size-4" aria-hidden />
                    Re-record
                  </Button>
                  <Button
                    onClick={() => onSubmit({ type: 'transcript', text: transcript.trim() })}
                    disabled={!canSubmitTranscript}
                    className="flex-1"
                  >
                    <Send className="mr-2 size-5" aria-hidden />
                    {isSubmitting ? 'Submitting...' : 'Submit Answer'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="type" className="mt-4">
          <div className="flex flex-col gap-4">
            <Textarea
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              minLength={LIMITS.answer.min}
              maxLength={LIMITS.answer.max}
              rows={8}
              placeholder="Type your answer here..."
              label="Your answer"
              hint="Provide specific examples from your experience. Include context, actions, and results."
              error={
                typedAnswer.length > 0 && typedAnswer.length < LIMITS.answer.min
                  ? `Answer must be at least ${LIMITS.answer.min} characters.`
                  : undefined
              }
            />

            <Button
              onClick={handleTypeSubmit}
              disabled={!canSubmitText}
              size="lg"
              className="w-full"
            >
              <Send className="mr-2 size-5" aria-hidden />
              {isSubmitting ? 'Submitting...' : 'Submit Answer'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
