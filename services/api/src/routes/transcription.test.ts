import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  BadRequestException,
  DeleteTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  StartTranscriptionJobCommand,
  TranscribeClient,
} from '@aws-sdk/client-transcribe';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ErrorResponseSchema,
  LIMITS,
  PresignedPostResponseSchema,
  TranscriptionStatusResponseSchema,
} from '@proof-and-poise/shared';
import { createRouter } from '../app';
import { generateSessionToken, hashToken } from '../lib/auth';
import { createLogger } from '../lib/logger';
import { MemoryTable } from '../test/memoryTable';

const TABLE = 'proof-and-poise-test';
const BUCKET = 'proof-and-poise-test-uploads';
const NOW = Date.UTC(2026, 8, 28, 9, 0);
const SESSION_ID = '0b6c4a52-8d0e-4f3e-9a51-2f4d3c1b7e90';
const OTHER_SESSION = '7c1d2e3f-0a9b-4c8d-b7e6-5f4a3b2c1d0e';
const TURN = 't1';
const AUDIO_KEY = `audio/${SESSION_ID}/5f0e2c1a-1b2c-4d3e-8f9a-0b1c2d3e4f5a.webm`;
const BASE = `/v1/sessions/${SESSION_ID}/turns/${TURN}`;

const ddbMock = mockClient(DynamoDBDocumentClient);
const s3Mock = mockClient(S3Client);
const transcribeMock = mockClient(TranscribeClient);

const creds = { accessKeyId: 'test-key-id', secretAccessKey: 'test-secret' };
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

let table: MemoryTable;
let logLines: string[];
let token: string;

function seedSession(overrides: Record<string, unknown> = {}) {
  token = generateSessionToken();
  const ttl = Math.floor(NOW / 1000) + LIMITS.session.ttlHours * 3600;
  table.put({
    PK: `S#${SESSION_ID}`,
    SK: 'META',
    sessionId: SESSION_ID,
    tokenHash: hashToken(token),
    mode: 'standard',
    stage: 'interview',
    createdAt: new Date(NOW).toISOString(),
    expiresAt: new Date(ttl * 1000).toISOString(),
    ttl,
    quota_transcriptions: 0,
    ...overrides,
  });
}

function router() {
  return createRouter(
    createLogger((l) => logLines.push(l)),
    {
      env: { TABLE_NAME: TABLE, BUCKET_NAME: BUCKET, WORKER_FUNCTION_NAME: 'worker-test' },
      clients: {
        ddb,
        s3: new S3Client({ region: 'us-east-1', credentials: creds }),
        lambda: new LambdaClient({ region: 'us-east-1', credentials: creds }),
        transcribe: new TranscribeClient({ region: 'us-east-1', credentials: creds }),
      },
      salt: () => Promise.resolve('s'.repeat(64)),
      now: () => NOW,
    },
  );
}

function event(method: string, path: string, body?: unknown, auth = true): APIGatewayProxyEventV2 {
  return {
    rawPath: path,
    headers: auth ? { authorization: `Bearer ${token}` } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
    isBase64Encoded: false,
    requestContext: { requestId: 'req-test', http: { method, sourceIp: '203.0.113.9' } },
  } as unknown as APIGatewayProxyEventV2;
}

async function call(method: string, path: string, body?: unknown, auth = true) {
  const res = await router().handle(event(method, path, body, auth));
  return { status: res.statusCode, body: JSON.parse(res.body ?? 'null') as unknown };
}

const startBody = { key: AUDIO_KEY, durationSec: 42.2 };
const start = (body: unknown = startBody) => call('POST', `${BASE}/transcription`, body);
const poll = () => call('GET', `${BASE}/transcription`);

const transcriptJson = (text: string) =>
  JSON.stringify({ results: { transcripts: [{ transcript: text }] } });
const s3Body = (text: string) => ({ Body: { transformToString: () => Promise.resolve(text) } });

const jobStatus = (status: string) =>
  ({ TranscriptionJob: { TranscriptionJobStatus: status } }) as never;

const sentTo = (mock: typeof s3Mock | typeof transcribeMock, name: string) =>
  mock.calls().filter((c) => c.args[0].constructor.name === name);

beforeEach(() => {
  ddbMock.reset();
  s3Mock.reset();
  transcribeMock.reset();
  table = new MemoryTable();
  table.attach(ddbMock);
  logLines = [];
  seedSession();
  s3Mock.on(DeleteObjectCommand).resolves({});
  transcribeMock.on(StartTranscriptionJobCommand).resolves({});
  transcribeMock.on(DeleteTranscriptionJobCommand).resolves({});
});

