import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { TranscribeClient } from '@aws-sdk/client-transcribe';
import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AnalysisStatusResponseSchema,
  DEMO_EVIDENCE_MAP,
  DEMO_JOB,
  DEMO_RESUME_TEXT,
  ErrorResponseSchema,
  LIMITS,
} from '@proof-and-poise/shared';
import { createRouter } from '../app';
import { ANALYZE_TOOL_NAME } from '../ai/prompts/analyze';
import { AnalysisRepository } from '../data/analysisRepository';
import { QuotaCounters } from '../data/quotas';
import { SessionRepository, type SessionMeta } from '../data/sessionRepository';
import { generateSessionToken, hashToken } from '../lib/auth';
import { createLogger } from '../lib/logger';
import { AnalysisWorker } from '../services/analysisWorker';
import { demoModelOutput } from '../test/fixtures';
import { MemoryTable } from '../test/memoryTable';
import { makePdf } from '../test/pdf';

const TABLE = 'proof-and-poise-test';
const BUCKET = 'proof-and-poise-test-uploads';
const WORKER = 'proof-and-poise-test-analysis-worker';
const NOW = Date.UTC(2026, 8, 28, 9, 0);
const SESSION_ID = '0b6c4a52-8d0e-4f3e-9a51-2f4d3c1b7e90';

const ddbMock = mockClient(DynamoDBDocumentClient);
const s3Mock = mockClient(S3Client);
const lambdaMock = mockClient(LambdaClient);
const bedrockMock = mockClient(BedrockRuntimeClient);

const creds = { accessKeyId: 'test-key-id', secretAccessKey: 'test-secret' };
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const s3 = new S3Client({ region: 'us-east-1', credentials: creds });

let table: MemoryTable;
let logLines: string[];
let now: number;
let token: string;

function seedSession(overrides: Partial<SessionMeta> = {}) {
  token = generateSessionToken();
  const ttl = Math.floor(NOW / 1000) + LIMITS.session.ttlHours * 3600;
  table.put({
    PK: `S#${SESSION_ID}`,
    SK: 'META',
    sessionId: SESSION_ID,
    tokenHash: hashToken(token),
    mode: 'standard',
    stage: 'setup',
    createdAt: new Date(NOW).toISOString(),
    expiresAt: new Date(ttl * 1000).toISOString(),
    ttl,
    quota_analyses: 0,
    ...overrides,
  });
}

const log = () => createLogger((l) => logLines.push(l));

function router() {
  return createRouter(log(), {
    env: { TABLE_NAME: TABLE, BUCKET_NAME: BUCKET, WORKER_FUNCTION_NAME: WORKER },
    clients: {
      ddb,
      s3,
      lambda: new LambdaClient({ region: 'us-east-1', credentials: creds }),
      transcribe: new TranscribeClient({ region: 'us-east-1', credentials: creds }),
    },
    salt: () => Promise.resolve('s'.repeat(64)),
    now: () => now,
  });
}

function worker() {
  const logger = log();
  return new AnalysisWorker({
    analyses: new AnalysisRepository(ddb, TABLE),
    sessions: new SessionRepository(ddb, TABLE),
    s3,
    bucketName: BUCKET,
    model: {
      bedrock: new BedrockRuntimeClient({ region: 'us-east-1', credentials: creds }),
      modelId: 'us.amazon.nova-lite-v1:0',
      quotas: new QuotaCounters(ddb, TABLE),
      log: logger,
      now: () => now,
    },
    log: logger,
    now: () => now,
  });
}

