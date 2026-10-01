import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_SAMPLE_ANSWERS, routes } from '@proof-and-poise/shared';
import { mswPath } from '../../mocks/handlers';
import { createMockServer } from '../../mocks/node';
import { saveSession } from '../session';
import { api } from './index';
import { isApiError } from './errors';
import { recordingDurationSec, transcribeRecording, transcriptionPollDelay } from './transcription';

const { server } = createMockServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());

const noSleep = () => Promise.resolve();

async function interviewTurn() {
  const created = await api.request('createSession', { body: { mode: 'demo' } });
  saveSession(created);
  const state = await api.request('startInterview', { params: { sessionId: created.sessionId } });
  const turn = state.turns[0];
  if (!turn) throw new Error('no turn');
  return { ids: { sessionId: created.sessionId, turnId: turn.id } };
}

describe('transcription helpers', () => {
  it('backs off from 1 s by ×1.5 and caps at 4 s', () => {
    expect([0, 1, 2, 3, 4].map(transcriptionPollDelay)).toEqual([1000, 1500, 2250, 3375, 4000]);
  });

  it('keeps durationSec positive and within the recording cap', () => {
    expect(recordingDurationSec(0)).toBe(1);
    expect(recordingDurationSec(4_200)).toBe(5);
    expect(recordingDurationSec(121_000)).toBe(120);
  });
});

describe('transcribeRecording (Req 10.4)', () => {
  it('presigns, uploads, starts, and polls until the transcript is ready', async () => {
    const { ids } = await interviewTurn();
    const calls: string[] = [];
    server.events.on('request:start', ({ request }) => {
      calls.push(`${request.method} ${new URL(request.url).pathname}`);
    });
    const text = await transcribeRecording({
      ...ids,
      blob: new Blob(['audio-bytes'], { type: 'audio/mp4' }),
      contentType: 'audio/mp4',
      durationMs: 12_000,
      sleep: noSleep,
    });
    server.events.removeAllListeners();
    expect(Object.values(DEMO_SAMPLE_ANSWERS)).toContain(text);
    expect(calls.filter((c) => c.includes('/transcription'))).toHaveLength(3); // start + 2 polls
    expect(calls.some((c) => c.endsWith('/uploads/audio'))).toBe(true);
  });

  it('rejects with the reported error code when transcription fails', async () => {
    const { ids } = await interviewTurn();
    server.use(
      http.get(mswPath(routes.getTranscription.path), () =>
        HttpResponse.json({ status: 'failed', errorCode: 'UPSTREAM_UNAVAILABLE' }),
      ),
    );
    const err: unknown = await transcribeRecording({
      ...ids,
      blob: new Blob(['x'], { type: 'audio/webm' }),
      contentType: 'audio/webm',
      durationMs: 3_000,
      sleep: noSleep,
    }).catch((e: unknown) => e);
    expect(isApiError(err) && err.code).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('refuses an oversized recording before calling the API', async () => {
    const { ids } = await interviewTurn();
    const big = new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'audio/webm' });
    const err: unknown = await transcribeRecording({
      ...ids,
      blob: big,
      contentType: 'audio/webm',
      durationMs: 3_000,
      sleep: noSleep,
    }).catch((e: unknown) => e);
    expect(isApiError(err) && err.kind).toBe('invalid_request');
  });
});
