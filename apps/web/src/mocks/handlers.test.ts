import {
  DEMO_JOB,
  DEMO_RESUME_INPUT,
  DEMO_SAMPLE_ANSWERS,
  DEMO_SAMPLE_CONFIRMATION,
  ReportSchema,
  routes,
  type DemoTurnLabel,
  type RouteName,
} from '@proof-and-poise/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient, type RequestOptions, type RouteResponse } from '../lib/api/client';
import { ApiError } from '../lib/api/errors';
import { getSessionToken, saveSession } from '../lib/session';
import { parseMockFault, setMockFault } from './controls';
import { createMockServer } from './node';

let clock = Date.parse('2026-09-28T10:00:00.000Z');
const ANALYSIS_MS = 5_000;
const { server } = createMockServer({ now: () => clock, analysisMs: ANALYSIS_MS });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  setMockFault(null);
  sessionStorage.clear();
});
afterAll(() => server.close());

const called = new Set<RouteName>();
const raw = createApiClient({ baseUrl: 'http://api.test', getToken: getSessionToken });
// The real client validates every response against the contract, so each call below is
// also a schema check of the mock's fixture-backed output.
const api = {
  request<N extends RouteName>(name: N, options?: RequestOptions<N>): Promise<RouteResponse<N>> {
    called.add(name);
    return raw.request(name, options);
  },
};

