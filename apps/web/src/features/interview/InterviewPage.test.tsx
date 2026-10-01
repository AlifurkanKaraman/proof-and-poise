import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes as contract } from '@proof-and-poise/shared';
import { Providers } from '../../app/providers';
import { routes } from '../../app/routes';
import { api } from '../../lib/api';
import { saveSession } from '../../lib/session';
import { setMockFault } from '../../mocks/controls';
import { mswPath } from '../../mocks/handlers';
import { createMockServer } from '../../mocks/node';

const { server } = createMockServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
  setMockFault(null);
  sessionStorage.clear();
  vi.unstubAllGlobals();
});
afterAll(() => server.close());

/** Minimal MediaRecorder: Safari-like (MP4 only); stop() emits one chunk then onstop. */
class FakeMediaRecorder {
  static isTypeSupported = (t: string) => t === 'audio/mp4';
  static last: FakeMediaRecorder | null = null;
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(
    _stream: MediaStream,
    readonly options: { mimeType: string },
  ) {
    FakeMediaRecorder.last = this;
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio'], { type: this.options.mimeType }) });
    this.onstop?.();
  }
}

function stubMedia(getUserMedia: () => Promise<MediaStream>) {
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
}

const fakeStream = () => ({ getTracks: () => [{ stop: () => {} }] }) as unknown as MediaStream;

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
});

async function renderInterview() {
  const created = await api.request('createSession', { body: { mode: 'demo' } });
  saveSession(created);
  await api.request('startInterview', { params: { sessionId: created.sessionId } });
  const router = createMemoryRouter(routes, {
    initialEntries: [`/s/${created.sessionId}/interview`],
  });
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  await screen.findByRole('button', { name: /enable microphone/i });
}

async function recordAnswer() {
  await userEvent.click(screen.getByRole('button', { name: /enable microphone/i }));
  await userEvent.click(await screen.findByRole('button', { name: /start recording/i }));
  await userEvent.click(screen.getByRole('button', { name: /stop recording/i }));
  await userEvent.click(await screen.findByRole('button', { name: /transcribe answer/i }));
}

describe('InterviewPage recorded answers (Req 10.2, 10.4)', () => {
  it('records, uploads, transcribes, lets the candidate edit, and submits as transcribed', async () => {
    stubMedia(() => Promise.resolve(fakeStream()));
    const bodies: Record<string, unknown> = {};
    server.events.on('request:start', ({ request }) => {
      if (request.method !== 'POST') return;
      const path = new URL(request.url).pathname;
      const key = path.endsWith('/uploads/audio')
        ? 'presign'
        : path.endsWith('/answer')
          ? 'answer'
          : null;
      if (key)
        void request
          .clone()
          .json()
          .then((b: unknown) => (bodies[key] = b));
    });

    await renderInterview();
    await recordAnswer();
    // Safari path: MP4 recorder, sent as audio/mp4.
    expect(FakeMediaRecorder.last?.options.mimeType).toBe('audio/mp4');

    const editor = await screen.findByLabelText(/transcript/i, {}, { timeout: 8_000 });
    expect(bodies.presign).toEqual({ contentType: 'audio/mp4', size: 5 });
    await userEvent.type(editor, ' Edited.');
    await userEvent.click(screen.getByRole('button', { name: /submit answer/i }));

    await screen.findByRole('button', { name: /continue|next|report/i }, { timeout: 5_000 });
    await waitFor(() => expect(bodies.answer).toBeDefined());
    expect(bodies.answer).toMatchObject({ source: 'transcribed', edited: true });
    expect((bodies.answer as { text: string }).text.endsWith('Edited.')).toBe(true);
  }, 20_000);

  it('offers Type instead when transcription fails and keeps the recording for retry', async () => {
    stubMedia(() => Promise.resolve(fakeStream()));
    server.use(
      http.get(mswPath(contract.getTranscription.path), () =>
        HttpResponse.json({ status: 'failed', errorCode: 'UPSTREAM_UNAVAILABLE' }),
      ),
    );
    await renderInterview();
    await recordAnswer();

    const alert = await screen.findByRole('alert', {}, { timeout: 5_000 });
    expect(alert).toHaveTextContent(/could not transcribe/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /type instead/i }));
    expect(screen.getByRole('tab', { name: /type/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText(/your answer/i)).toBeInTheDocument();
  }, 20_000);

  it('hides retry when the transcription quota is used up', async () => {
    stubMedia(() => Promise.resolve(fakeStream()));
    setMockFault({ kind: 'QUOTA_EXCEEDED', route: 'startTranscription' });
    await renderInterview();
    await recordAnswer();

    expect(await screen.findByRole('alert')).toHaveTextContent(/recording allowance/i);
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /type instead/i })).toBeInTheDocument();
  }, 20_000);

  it('explains a denied microphone and switches to typing', async () => {
    stubMedia(() =>
      Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })),
    );
    await renderInterview();
    await userEvent.click(screen.getByRole('button', { name: /enable microphone/i }));

    expect(await screen.findByText(/microphone access denied/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /type instead/i }));
    expect(screen.getByRole('tab', { name: /type/i })).toHaveAttribute('aria-selected', 'true');
  });
});
