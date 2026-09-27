import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
} from '@tanstack/react-query';
import type {
  AnalysisRequest,
  AnalysisStatusResponse,
  AnswerRequest,
  ConfirmationRequest,
  DecisionRequest,
  SessionMode,
} from '@proof-and-poise/shared';
import { clearSession, saveSession } from '../session';
import { applyOptimisticDecision, mergeConfirmation, mergeDecision } from './cache';
import { isApiError, isRetryable } from './errors';
import { api } from './index';

export const queryKeys = {
  session: (sessionId: string) => ['session', sessionId] as const,
  analysis: (sessionId: string) => ['session', sessionId, 'analysis'] as const,
  interview: (sessionId: string) => ['session', sessionId, 'interview'] as const,
  report: (sessionId: string) => ['session', sessionId, 'report'] as const,
};

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Only transient failures are retried; 4xx and contract mismatches won't change.
        retry: (failures, error) => failures < 2 && isRetryable(error),
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
      mutations: { retry: false },
    },
  });
}

// --- Analysis polling (design §10) ---------------------------------------------

/** Backoff for analysis polling: 1.5 s, growing ×1.5 per poll, capped at 5 s (design §10). */
export const ANALYSIS_POLL = { initialMs: 1_500, factor: 1.5, maxMs: 5_000 } as const;

export function analysisPollDelay(pollsSoFar: number): number {
  const n = Math.max(0, pollsSoFar);
  return Math.min(
    ANALYSIS_POLL.maxMs,
    Math.round(ANALYSIS_POLL.initialMs * ANALYSIS_POLL.factor ** n),
  );
}

/** `refetchInterval` for the analysis query: stop on ready, failed, or a request error. */
export function analysisRefetchInterval(
  query: Pick<Query<AnalysisStatusResponse>, 'state'>,
): number | false {
  const { data, status, dataUpdateCount } = query.state;
  if (status === 'error') return false;
  if (data?.status === 'ready' || data?.status === 'failed') return false;
  return analysisPollDelay(dataUpdateCount - 1);
}

export function useAnalysis(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.analysis(sessionId),
    queryFn: ({ signal }) => api.request('getAnalysis', { params: { sessionId }, signal }),
    refetchInterval: analysisRefetchInterval,
  });
}

export function useStartAnalysis(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AnalysisRequest) =>
      api.request('startAnalysis', { params: { sessionId }, body }),
    // Reset so polling restarts from the first backoff step.
    onSuccess: () => qc.resetQueries({ queryKey: queryKeys.analysis(sessionId) }),
  });
}

// --- Decisions and confirmations -------------------------------------------------

/** Accept, reject, or reset a recommendation, optimistically, with rollback on failure (design §10). */
export function useDecision(sessionId: string) {
  const qc = useQueryClient();
  const key = queryKeys.analysis(sessionId);
  return useMutation({
    mutationFn: ({ recId, decision }: { recId: string; decision: DecisionRequest['decision'] }) =>
      api.request('decideRecommendation', { params: { sessionId, recId }, body: { decision } }),
    onMutate: async ({ recId, decision }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<AnalysisStatusResponse>(key);
      qc.setQueryData<AnalysisStatusResponse>(key, (old) =>
        applyOptimisticDecision(old, recId, decision),
      );
      return { previous };
    },
    onError: (_error, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(key, ctx.previous);
    },
    onSuccess: (res) => {
      qc.setQueryData<AnalysisStatusResponse>(key, (old) => mergeDecision(old, res));
    },
  });
}

export function useConfirmation(sessionId: string) {
  const qc = useQueryClient();
  const key = queryKeys.analysis(sessionId);
  return useMutation({
    mutationFn: (body: ConfirmationRequest) =>
      api.request('createConfirmation', { params: { sessionId }, body }),
    onSuccess: (res) => {
      qc.setQueryData<AnalysisStatusResponse>(key, (old) => mergeConfirmation(old, res));
    },
  });
}

// --- Sessions ------------------------------------------------------------------

/** Create a session and store its credentials in sessionStorage before resolving (Req 2.3). */
export function useCreateSession() {
  return useMutation({
    mutationFn: async (mode: SessionMode) => {
      const created = await api.request('createSession', { body: { mode } });
      saveSession(created);
      return created;
    },
  });
}

export function useSessionSummary(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.session(sessionId),
    queryFn: ({ signal }) => api.request('getSession', { params: { sessionId }, signal }),
  });
}

/** "Delete my data" (Req 2.5): server delete, then forget the token and all cached data. */
export function useDeleteSession(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.request('deleteSession', { params: { sessionId } }),
    onSuccess: () => {
      clearSession();
      qc.clear();
    },
  });
}

// --- Interview -----------------------------------------------------------------

export function useInterview(sessionId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.interview(sessionId),
    queryFn: ({ signal }) => api.request('getInterview', { params: { sessionId }, signal }),
    enabled: options.enabled ?? true,
  });
}

export function useStartInterview(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.request('startInterview', { params: { sessionId } }),
    onSuccess: (state) => {
      qc.setQueryData(queryKeys.interview(sessionId), state);
      // Starting the interview moves the session to the interview stage; refresh the summary.
      void qc.invalidateQueries({ queryKey: queryKeys.session(sessionId), exact: true });
    },
  });
}

export function useSubmitAnswer(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ turnId, answer }: { turnId: string; answer: AnswerRequest }) =>
      api.request('submitAnswer', { params: { sessionId, turnId }, body: answer }),
    onSettled: (_res, error) => {
      // A 409 means the turn was already evaluated; refetch to show the stored result.
      if (!error || (isApiError(error) && error.code === 'CONFLICT')) {
        void qc.invalidateQueries({ queryKey: queryKeys.interview(sessionId) });
        void qc.invalidateQueries({ queryKey: queryKeys.analysis(sessionId) });
      }
    },
  });
}

export function useStartPractice(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (turnId: string) =>
      api.request('startPractice', { params: { sessionId }, body: { turnId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.interview(sessionId) }),
  });
}

// --- Report --------------------------------------------------------------------

export function useReport(sessionId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.report(sessionId),
    queryFn: ({ signal }) => api.request('getReport', { params: { sessionId }, signal }),
    enabled: options.enabled ?? true,
  });
}

export function useCreateReport(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.request('createReport', { params: { sessionId } }),
    onSuccess: (report) => qc.setQueryData(queryKeys.report(sessionId), report),
  });
}
