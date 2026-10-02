import { useEffect, useReducer, useRef, useState } from 'react';
import { LIMITS, type AudioContentType } from '@proof-and-poise/shared';

// Req 10.2: Distinct, accessible state for each microphone condition
export type MicrophoneState =
  'not-requested' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'unsupported';

export type RecorderState =
  | { phase: 'idle'; micState: MicrophoneState }
  | { phase: 'recording'; micState: 'granted'; elapsedMs: number }
  | { phase: 'recorded'; micState: 'granted'; durationMs: number; blob: Blob; url: string }
  | { phase: 'playing'; micState: 'granted'; durationMs: number; blob: Blob; url: string };

type RecorderAction =
  | { type: 'mic-requested' }
  | { type: 'mic-granted' }
  | { type: 'mic-denied' }
  | { type: 'mic-unavailable' }
  | { type: 'mic-unsupported' }
  | { type: 'start-recording' }
  | { type: 'stop-recording'; blob: Blob; durationMs: number }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'tick'; elapsedMs: number }
  | { type: 'reset' };

function recorderReducer(state: RecorderState, action: RecorderAction): RecorderState {
  switch (action.type) {
    case 'mic-requested':
      return { phase: 'idle', micState: 'requesting' };
    case 'mic-granted':
      return { phase: 'idle', micState: 'granted' };
    case 'mic-denied':
      return { phase: 'idle', micState: 'denied' };
    case 'mic-unavailable':
      return { phase: 'idle', micState: 'unavailable' };
    case 'mic-unsupported':
      return { phase: 'idle', micState: 'unsupported' };
    case 'start-recording':
      if (state.micState !== 'granted') return state;
      return { phase: 'recording', micState: 'granted', elapsedMs: 0 };
    case 'tick':
      if (state.phase !== 'recording') return state;
      return { ...state, elapsedMs: action.elapsedMs };
    case 'stop-recording': {
      if (state.phase !== 'recording') return state;
      const url = URL.createObjectURL(action.blob);
      return {
        phase: 'recorded',
        micState: 'granted',
        blob: action.blob,
        url,
        durationMs: action.durationMs,
      };
    }
    case 'play':
      if (state.phase !== 'recorded') return state;
      return { ...state, phase: 'playing' };
    case 'pause':
      if (state.phase !== 'playing') return state;
      return { ...state, phase: 'recorded' };
    case 'reset':
      // Revoke blob URL to free memory
      if (state.phase === 'recorded' || state.phase === 'playing') {
        URL.revokeObjectURL(state.url);
      }
      return { phase: 'idle', micState: state.micState === 'granted' ? 'granted' : state.micState };
    default:
      return state;
  }
}

interface UseRecorderResult {
  state: RecorderState;
  requestMicrophone: () => Promise<void>;
  startRecording: () => void;
  stopRecording: () => void;
  playRecording: () => void;
  pausePlayback: () => void;
  reset: () => void;
  /** Elapsed time in seconds (for UI display) */
  elapsedSeconds: number;
  /** Remaining time in seconds (for UI display) */
  remainingSeconds: number;
  /** Content type negotiated with MediaRecorder */
  contentType: AudioContentType | null;
}

/**
 * MediaRecorder formats in preference order, each mapped to the upload content type it is
 * sent as (`LIMITS.audioUpload.contentTypes`). Chrome and Firefox record WebM/Opus,
 * Safari (desktop and iOS) records MP4/AAC; Ogg is a last resort for older Firefox.
 */
export const RECORDER_FORMATS: readonly { mimeType: string; contentType: AudioContentType }[] = [
  { mimeType: 'audio/webm;codecs=opus', contentType: 'audio/webm' },
  { mimeType: 'audio/webm', contentType: 'audio/webm' },
  { mimeType: 'audio/mp4', contentType: 'audio/mp4' },
  { mimeType: 'audio/ogg;codecs=opus', contentType: 'audio/ogg' },
  { mimeType: 'audio/ogg', contentType: 'audio/ogg' },
];