describe('POST …/uploads/audio (Req 10.4)', () => {
  it('returns a presigned POST for an audio key under the session prefix', async () => {
    const res = await call('POST', `${BASE}/uploads/audio`, {
      contentType: 'audio/webm',
      size: 500_000,
    });
    expect(res.status).toBe(200);
    const body = PresignedPostResponseSchema.parse(res.body);
    expect(body.key).toMatch(new RegExp(`^audio/${SESSION_ID}/[0-9a-f-]{36}\\.webm$`));
    expect(body.expiresIn).toBe(LIMITS.audioUpload.presignExpiresSec);
    expect(body.fields['Content-Type']).toBe('audio/webm');
  });

  it.each([
    ['a disallowed content type', { contentType: 'audio/wav', size: 1000 }],
    ['an oversized recording', { contentType: 'audio/mp4', size: LIMITS.audioUpload.maxBytes + 1 }],
  ])('rejects %s with 400', async (_name, body) => {
    const res = await call('POST', `${BASE}/uploads/audio`, body);
    expect(res.status).toBe(400);
    expect(ErrorResponseSchema.parse(res.body).error.code).toBe('VALIDATION');
  });

  it('requires the session token', async () => {
    const res = await call(
      'POST',
      `${BASE}/uploads/audio`,
      { contentType: 'audio/ogg', size: 10 },
      false,
    );
    expect(res.status).toBe(401);
  });
});

describe('POST …/transcription (Req 10.4, 16.4)', () => {
  it('starts a batch job with the documented settings and spends both budgets', async () => {
    const res = await start();
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ status: 'transcribing' });

    const [call0] = sentTo(transcribeMock, 'StartTranscriptionJobCommand');
    const input = call0?.args[0].input as Record<string, unknown>;
    expect(input).toMatchObject({
      Media: { MediaFileUri: `s3://${BUCKET}/${AUDIO_KEY}` },
      MediaFormat: 'webm',
      LanguageCode: LIMITS.transcribe.languageCode,
      OutputBucketName: BUCKET,
    });
    expect(input['IdentifyLanguage']).toBeUndefined();
    expect(String(input['OutputKey'])).toMatch(new RegExp(`^transcripts/${SESSION_ID}/`));

    expect(table.get(`S#${SESSION_ID}`, 'META')?.['quota_transcriptions']).toBe(1);
    expect(table.get('GLOBAL#20260928', 'BUDGET')?.['transcribeSeconds']).toBe(43);
  });

  it('rejects a key that was not issued for this session', async () => {
    const res = await start({ key: `audio/${OTHER_SESSION}/x.webm`, durationSec: 10 });
    expect(res.status).toBe(400);
    expect(ErrorResponseSchema.parse(res.body).error.fields).toEqual({ key: 'invalid_key' });
    expect(transcribeMock.calls()).toHaveLength(0);
  });

  it('rejects an unknown media extension and a recording over 120 s', async () => {
    expect((await start({ key: `audio/${SESSION_ID}/x.exe`, durationSec: 10 })).status).toBe(400);
    expect((await start({ key: AUDIO_KEY, durationSec: 121 })).status).toBe(400);
  });

  it('returns 409 for a second start while the first is running', async () => {
    expect((await start()).status).toBe(202);
    const res = await start();
    expect(res.status).toBe(409);
    expect(sentTo(transcribeMock, 'StartTranscriptionJobCommand')).toHaveLength(1);
  });

  it('returns 429 when the session transcription quota is used up', async () => {
    seedSession({ quota_transcriptions: LIMITS.quotas.transcriptions });
    const res = await start();
    expect(res.status).toBe(429);
    expect(transcribeMock.calls()).toHaveLength(0);
  });

  it('returns 503 CAPACITY_REACHED when the daily minute budget is used up', async () => {
    table.put({
      PK: 'GLOBAL#20260928',
      SK: 'BUDGET',
      transcribeSeconds: LIMITS.globalBudget.transcribeSecondsPerDay - 10,
    });
    const res = await start();
    expect(res.status).toBe(503);
    expect(ErrorResponseSchema.parse(res.body).error.code).toBe('CAPACITY_REACHED');
    expect(transcribeMock.calls()).toHaveLength(0);
  });

  it('maps an unreadable-audio rejection to 400 and lets the user retry', async () => {
    transcribeMock
      .on(StartTranscriptionJobCommand)
      .rejects(new BadRequestException({ message: 'bad', $metadata: {} }));
    const res = await start();
    expect(res.status).toBe(400);
    expect(table.get(`S#${SESSION_ID}`, `TRANSCRIPTION#${TURN}`)).toBeUndefined();
  });

  it('maps a Transcribe outage to 503 UPSTREAM_UNAVAILABLE', async () => {
    transcribeMock.on(StartTranscriptionJobCommand).rejects(new Error('boom'));
    const res = await start();
    expect(res.status).toBe(503);
    expect(ErrorResponseSchema.parse(res.body).error.code).toBe('UPSTREAM_UNAVAILABLE');
  });
});

