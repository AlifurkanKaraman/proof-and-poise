import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { TranscribeClient } from '@aws-sdk/client-transcribe';
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AnalysisStatusResponseSchema,
  CreateSessionResponseSchema,
  ErrorResponseSchema,
  LIMITS,
  PresignedPostResponseSchema,
  SessionSummarySchema,
} from '@proof-and-poise/shared';
import { createRouter } from '../app';
import { createLogger } from '../lib/logger';

const TABLE = 'proof-and-poise-test';
const BUCKET = 'proof-and-poise-test-uploads';
const IP = '203.0.113.9';
const NOW = Date.UTC(2026, 8, 28, 7, 30);

const ddbMock = mockClient(DynamoDBDocumentClient);
const s3Mock = mockClient(S3Client);

/** Minimal in-memory table keyed by PK/SK, enough for the session routes. */
let items: Map<string, Record<string, unknown>>;
let logLines: string[];
let now: number;
const k = (pk: unknown, sk: unknown) => `${String(pk)}|${String(sk)}`;

function router() {
  return createRouter(
    createLogger((l) => logLines.push(l)),
    {
      env: { TABLE_NAME: TABLE, BUCKET_NAME: BUCKET, WORKER_FUNCTION_NAME: 'worker-test' },
      clients: {
        ddb: DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' })),
        lambda: new LambdaClient({ region: 'us-east-1' }),
        transcribe: new TranscribeClient({ region: 'us-east-1' }),
        s3: new S3Client({
          region: 'us-east-1',
          credentials: { accessKeyId: 'test-key-id', secretAccessKey: 'test-secret' },
        }),
      },
      salt: () => Promise.resolve('s'.repeat(64)),
      now: () => now,
    },
  );
}

function event(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string } = {},
): APIGatewayProxyEventV2 {
  return {
    rawPath: path,
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    isBase64Encoded: false,
    requestContext: { requestId: 'req-test', http: { method, sourceIp: IP } },
  } as unknown as APIGatewayProxyEventV2;
}

const json = (body: string | undefined): unknown => JSON.parse(body ?? 'null');

beforeEach(() => {
  items = new Map();
  logLines = [];
  now = NOW;
  ddbMock.reset();
  s3Mock.reset();
  ddbMock.on(PutCommand).callsFake(({ Item }: { Item: Record<string, unknown> }) => {
    items.set(k(Item['PK'], Item['SK']), structuredClone(Item));
    return {};
  });
  ddbMock.on(GetCommand).callsFake(({ Key }: { Key: Record<string, unknown> }) => ({
    Item: items.get(k(Key['PK'], Key['SK'])),
  }));
  ddbMock.on(UpdateCommand).resolves({ Attributes: { count: 1 } });
  ddbMock.on(QueryCommand).callsFake(({ ExpressionAttributeValues }) => ({
    Items: [...items.values()]
      .filter((i) => i['PK'] === ExpressionAttributeValues[':pk'])
      .map((i) => ({ PK: i['PK'], SK: i['SK'] })),
  }));
  ddbMock.on(BatchWriteCommand).callsFake(({ RequestItems }) => {
    for (const r of RequestItems[TABLE])
      items.delete(k(r.DeleteRequest.Key.PK, r.DeleteRequest.Key.SK));
    return { UnprocessedItems: {} };
  });
  s3Mock.on(ListObjectsV2Command).callsFake(({ Prefix }: { Prefix: string }) => ({
    Contents: Prefix.startsWith('resumes/') ? [{ Key: `${Prefix}a.pdf` }] : [],
    IsTruncated: false,
  }));
  s3Mock.on(DeleteObjectsCommand).resolves({});
});

async function create(mode: 'demo' | 'standard') {
  const res = await router().handle(event('POST', '/v1/sessions', { body: { mode } }));
  expect(res.statusCode).toBe(201);
  return CreateSessionResponseSchema.parse(json(res.body));
}