/** First recorder format the browser supports, or null when none of the allowed ones are. */
export function pickRecorderFormat(
  isTypeSupported: (mimeType: string) => boolean,
): { mimeType: string; contentType: AudioContentType } | null {
  const allowed: readonly string[] = LIMITS.audioUpload.contentTypes;
  return (
    RECORDER_FORMATS.find((f) => allowed.includes(f.contentType) && isTypeSupported(f.mimeType)) ??
    null
  );
}

/**
 * Hook for audio recording with microphone permission management.
 * Implements Req 10.1 (recording controls) and 10.2 (microphone states).
 */
/** Wall-clock read kept out of the hook body; only called from event handlers. */
const now = () => Date.now();

export function useRecorder(): UseRecorderResult {
  const [state, dispatch] = useReducer(recorderReducer, {
    phase: 'idle',
    micState: 'not-requested',
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const contentTypeRef = useRef<AudioContentType | null>(null);
  const mimeTypeRef = useRef<string | null>(null);
  const [contentType, setContentType] = useState<AudioContentType | null>(null);

  // Latest recording URL, so the unmount cleanup can revoke it without re-running.
  const urlRef = useRef<string | null>(null);
  useEffect(() => {
    urlRef.current = state.phase === 'recorded' || state.phase === 'playing' ? state.url : null;
  }, [state]);

  // Cleanup on unmount only: stopping the stream on every state change would kill the mic.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const requestMicrophone = async () => {
    // Check if MediaRecorder is supported
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      dispatch({ type: 'mic-unavailable' });
      return;
    }

    dispatch({ type: 'mic-requested' });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Negotiate a recorder format the upload contract accepts (Req 10.4).
      const negotiated = pickRecorderFormat((t) => MediaRecorder.isTypeSupported(t));
      const supportedType = negotiated?.contentType;
      mimeTypeRef.current = negotiated?.mimeType ?? null;

      if (!supportedType) {
        dispatch({ type: 'mic-unsupported' });
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      contentTypeRef.current = supportedType;
      setContentType(supportedType);
      dispatch({ type: 'mic-granted' });
    } catch (error) {
      const err = error as Error;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        dispatch({ type: 'mic-denied' });
      } else {
        dispatch({ type: 'mic-unavailable' });
      }
    }
  };

  const startRecording = () => {
    if (!streamRef.current || !contentTypeRef.current) return;

    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: mimeTypeRef.current ?? contentTypeRef.current,
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const durationMs = Date.now() - startTimeRef.current;
      const blob = new Blob(chunksRef.current, { type: contentTypeRef.current! });
      dispatch({ type: 'stop-recording', blob, durationMs });
    };

    mediaRecorderRef.current = recorder;
    startTimeRef.current = now();
    recorder.start();
    dispatch({ type: 'start-recording' });

    // Start timer (updates every 100ms)
    timerRef.current = window.setInterval(() => {
      const elapsedMs = Date.now() - startTimeRef.current;
      dispatch({ type: 'tick', elapsedMs });

      // Req 10.1: 120-second recording limit
      if (elapsedMs >= LIMITS.recording.maxSeconds * 1000) {
        stopRecording();
      }
    }, 100);
  };

  const stopRecording = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  };

  const playRecording = () => {
    if (state.phase !== 'recorded') return;

    if (!audioRef.current) {
      audioRef.current = new Audio(state.url);
      audioRef.current.onended = () => {
        dispatch({ type: 'pause' });
      };
    }

    audioRef.current.play();
    dispatch({ type: 'play' });
  };

  const pausePlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    dispatch({ type: 'pause' });
  };

  const reset = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    dispatch({ type: 'reset' });
  };

  const elapsedSeconds =
    state.phase === 'recording'
      ? Math.floor(state.elapsedMs / 1000)
      : state.phase === 'recorded' || state.phase === 'playing'
        ? Math.floor(state.durationMs / 1000)
        : 0;

  const remainingSeconds =
    state.phase === 'recording'
      ? Math.max(0, LIMITS.recording.maxSeconds - elapsedSeconds)
      : LIMITS.recording.maxSeconds;

  return {
    state,
    requestMicrophone,
    startRecording,
    stopRecording,
    playRecording,
    pausePlayback,
    reset,
    elapsedSeconds,
    remainingSeconds,
    contentType,
  };
}
