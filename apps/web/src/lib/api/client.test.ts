import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import { createApiClient } from './client';

const SESSION_ID = '0b6f1f7e-2d3c-4a5b-8c9d-0e1f2a3b4c5d';
const TOKEN = 'a'.repeat(43);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function client(response: Response | Error, token: string | null = TOKEN) {
  const fetch = vi.fn<typeof globalThis.fetch>(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  const api = createApiClient({ baseUrl: 'https://api.test/', getToken: () => token, fetch });
  return { api, fetch };
}

async function rejection(p: Promise<unknown>): Promise<ApiError> {
  const e: unknown = await p.then(
    () => undefined,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(ApiError);
  return e as ApiError;
}

describe('createApiClient', () => {
  it('builds the URL, sends the bearer token, and returns the validated response', async () => {
    const summary = {
      sessionId: SESSION_ID,
      mode: 'demo',
      stage: 'analysis',
      expiresAt: '2026-10-01T12:00:00.000Z',
    };
    const { api, fetch } = client(json(summary));
    await expect(api.request('getSession', { params: { sessionId: SESSION_ID } })).resolves.toEqual(
      summary,
    );
    const [url, init] = fetch.mock.calls[0] ?? [];
    // A trailing slash on the base URL is tolerated; `/v1` comes from the contract path.
    expect(url).toBe(`https://api.test/v1/sessions/${SESSION_ID}`);
    expect(init?.method).toBe('GET');
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('turns a contract mismatch into a typed invalid_response error instead of crashing', async () => {
    const { api } = client(json({ status: 'ok', surprise: 1, sessionId: 'not-a-uuid' }));
    const e = await rejection(api.request('getSession', { params: { sessionId: SESSION_ID } }));
    expect(e).toMatchObject({ kind: 'invalid_response', code: 'INTERNAL', route: 'getSession' });
    expect(e.fields).toBeDefined();
  });

  it('treats a non-JSON success body as invalid_response', async () => {
    const { api } = client(new Response('<html>', { status: 200 }));
    const e = await rejection(api.request('health'));
    expect(e.kind).toBe('invalid_response');
  });

  it('maps a contract error body to its code, status, and fields', async () => {
    const { api } = client(
      json(
        { error: { code: 'VALIDATION', message: 'Invalid input.', fields: { text: 'too_small' } } },
        400,
      ),
    );
    const e = await rejection(
      api.request('submitAnswer', {
        params: { sessionId: SESSION_ID, turnId: 't1' },
        body: { text: 'A long enough answer for the schema.', source: 'typed', edited: false },
      }),
    );
    expect(e).toMatchObject({
      kind: 'http',
      code: 'VALIDATION',
      status: 400,
      fields: { text: 'too_small' },
    });
  });

  it('derives the code from the status when the error body is not the contract shape', async () => {
    const { api } = client(new Response('Too Many Requests', { status: 429 }));
    const e = await rejection(api.request('health'));
    expect(e).toMatchObject({ kind: 'http', code: 'QUOTA_EXCEEDED', status: 429 });
  });

  it('reports network failures as a network error', async () => {
    const { api } = client(new TypeError('Failed to fetch'));
    const e = await rejection(api.request('health'));
    expect(e).toMatchObject({ kind: 'network', code: 'UPSTREAM_UNAVAILABLE', status: null });
  });

  it('refuses session routes without a token and never calls fetch', async () => {
    const { api, fetch } = client(json({}), null);
    const e = await rejection(api.request('getAnalysis', { params: { sessionId: SESSION_ID } }));
    expect(e).toMatchObject({ kind: 'no_session', code: 'UNAUTHORIZED' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('validates the request body with the shared schema before sending', async () => {
    const { api, fetch } = client(json({}));
    const e = await rejection(
      api.request('createConfirmation', {
        params: { sessionId: SESSION_ID },
        body: { competencyId: 'c1', statement: 'too short', attested: true },
      }),
    );
    expect(e).toMatchObject({ kind: 'invalid_request', code: 'VALIDATION' });
    expect(e.fields).toEqual({ statement: 'too_small' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns null for 204 routes', async () => {
    const { api } = client(new Response(null, { status: 204 }));
    await expect(
      api.request('deleteSession', { params: { sessionId: SESSION_ID } }),
    ).resolves.toBeNull();
  });
});