describe('GET …/transcription (Req 10.6, 10.7)', () => {
  it('returns 404 when no transcription was started for the turn', async () => {
    expect((await poll()).status).toBe(404);
  });

  it('reports transcribing while the job is queued or running', async () => {
    await start();
    for (const status of ['QUEUED', 'IN_PROGRESS']) {
      transcribeMock.on(GetTranscriptionJobCommand).resolves(jobStatus(status));
      const res = await poll();
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'transcribing' });
    }
    expect(sentTo(s3Mock, 'DeleteObjectCommand')).toHaveLength(0);
  });

  it('returns the text, then deletes the audio, transcript, job, and record', async () => {
    await start();
    transcribeMock.on(GetTranscriptionJobCommand).resolves(jobStatus('COMPLETED'));
    s3Mock
      .on(GetObjectCommand)
      .resolves(s3Body(transcriptJson('  I led a migration of our billing service.  ')) as never);

    const res = await poll();
    expect(res.status).toBe(200);
    expect(TranscriptionStatusResponseSchema.parse(res.body)).toEqual({
      status: 'ready',
      text: 'I led a migration of our billing service.',
    });

    const deleted = sentTo(s3Mock, 'DeleteObjectCommand').map(
      (c) => (c.args[0].input as { Key: string }).Key,
    );
    expect(deleted).toContain(AUDIO_KEY);
    expect(deleted.some((k) => k.startsWith(`transcripts/${SESSION_ID}/`))).toBe(true);
    expect(sentTo(transcribeMock, 'DeleteTranscriptionJobCommand')).toHaveLength(1);
    expect(table.get(`S#${SESSION_ID}`, `TRANSCRIPTION#${TURN}`)).toBeUndefined();
    // The transcript never reaches the logs (Req 15).
    expect(logLines.join('\n')).not.toContain('billing service');
  });

  it('caps the returned text at the typed-answer maximum', async () => {
    await start();
    transcribeMock.on(GetTranscriptionJobCommand).resolves(jobStatus('COMPLETED'));
    s3Mock
      .on(GetObjectCommand)
      .resolves(s3Body(transcriptJson('a'.repeat(LIMITS.answer.max + 500))) as never);
    const res = TranscriptionStatusResponseSchema.parse((await poll()).body);
    expect(res.status === 'ready' && res.text.length).toBe(LIMITS.answer.max);
  });

  it('falls back to typing when the job fails, and keeps answering the same', async () => {
    await start();
    transcribeMock.on(GetTranscriptionJobCommand).resolves(jobStatus('FAILED'));
    const first = await poll();
    expect(first.body).toEqual({ status: 'failed', errorCode: 'UPSTREAM_UNAVAILABLE' });
    expect(sentTo(s3Mock, 'DeleteObjectCommand').length).toBeGreaterThan(0);

    transcribeMock.on(GetTranscriptionJobCommand).resolves(jobStatus('IN_PROGRESS'));
    expect((await poll()).body).toEqual({ status: 'failed', errorCode: 'UPSTREAM_UNAVAILABLE' });
  });

  it('treats an empty transcript (silence) as a failure with the typed fallback', async () => {
    await start();
    transcribeMock.on(GetTranscriptionJobCommand).resolves(jobStatus('COMPLETED'));
    s3Mock.on(GetObjectCommand).resolves(s3Body(transcriptJson('   ')) as never);
    expect((await poll()).body).toEqual({ status: 'failed', errorCode: 'EXTRACTION_FAILED' });
  });

  it('treats an unreadable transcript object as a failure', async () => {
    await start();
    transcribeMock.on(GetTranscriptionJobCommand).resolves(jobStatus('COMPLETED'));
    s3Mock.on(GetObjectCommand).resolves(s3Body('not json') as never);
    expect((await poll()).body).toEqual({ status: 'failed', errorCode: 'UPSTREAM_UNAVAILABLE' });
  });

  it('still returns the text when a cleanup step fails (the 1-day lifecycle removes leftovers)', async () => {
    await start();
    transcribeMock.on(GetTranscriptionJobCommand).resolves(jobStatus('COMPLETED'));
    transcribeMock.on(DeleteTranscriptionJobCommand).rejects(new Error('throttled'));
    s3Mock.on(GetObjectCommand).resolves(s3Body(transcriptJson('Short answer text.')) as never);
    const res = await poll();
    expect(res.body).toEqual({ status: 'ready', text: 'Short answer text.' });
    expect(logLines.some((l) => l.includes('transcription_cleanup_failed'))).toBe(true);
  });

  it('propagates a transient Transcribe error as 503 without failing the turn', async () => {
    await start();
    transcribeMock.on(GetTranscriptionJobCommand).rejects(new Error('timeout'));
    expect((await poll()).status).toBe(503);
    transcribeMock.on(GetTranscriptionJobCommand).resolves(jobStatus('IN_PROGRESS'));
    expect((await poll()).body).toEqual({ status: 'transcribing' });
  });

  it('allows a new attempt after a failure', async () => {
    await start();
    transcribeMock.on(GetTranscriptionJobCommand).resolves(jobStatus('FAILED'));
    await poll();
    expect((await start()).status).toBe(202);
  });
});
