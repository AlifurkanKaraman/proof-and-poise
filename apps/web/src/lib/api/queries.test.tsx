import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { routes, type AnalysisStatusResponse } from '@proof-and-poise/shared';
import { errorResponse, mswPath } from '../../mocks/handlers';
import { createMockServer } from '../../mocks/node';
import { saveSession } from '../session';
import { api } from './index';
import {
  analysisPollDelay,
  analysisRefetchInterval,
  createQueryClient,
  queryKeys,
  useAnalysis,
  useDecision,
} from './queries';

const { server } = createMockServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());

function setup() {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

async function demoSession() {
  const created = await api.request('createSession', { body: { mode: 'demo' } });
  saveSession(created);
  return created.sessionId;
}

const state = (
  data: AnalysisStatusResponse | undefined,
  dataUpdateCount: number,
  status: 'pending' | 'success' | 'error' = 'success',
) =>
  ({ state: { data, dataUpdateCount, status } }) as Parameters<typeof analysisRefetchInterval>[0];

describe('analysis polling (design §10)', () => {
  it('backs off from 1.5 s by ×1.5 per poll and caps at 5 s', () => {
    expect([0, 1, 2, 3, 4, 10].map(analysisPollDelay)).toEqual([
      1500, 2250, 3375, 5000, 5000, 5000,
    ]);
  });

  it('keeps polling while queued or running and stops on ready, failed, or error', () => {
    expect(analysisRefetchInterval(state({ status: 'queued' }, 1))).toBe(1500);
    expect(
      analysisRefetchInterval(state({ status: 'running', stage: 'checking_evidence' }, 3)),
    ).toBe(3375);
    expect(analysisRefetchInterval(state({ status: 'failed', errorCode: 'INTERNAL' }, 4))).toBe(
      false,
    );
    const ready = { status: 'ready' } as AnalysisStatusResponse;
    expect(analysisRefetchInterval(state(ready, 2))).toBe(false);
    expect(analysisRefetchInterval(state(undefined, 0, 'error'))).toBe(false);
  });

  it('loads the demo analysis through the hook', async () => {
    const sessionId = await demoSession();
    const { wrapper } = setup();
    const { result } = renderHook(() => useAnalysis(sessionId), { wrapper });
    await waitFor(() => expect(result.current.data?.status).toBe('ready'));
  });
});

describe('useDecision (optimistic with rollback)', () => {
  const decisionOf = (data: AnalysisStatusResponse | undefined, recId: string) =>
    data?.status === 'ready'
      ? data.evidenceMap.recommendations.find((r) => r.id === recId)?.decision
      : undefined;

  async function readyAnalysis() {
    const sessionId = await demoSession();
    const ctx = setup();
    const key = queryKeys.analysis(sessionId);
    await ctx.queryClient.fetchQuery({
      queryKey: key,
      queryFn: () => api.request('getAnalysis', { params: { sessionId } }),
    });
    const read = () => ctx.queryClient.getQueryData<AnalysisStatusResponse>(key);
    return { sessionId, read, ...ctx };
  }

  /** Hold the decision request until `release()` so the optimistic state can be observed. */
  function gateDecision(respond: () => Response | Promise<Response>) {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    server.use(
      http.post(mswPath(routes.decideRecommendation.path), async () => {
        await gate;
        return respond();
      }),
    );
    return () => release();
  }

  it('applies the decision immediately and rolls back when the server fails', async () => {
    const { sessionId, read, wrapper } = await readyAnalysis();
    const release = gateDecision(() => errorResponse('INTERNAL', 'Simulated failure.'));
    const { result } = renderHook(() => useDecision(sessionId), { wrapper });

    act(() => result.current.mutate({ recId: 'r1', decision: 'accept' }));
    await waitFor(() => expect(decisionOf(read(), 'r1')).toBe('accepted'));

    release();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(decisionOf(read(), 'r1')).toBe('pending');
    expect(result.current.error).toMatchObject({ code: 'INTERNAL', status: 500 });
  });

  it('keeps the server result on success', async () => {
    const { sessionId, read, wrapper } = await readyAnalysis();
    const { result } = renderHook(() => useDecision(sessionId), { wrapper });
    act(() => result.current.mutate({ recId: 'r2', decision: 'accept' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(decisionOf(read(), 'r2')).toBe('accepted');
    const data = read();
    expect(data?.status === 'ready' && data.evidenceMap.scores).toEqual(
      result.current.data?.scores,
    );
  });
});