async function apiError(p: Promise<unknown>): Promise<ApiError> {
  const e: unknown = await p.then(
    () => undefined,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(ApiError);
  return e as ApiError;
}

async function newSession(mode: 'demo' | 'standard') {
  const created = await api.request('createSession', { body: { mode } });
  saveSession(created);
  return created.sessionId;
}

describe('mock API handlers', () => {
  it('registers one handler per contract route plus the upload target', () => {
    expect(server.listHandlers()).toHaveLength(Object.keys(routes).length + 1);
  });

  it('serves the full demo journey with schema-valid fixture data on every route', async () => {
    await expect(api.request('health')).resolves.toEqual({ status: 'ok' });
    const sessionId = await newSession('demo');
    const p = { sessionId };

    await expect(api.request('getSession', { params: p })).resolves.toMatchObject({
      mode: 'demo',
      stage: 'analysis',
    });
    const upload = await api.request('presignResume', {
      params: p,
      body: { contentType: 'application/pdf', size: 1_000 },
    });
    expect(upload.key).toBe(`resumes/${sessionId}/resume.pdf`);

    const analysis = await api.request('getAnalysis', { params: p });
    if (analysis.status !== 'ready') throw new Error('demo analysis should be precomputed');
    expect(analysis.precomputed).toBe(true);
    expect(analysis.evidenceMap.competencies).toHaveLength(8);

    const decision = await api.request('decideRecommendation', {
      params: { ...p, recId: 'r1' },
      body: { decision: 'accept' },
    });
    expect(decision.recommendation.decision).toBe('accepted');
    // Rewording never changes Job Match (design §6.3).
    expect(decision.scores.jobMatch).toBe(analysis.evidenceMap.scores.jobMatch);

    const confirmation = await api.request('createConfirmation', {
      params: p,
      body: DEMO_SAMPLE_CONFIRMATION,
    });
    expect(confirmation.competency).toMatchObject({
      id: 'c8',
      strength: 'moderate',
      confirmationState: 'confirmed',
    });
    // Demo sessions get no rewrite, like the API (Req 13.2).
    expect(confirmation.recommendation).toBeUndefined();
    expect(confirmation.scoreEvent?.metric).toBe('jobMatch');
    expect(confirmation.scores.jobMatch).toBeGreaterThan(analysis.evidenceMap.scores.jobMatch);

    const started = await api.request('startInterview', { params: p });
    expect(started.turns).toHaveLength(1);
    // Idempotent (design §8).
    await expect(api.request('startInterview', { params: p })).resolves.toEqual(started);
    await expect(api.request('getInterview', { params: p })).resolves.toEqual(started);

    const t = { ...p, turnId: 't1' };
    await api.request('presignAudio', {
      params: t,
      body: { contentType: 'audio/webm', size: 1_000 },
    });
    await api.request('startTranscription', {
      params: t,
      body: { key: `audio/${sessionId}/t1.webm`, durationSec: 30 },
    });
    await expect(api.request('getTranscription', { params: t })).resolves.toEqual({
      status: 'transcribing',
    });
    await expect(api.request('getTranscription', { params: t })).resolves.toEqual({
      status: 'ready',
      text: DEMO_SAMPLE_ANSWERS['1'],
    });

    // Answer every turn; the vague answer to question 1 triggers exactly one follow-up.
    const labels: string[] = [];
    let turn = started.turns[0] ?? null;
    while (turn) {
      labels.push(turn.label);
      const res = await api.request('submitAnswer', {
        params: { ...p, turnId: turn.id },
        body: {
          text: DEMO_SAMPLE_ANSWERS[turn.label as DemoTurnLabel],
          source: 'typed',
          edited: false,
        },
      });
      expect(res.evaluation.feedbackSource).toBe('sample');
      turn = res.next;
    }
    expect(labels).toEqual(['1', '1a', '2', '3', '4', '5']);

    const duplicate = await apiError(
      api.request('submitAnswer', {
        params: t,
        body: { text: DEMO_SAMPLE_ANSWERS['1'], source: 'typed', edited: false },
      }),
    );
    expect(duplicate).toMatchObject({ code: 'CONFLICT', status: 409 });
    const locked = await apiError(
      api.request('decideRecommendation', {
        params: { ...p, recId: 'r2' },
        body: { decision: 'accept' },
      }),
    );
    expect(locked.code).toBe('CONFLICT');

    const report = await api.request('createReport', { params: p });
    expect(ReportSchema.safeParse(report).success).toBe(true);
    expect(report.questions).toHaveLength(5);
    await expect(api.request('createReport', { params: p })).resolves.toEqual(report);
    await expect(api.request('getReport', { params: p })).resolves.toEqual(report);

    const { turn: practice } = await api.request('startPractice', {
      params: p,
      body: { turnId: 't1' },
    });
    expect(practice).toMatchObject({ kind: 'practice', parentTurnId: 't1', label: '1' });
    // Like the API, an unanswered attempt is reused rather than spending another one.
    await expect(
      api.request('startPractice', { params: p, body: { turnId: 't1' } }),
    ).resolves.toEqual({ turn: practice });
    // The open attempt makes the stored report stale only once it is answered.
    await expect(api.request('getReport', { params: p })).resolves.toEqual(report);
    const practiced = await api.request('submitAnswer', {
      params: { ...p, turnId: practice.id },
      body: { text: DEMO_SAMPLE_ANSWERS['1a'], source: 'typed', edited: false },
    });
    expect(practiced.next).toBeNull();
    const after = await api.request('createReport', { params: p });
    const q1 = after.questions[0];
    expect(q1?.bestScore).toBeGreaterThan(q1?.originalScore ?? 4);

    await expect(api.request('deleteSession', { params: p })).resolves.toBeNull();
    const gone = await apiError(api.request('getSession', { params: p }));
    expect(gone).toMatchObject({ kind: 'http', code: 'UNAUTHORIZED', status: 401 });
  });

  it('rejects confirmations exactly like the API (Req 7.5, 8.1)', async () => {
    const sessionId = await newSession('demo');
    const p = { sessionId };
    const statement = 'I containerized three services with Docker and ran them on a k3s cluster.';
    // c4 "CI/CD pipelines" is moderate, so it can't be confirmed.
    const notEligible = await apiError(
      api.request('createConfirmation', {
        params: p,
        body: { competencyId: 'c4', statement, attested: true },
      }),
    );
    expect(notEligible).toMatchObject({
      code: 'VALIDATION',
      status: 400,
      fields: { competencyId: 'not_eligible' },
    });
    await api.request('startInterview', { params: p });
    const locked = await apiError(
      api.request('createConfirmation', {
        params: p,
        body: { competencyId: 'c8', statement, attested: true },
      }),
    );
    expect(locked).toMatchObject({ code: 'CONFLICT', status: 409 });
  });

  it('keeps score event ids unique after a confirmation and a decision', async () => {
    const sessionId = await newSession('demo');
    const p = { sessionId };
    await api.request('createConfirmation', { params: p, body: DEMO_SAMPLE_CONFIRMATION });
    await api.request('decideRecommendation', {
      params: { ...p, recId: 'r1' },
      body: { decision: 'accept' },
    });
    const analysis = await api.request('getAnalysis', { params: p });
    if (analysis.status !== 'ready') throw new Error('demo analysis should be ready');
    const ids = analysis.evidenceMap.scoreEvents.map((e) => e.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('moves a standard analysis through its stages to ready', async () => {
    const sessionId = await newSession('standard');
    const p = { sessionId };
    const notStarted = await apiError(api.request('getAnalysis', { params: p }));
    expect(notStarted.code).toBe('NOT_FOUND');

    await api.request('startAnalysis', {
      params: p,
      body: { resume: DEMO_RESUME_INPUT, job: DEMO_JOB },
    });
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await api.request('getAnalysis', { params: p });
      seen.push(res.status === 'running' ? res.stage : res.status);
      clock += ANALYSIS_MS / 5;
    }
    expect(seen).toEqual([
      'queued',
      'reading_resume',
      'mapping_competencies',
      'checking_evidence',
      'drafting_recommendations',
      'ready',
    ]);
  });

  it('covers every contract route in the journey tests', () => {
    expect([...called].sort()).toEqual(Object.keys(routes).sort());
  });

  it('rejects a wrong bearer token with 401 without revealing the session', async () => {
    const sessionId = await newSession('demo');
    const intruder = createApiClient({
      baseUrl: 'http://api.test',
      getToken: () => 'x'.repeat(43),
    });
    const e = await apiError(intruder.request('getSession', { params: { sessionId } }));
    expect(e).toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
  });

  it('rejects invalid request bodies with VALIDATION fields', async () => {
    const res = await fetch('http://api.test/v1/sessions', {
      method: 'POST',
      body: JSON.stringify({ mode: 'admin' }),
    });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'VALIDATION', fields: { mode: 'invalid_value' } },
    });
  });
});