function event(method: string, path: string, body?: unknown): APIGatewayProxyEventV2 {
  return {
    rawPath: path,
    headers: { authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
    isBase64Encoded: false,
    requestContext: { requestId: 'req-test', http: { method, sourceIp: '203.0.113.9' } },
  } as unknown as APIGatewayProxyEventV2;
}

const PATH = `/v1/sessions/${SESSION_ID}/analysis`;
const post = (body: unknown) => router().handle(event('POST', PATH, body));
const get = async () => {
  const res = await router().handle(event('GET', PATH));
  return { status: res.statusCode, body: JSON.parse(res.body ?? 'null') as unknown };
};
const textRequest = { resume: { kind: 'text', text: DEMO_RESUME_TEXT }, job: DEMO_JOB };
const uploadKey = `resumes/${SESSION_ID}/5f0e2c1a-1b2c-4d3e-8f9a-0b1c2d3e4f5a.pdf`;

const toolReply = (input: unknown): ConverseCommandOutput =>
  ({
    output: {
      message: {
        role: 'assistant',
        content: [{ toolUse: { toolUseId: 't1', name: ANALYZE_TOOL_NAME, input } }],
      },
    },
    stopReason: 'tool_use',
    usage: { inputTokens: 3000, outputTokens: 1500, totalTokens: 4500 },
    $metadata: {},
  }) as ConverseCommandOutput;

/** The part of the SDK stream body the worker uses. */
const pdfBody = (bytes: Uint8Array) => ({ transformToByteArray: () => Promise.resolve(bytes) });

beforeEach(() => {
  ddbMock.reset();
  s3Mock.reset();
  lambdaMock.reset();
  bedrockMock.reset();
  table = new MemoryTable();
  table.attach(ddbMock);
  logLines = [];
  now = NOW;
  seedSession();
  lambdaMock.on(InvokeCommand).resolves({ StatusCode: 202 });
  s3Mock.on(DeleteObjectCommand).resolves({});
  bedrockMock.on(ConverseCommand).resolves(toolReply(demoModelOutput()));
});

describe('POST /v1/sessions/{id}/analysis (Req 5.1, 3.6, 16.2)', () => {
  it('queues the analysis, stores input, and invokes the worker with the session ID only', async () => {
    const res = await post(textRequest);
    expect(res.statusCode).toBe(202);
    expect(JSON.parse(res.body ?? '')).toEqual({ status: 'queued' });

    const [invoke] = lambdaMock.commandCalls(InvokeCommand);
    expect(invoke?.args[0].input).toMatchObject({ FunctionName: WORKER, InvocationType: 'Event' });
    const payload = new TextDecoder().decode(invoke?.args[0].input.Payload as Uint8Array);
    expect(JSON.parse(payload)).toEqual({ sessionId: SESSION_ID });

    expect(table.get(`S#${SESSION_ID}`, 'ANALYSIS')).toMatchObject({ status: 'queued' });
    expect(table.get(`S#${SESSION_ID}`, 'INPUT')).toMatchObject({
      resumeKind: 'text',
      resumeText: DEMO_RESUME_TEXT,
      job: { role: DEMO_JOB.role },
    });
    expect(table.get(`S#${SESSION_ID}`, 'META')).toMatchObject({
      stage: 'analysis',
      quota_analyses: 1,
    });
    expect((await get()).body).toEqual({ status: 'queued' });
  });

  it('rejects invalid input with 400 and never invokes the worker (Req 3.6)', async () => {
    const res = await post({ resume: { kind: 'text', text: 'too short' }, job: DEMO_JOB });
    expect(res.statusCode).toBe(400);
    expect(ErrorResponseSchema.parse(JSON.parse(res.body ?? '')).error.fields).toHaveProperty(
      'resume.text',
    );
    expect(lambdaMock.commandCalls(InvokeCommand)).toHaveLength(0);
  });

  it("rejects an upload key from another session's prefix (Req 4.3)", async () => {
    const res = await post({
      resume: { kind: 'upload', key: 'resumes/other-session/x.pdf' },
      job: DEMO_JOB,
    });
    expect(res.statusCode).toBe(400);
    expect(lambdaMock.commandCalls(InvokeCommand)).toHaveLength(0);
  });

  it('returns 409 while an analysis is in progress, without consuming quota', async () => {
    await post(textRequest);
    const res = await post(textRequest);
    expect(res.statusCode).toBe(409);
    expect(table.get(`S#${SESSION_ID}`, 'META')).toMatchObject({ quota_analyses: 1 });
  });

  it('enforces the per-session analysis quota (Req 16.2)', async () => {
    table.put({ ...table.get(`S#${SESSION_ID}`, 'META'), quota_analyses: LIMITS.quotas.analyses });
    expect((await post(textRequest)).statusCode).toBe(429);
  });

  it('returns 409 for demo sessions, which use the precomputed analysis', async () => {
    seedSession({ mode: 'demo', stage: 'analysis' });
    expect((await post(textRequest)).statusCode).toBe(409);
  });

  it('marks the analysis failed and returns 503 when the worker invoke fails', async () => {
    lambdaMock.on(InvokeCommand).rejects(new Error('boom'));
    expect((await post(textRequest)).statusCode).toBe(503);
    expect((await get()).body).toEqual({ status: 'failed', errorCode: 'UPSTREAM_UNAVAILABLE' });
  });

  it('requires the session token', async () => {
    const res = await router().handle({
      ...event('POST', PATH, textRequest),
      headers: {},
    } as APIGatewayProxyEventV2);
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /v1/sessions/{id}/analysis', () => {
  it('returns 404 before any analysis exists', async () => {
    expect((await get()).status).toBe(404);
  });

  it('reports a stale queued analysis as failed so the client can retry (Req 5.5)', async () => {
    await post(textRequest);
    now = NOW + (LIMITS.analysis.staleAfterSec + 1) * 1000;
    expect((await get()).body).toEqual({ status: 'failed', errorCode: 'UPSTREAM_UNAVAILABLE' });
  });
});

describe('analysis worker (Req 4.3–4.5, 5.2–5.4, 6.1)', () => {
  it('runs pasted text end to end and serves a schema-valid ready map', async () => {
    await post(textRequest);
    await worker().run(SESSION_ID);
    const { status, body } = await get();
    expect(status).toBe(200);
    const parsed = AnalysisStatusResponseSchema.parse(body);
    expect(parsed).toMatchObject({ status: 'ready', truncated: false, precomputed: false });
    if (parsed.status !== 'ready') throw new Error('not ready');
    expect(parsed.evidenceMap.scores).toEqual(DEMO_EVIDENCE_MAP.scores);
    expect(parsed.evidenceMap.parseability.inputKind).toBe('text');
    // Budget was reserved for the call (Req 16.4).
    expect(table.get(`GLOBAL#20260928`, 'BUDGET')).toMatchObject({ bedrockCalls: 1 });
    // Logs carry counts and token usage only.
    const out = logLines.join('\n');
    expect(out).not.toContain('Amara');
    expect(out).toContain('"discardedQuotes":0');
  });

  it('reads the PDF, deletes it, stores the extracted text, and analyzes it', async () => {
    const lines = DEMO_RESUME_TEXT.split('\n').filter((l) => l.trim() !== '');
    s3Mock.on(GetObjectCommand).resolves({ Body: pdfBody(makePdf([lines])) as never });
    await post({ resume: { kind: 'upload', key: uploadKey }, job: DEMO_JOB });
    await worker().run(SESSION_ID);

    expect(s3Mock.commandCalls(DeleteObjectCommand)[0]?.args[0].input).toEqual({
      Bucket: BUCKET,
      Key: uploadKey,
    });
    const input = table.get(`S#${SESSION_ID}`, 'INPUT');
    expect(input?.['resumeKey']).toBeUndefined();
    expect(String(input?.['resumeText'])).toContain('Built a Python AWS Lambda function');
    const parsed = AnalysisStatusResponseSchema.parse((await get()).body);
    if (parsed.status !== 'ready') throw new Error('not ready');
    expect(parsed.evidenceMap.parseability.inputKind).toBe('pdf');
    // Quotes were grounded against the extracted text (en dashes became hyphens in the PDF).
    expect(parsed.evidenceMap.competencies[0]?.evidence.length).toBeGreaterThan(0);
  });

  it('deletes the upload even when extraction fails, and fails recoverably (Req 4.3–4.4)', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: pdfBody(new TextEncoder().encode('not a pdf at all'.repeat(20))) as never,
    });
    await post({ resume: { kind: 'upload', key: uploadKey }, job: DEMO_JOB });
    await worker().run(SESSION_ID);
    expect(s3Mock.commandCalls(DeleteObjectCommand)).toHaveLength(1);
    expect((await get()).body).toEqual({ status: 'failed', errorCode: 'EXTRACTION_FAILED' });
    expect(bedrockMock.commandCalls(ConverseCommand)).toHaveLength(0);
  });

  it('fails with EXTRACTION_FAILED when the upload never arrived', async () => {
    s3Mock.on(GetObjectCommand).rejects(new NoSuchKey({ message: 'nope', $metadata: {} }));
    await post({ resume: { kind: 'upload', key: uploadKey }, job: DEMO_JOB });
    await worker().run(SESSION_ID);
    expect(s3Mock.commandCalls(DeleteObjectCommand)).toHaveLength(1);
    expect((await get()).body).toEqual({ status: 'failed', errorCode: 'EXTRACTION_FAILED' });
  });

  it('stores no partial output when the model fails validation twice (Req 5.3)', async () => {
    bedrockMock.on(ConverseCommand).resolves(toolReply({ competencies: 'nope' }));
    await post(textRequest);
    await worker().run(SESSION_ID);
    const stored = table.get(`S#${SESSION_ID}`, 'ANALYSIS');
    expect(stored).toMatchObject({ status: 'failed', errorCode: 'MODEL_OUTPUT_INVALID' });
    expect(stored).not.toHaveProperty('evidenceMap');
    expect(bedrockMock.commandCalls(ConverseCommand)).toHaveLength(2);
  });

  it('fails with CAPACITY_REACHED when the daily Bedrock budget is spent (Req 16.4)', async () => {
    table.put({
      PK: 'GLOBAL#20260928',
      SK: 'BUDGET',
      bedrockCalls: LIMITS.globalBudget.bedrockCallsPerDay,
    });
    await post(textRequest);
    await worker().run(SESSION_ID);
    expect((await get()).body).toEqual({ status: 'failed', errorCode: 'CAPACITY_REACHED' });
    expect(bedrockMock.commandCalls(ConverseCommand)).toHaveLength(0);
  });

  it('truncates resume text over the limit and flags it (Req 4.5)', async () => {
    const long = `${DEMO_RESUME_TEXT}\n${'Additional coursework and activities. '.repeat(400)}`;
    const lines = long.split('\n').flatMap((l) => l.match(/.{1,90}(?:\s|$)/g) ?? []);
    const pages = [0, 1, 2, 3].map((p) => lines.slice(p * 55, (p + 1) * 55));
    s3Mock.on(GetObjectCommand).resolves({ Body: pdfBody(makePdf(pages)) as never });
    await post({ resume: { kind: 'upload', key: uploadKey }, job: DEMO_JOB });
    await worker().run(SESSION_ID);
    const parsed = AnalysisStatusResponseSchema.parse((await get()).body);
    if (parsed.status !== 'ready') throw new Error(`not ready: ${JSON.stringify(parsed)}`);
    expect(parsed.truncated).toBe(true);
    expect(parsed.resumeText.length).toBe(LIMITS.resumeText.max);
    const sent =
      bedrockMock.commandCalls(ConverseCommand)[0]?.args[0].input.messages?.[0]?.content?.[0]?.text;
    expect(sent?.length).toBeLessThan(LIMITS.resumeText.max + DEMO_JOB.description.length + 500);
  });

  it('ignores deliveries for analyses that are not queued (async retry safety)', async () => {
    await post(textRequest);
    await worker().run(SESSION_ID);
    await worker().run(SESSION_ID);
    expect(bedrockMock.commandCalls(ConverseCommand)).toHaveLength(1);
  });
});