describe('POST /v1/sessions (Req 2.1, 2.2, 2.4, 16.3)', () => {
  it('creates a standard session storing only the token hash and a ≤24 h ttl', async () => {
    const s = await create('standard');
    expect(Date.parse(s.expiresAt) - NOW).toBe(LIMITS.session.ttlHours * 3_600_000);
    const meta = items.get(k(`S#${s.sessionId}`, 'META'));
    expect(meta).toMatchObject({ mode: 'standard', stage: 'setup', quota_analyses: 0 });
    expect(meta?.['tokenHash']).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify([...items.values()])).not.toContain(s.sessionToken);
    expect(Number(meta?.['ttl'])).toBeLessThanOrEqual(NOW / 1000 + 24 * 3600);
    expect(items.has(k(`S#${s.sessionId}`, 'ANALYSIS'))).toBe(false);
  });

  it('seeds the precomputed demo analysis for demo sessions', async () => {
    const s = await create('demo');
    const analysis = items.get(k(`S#${s.sessionId}`, 'ANALYSIS'));
    const { PK: _pk, SK: _sk, ttl, ...rest } = analysis ?? {};
    expect(ttl).toBe(Math.floor(Date.parse(s.expiresAt) / 1000));
    const parsed = AnalysisStatusResponseSchema.parse(rest);
    expect(parsed).toMatchObject({ status: 'ready', precomputed: true });
  });

  it('rate-limits by salted IP hash and never stores or logs the raw IP', async () => {
    await create('standard');
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(input?.Key?.['PK']).toMatch(/^IP#[0-9a-f]{64}#2026092807$/);
    const everything = JSON.stringify([...items.values(), ...ddbMock.calls().map((c) => c.args)]);
    expect(everything).not.toContain(IP);
    expect(logLines.join('\n')).not.toContain(IP);
  });

  it('returns 429 QUOTA_EXCEEDED when the IP hourly cap is hit', async () => {
    ddbMock.on(UpdateCommand).rejects({ name: 'ConditionalCheckFailedException' });
    const res = await router().handle(event('POST', '/v1/sessions', { body: { mode: 'demo' } }));
    expect(res.statusCode).toBe(429);
    expect(ErrorResponseSchema.parse(json(res.body)).error.code).toBe('QUOTA_EXCEEDED');
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('rejects an invalid body with VALIDATION field codes and no echoed input', async () => {
    const res = await router().handle(
      event('POST', '/v1/sessions', { body: { mode: 'sneaky-value' } }),
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).not.toContain('sneaky-value');
    expect(ErrorResponseSchema.parse(json(res.body)).error.fields).toHaveProperty('mode');
  });
});

describe('session auth (Req 2.2)', () => {
  it('GET returns the summary with the matching token', async () => {
    const s = await create('demo');
    const res = await router().handle(
      event('GET', `/v1/sessions/${s.sessionId}`, { token: s.sessionToken }),
    );
    expect(res.statusCode).toBe(200);
    expect(SessionSummarySchema.parse(json(res.body))).toEqual({
      sessionId: s.sessionId,
      mode: 'demo',
      stage: 'analysis',
      expiresAt: s.expiresAt,
    });
  });

  it('returns an identical 401 for missing, wrong, unknown-session, and expired tokens', async () => {
    const s = await create('standard');
    const other = await create('standard');
    const cases = [
      event('GET', `/v1/sessions/${s.sessionId}`),
      event('GET', `/v1/sessions/${s.sessionId}`, { token: other.sessionToken }),
      event('GET', `/v1/sessions/${crypto.randomUUID()}`, { token: s.sessionToken }),
      event('GET', '/v1/sessions/not-a-uuid', { token: s.sessionToken }),
    ];
    const bodies = new Set<string>();
    for (const e of cases) {
      const res = await router().handle(e);
      expect(res.statusCode).toBe(401);
      bodies.add(res.body ?? '');
    }
    now = NOW + LIMITS.session.ttlHours * 3_600_000;
    const expired = await router().handle(
      event('GET', `/v1/sessions/${s.sessionId}`, { token: s.sessionToken }),
    );
    expect(expired.statusCode).toBe(401);
    bodies.add(expired.body ?? '');
    expect(bodies.size).toBe(1);
    expect(logLines.join('\n')).not.toContain(s.sessionToken);
  });
});

describe('DELETE /v1/sessions/{id} (Req 2.5)', () => {
  it('deletes all session items and S3 prefixes, then the token returns 401', async () => {
    const s = await create('demo');
    const keep = await create('standard');
    const del = await router().handle(
      event('DELETE', `/v1/sessions/${s.sessionId}`, { token: s.sessionToken }),
    );
    expect(del.statusCode).toBe(204);
    expect(del.body).toBeUndefined();
    expect([...items.keys()].some((key) => key.startsWith(`S#${s.sessionId}|`))).toBe(false);
    expect(items.has(k(`S#${keep.sessionId}`, 'META'))).toBe(true);

    const prefixes = s3Mock.commandCalls(ListObjectsV2Command).map((c) => c.args[0].input.Prefix);
    expect(prefixes.sort()).toEqual(
      ['audio', 'resumes', 'transcripts'].map((p) => `${p}/${s.sessionId}/`),
    );
    expect(s3Mock.commandCalls(DeleteObjectsCommand)[0]?.args[0].input).toMatchObject({
      Bucket: BUCKET,
      Delete: { Objects: [{ Key: `resumes/${s.sessionId}/a.pdf` }] },
    });

    const after = await router().handle(
      event('GET', `/v1/sessions/${s.sessionId}`, { token: s.sessionToken }),
    );
    expect(after.statusCode).toBe(401);
  });

  it('still returns 204 when S3 cleanup fails (best effort)', async () => {
    const s = await create('standard');
    s3Mock.on(ListObjectsV2Command).rejects(new Error('AccessDenied for key resumes/x'));
    const del = await router().handle(
      event('DELETE', `/v1/sessions/${s.sessionId}`, { token: s.sessionToken }),
    );
    expect(del.statusCode).toBe(204);
    expect(logLines.join('\n')).not.toContain('AccessDenied for key');
  });
});

describe('POST /v1/sessions/{id}/uploads/resume (Req 4.1)', () => {
  it('issues a ≤300 s POST policy pinned to a session key, PDF type, and size range', async () => {
    const s = await create('standard');
    const res = await router().handle(
      event('POST', `/v1/sessions/${s.sessionId}/uploads/resume`, {
        token: s.sessionToken,
        body: { contentType: 'application/pdf', size: 120_000 },
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = PresignedPostResponseSchema.parse(json(res.body));
    expect(body.expiresIn).toBe(300);
    expect(body.key).toMatch(new RegExp(`^resumes/${s.sessionId}/[0-9a-f-]{36}\\.pdf$`));
    expect(body.fields['key']).toBe(body.key);
    expect(body.fields['Content-Type']).toBe('application/pdf');

    const policy = JSON.parse(
      Buffer.from(body.fields['Policy'] ?? '', 'base64').toString('utf8'),
    ) as { expiration: string; conditions: unknown[] };
    expect(Date.parse(policy.expiration) - Date.now()).toBeLessThanOrEqual(300_000);
    expect(policy.conditions).toEqual(
      expect.arrayContaining([
        ['content-length-range', 1, 5_242_880],
        ['eq', '$Content-Type', 'application/pdf'],
        { key: body.key },
        { bucket: BUCKET },
      ]),
    );
  });

  it('rejects non-PDF or oversized requests and unauthenticated callers', async () => {
    const s = await create('standard');
    const path = `/v1/sessions/${s.sessionId}/uploads/resume`;
    const bad = await router().handle(
      event('POST', path, { token: s.sessionToken, body: { contentType: 'text/html', size: 10 } }),
    );
    expect(bad.statusCode).toBe(400);
    const big = await router().handle(
      event('POST', path, {
        token: s.sessionToken,
        body: { contentType: 'application/pdf', size: 5_242_881 },
      }),
    );
    expect(big.statusCode).toBe(400);
    const anon = await router().handle(
      event('POST', path, { body: { contentType: 'application/pdf', size: 10 } }),
    );
    expect(anon.statusCode).toBe(401);
  });
});