describe('error toggle', () => {
  it('returns the chosen contract error on every route', async () => {
    setMockFault({ kind: 'CAPACITY_REACHED', route: null });
    const e = await apiError(api.request('health'));
    expect(e).toMatchObject({ kind: 'http', code: 'CAPACITY_REACHED', status: 503 });
  });

  it('scopes a fault to one route', async () => {
    const sessionId = await newSession('demo');
    setMockFault({ kind: 'UPSTREAM_UNAVAILABLE', route: 'getAnalysis' });
    await expect(api.request('getSession', { params: { sessionId } })).resolves.toBeTruthy();
    const e = await apiError(api.request('getAnalysis', { params: { sessionId } }));
    expect(e).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', status: 503 });
  });

  it('simulates network failures and contract mismatches', async () => {
    setMockFault({ kind: 'network', route: 'health' });
    expect((await apiError(api.request('health'))).kind).toBe('network');
    setMockFault({ kind: 'invalid_response', route: 'health' });
    expect((await apiError(api.request('health'))).kind).toBe('invalid_response');
  });

  it('parses the ?mockError toggle value', () => {
    expect(parseMockFault('QUOTA_EXCEEDED')).toEqual({ kind: 'QUOTA_EXCEEDED', route: null });
    expect(parseMockFault('getAnalysis:network')).toEqual({
      kind: 'network',
      route: 'getAnalysis',
    });
    expect(parseMockFault('off')).toBeNull();
    expect(parseMockFault(null)).toBeNull();
    expect(parseMockFault('nope')).toBeUndefined();
    expect(parseMockFault('unknownRoute:INTERNAL')).toBeUndefined();
  });
});
