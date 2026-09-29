import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { S3Client } from '@aws-sdk/client-s3';
import { TranscribeClient } from '@aws-sdk/client-transcribe';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEMO_EVIDENCE_MAP,
  DEMO_QUESTION_CANDIDATES,
  DEMO_REPORT_NARRATIVE,
  DEMO_RESUME_TEXT,
  DEMO_SAMPLE_FEEDBACK_OUTPUT,
  ErrorResponseSchema,
  InterviewStateSchema,
  LIMITS,
  PracticeResponseSchema,
  ReportSchema,
  type EvaluationModelOutput,
  type ReportNarrativeModelOutput,
} from '@proof-and-poise/shared';
import { createRouter } from '../app';
import { GENERATE_QUESTIONS_TOOL_NAME } from '../ai/prompts/generateQuestions';
import { REPORT_NARRATIVE_TOOL_NAME } from '../ai/prompts/reportNarrative';
import { generateSessionToken, hashToken } from '../lib/auth';
import { createLogger } from '../lib/logger';
import type { SessionMeta } from '../data/sessionRepository';
import { MemoryTable } from '../test/memoryTable';

const TABLE = 'proof-and-poise-test';
const NOW = Date.UTC(2026, 8, 29, 9, 0);
const SESSION_ID = '0b6c4a52-8d0e-4f3e-9a51-2f4d3c1b7e90';
const ANSWER = {
  text: 'At my internship I traced a failing checkout Lambda to a missing field and fixed it.',
  source: 'typed',
  edited: false,
} as const;

const ddbMock = mockClient(DynamoDBDocumentClient);
const bedrockMock = mockClient(BedrockRuntimeClient);
const creds = { accessKeyId: 'test-key-id', secretAccessKey: 'test-secret' };

let table: MemoryTable;
let token: string;
let evalOutput: EvaluationModelOutput;
let narrative: ReportNarrativeModelOutput;

function seedSession(overrides: Partial<SessionMeta> = {}) {
  token = generateSessionToken();
  const ttl = Math.floor(NOW / 1000) + LIMITS.session.ttlHours * 3600;
  table.put({
    PK: `S#${SESSION_ID}`,
    SK: 'META',
    sessionId: SESSION_ID,
    tokenHash: hashToken(token),
    mode: 'standard',
    stage: 'analysis',
    createdAt: new Date(NOW).toISOString(),
    expiresAt: new Date(ttl * 1000).toISOString(),
    ttl,
    ...Object.fromEntries(Object.keys(LIMITS.quotas).map((q) => [`quota_${q}`, 0])),
    ...overrides,
  });
}

const seedAnalysis = () =>
  table.put({
    PK: `S#${SESSION_ID}`,
    SK: 'ANALYSIS',
    status: 'ready',
    evidenceMap: structuredClone(DEMO_EVIDENCE_MAP),
    resumeText: DEMO_RESUME_TEXT,
    truncated: false,
    precomputed: false,
    ttl: 1,
  });

function router() {
  return createRouter(
    createLogger(() => undefined),
    {
      env: {
        TABLE_NAME: TABLE,
        BUCKET_NAME: 'proof-and-poise-test-uploads',
        WORKER_FUNCTION_NAME: 'worker-test',
        MODEL_ID: 'us.amazon.nova-lite-v1:0',
      },
      clients: {
        ddb: DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' })),
        s3: new S3Client({ region: 'us-east-1', credentials: creds }),
        lambda: new LambdaClient({ region: 'us-east-1', credentials: creds }),
        bedrock: new BedrockRuntimeClient({ region: 'us-east-1', credentials: creds }),
        transcribe: new TranscribeClient({ region: 'us-east-1', credentials: creds }),
      },
      salt: () => Promise.resolve('s'.repeat(64)),
      now: () => NOW,
    },
  );
}

async function call(method: 'GET' | 'POST', path: string, body?: unknown) {
  const event = {
    rawPath: `/v1/sessions/${SESSION_ID}${path}`,
    headers: { authorization: `Bearer ${token}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    isBase64Encoded: false,
    requestContext: { requestId: 'req-test', http: { method, sourceIp: '203.0.113.9' } },
  } as unknown as APIGatewayProxyEventV2;
  const res = await router().handle(event);
  return { status: res.statusCode, body: JSON.parse(res.body ?? 'null') as unknown };
}

const errorCode = (body: unknown) => ErrorResponseSchema.parse(body).error.code;
const meta = () => table.get(`S#${SESSION_ID}`, 'META') as Record<string, unknown>;
const answer = (turnId: string) => call('POST', `/turns/${turnId}/answer`, ANSWER);
const practice = (turnId: string) => call('POST', '/practice', { turnId });

const toolReply = (name: string, input: unknown): ConverseCommandOutput =>
  ({
    output: {
      message: { role: 'assistant', content: [{ toolUse: { toolUseId: 't1', name, input } }] },
    },
    stopReason: 'tool_use',
    usage: { inputTokens: 900, outputTokens: 120, totalTokens: 1020 },
    $metadata: {},
  }) as ConverseCommandOutput;

const converseTools = () =>
  bedrockMock
    .commandCalls(ConverseCommand)
    .map(
      (c) =>
        (c.args[0].input.toolConfig?.tools?.[0] as { toolSpec?: { name?: string } } | undefined)
          ?.toolSpec?.name,
    );

/** Answers every revealed question, in order, until the interview completes. */
async function finishInterview() {
  await call('POST', '/interview');
  for (let i = 0; i < 12; i++) {
    const state = InterviewStateSchema.parse((await call('GET', '/interview')).body);
    if (state.status === 'complete') return state;
    const open = state.turns.find((t) => t.status === 'asked');
    if (!open) throw new Error('no open turn');
    expect((await answer(open.id)).status).toBe(200);
  }
  throw new Error('interview did not complete');
}

const weak = (): EvaluationModelOutput => {
  const o = structuredClone(DEMO_SAMPLE_FEEDBACK_OUTPUT['1']);
  o.candidateFollowUp = null;
  return o;
};

beforeEach(() => {
  ddbMock.reset();
  bedrockMock.reset();
  table = new MemoryTable();
  table.attach(ddbMock);
  seedSession();
  seedAnalysis();
  evalOutput = weak();
  narrative = structuredClone(DEMO_REPORT_NARRATIVE);
  bedrockMock.on(ConverseCommand).callsFake((input: { toolConfig?: unknown }) => {
    const name = (input.toolConfig as { tools: { toolSpec: { name: string } }[] }).tools[0]!
      .toolSpec.name;
    if (name === GENERATE_QUESTIONS_TOOL_NAME) return toolReply(name, DEMO_QUESTION_CANDIDATES);
    if (name === REPORT_NARRATIVE_TOOL_NAME) return toolReply(name, narrative);
    return toolReply(name, evalOutput);
  });
});

describe('POST/GET …/report (Req 12.1, 12.2, 12.5)', () => {
  it('needs an interview, and a finished one', async () => {
    expect(errorCode((await call('POST', '/report')).body)).toBe('NOT_FOUND');
    await call('POST', '/interview');
    expect(errorCode((await call('POST', '/report')).body)).toBe('CONFLICT');
    expect(errorCode((await call('GET', '/report')).body)).toBe('NOT_FOUND');
  });

  it('builds a schema-valid report with computed numbers and three ordered actions', async () => {
    await finishInterview();
    bedrockMock.resetHistory();
    const res = await call('POST', '/report');
    expect(res.status).toBe(200);
    const report = ReportSchema.parse(res.body);
    expect(report.actions.map((a) => a.priority)).toEqual([1, 2, 3]);
    expect(report.readiness.performanceWeight).toBe(0.7);
    expect(report.questions).toHaveLength(LIMITS.interview.primaryQuestions);
    expect(converseTools()).toEqual([REPORT_NARRATIVE_TOOL_NAME]);
    expect(meta()['quota_reports']).toBe(1);
    expect(meta()['stage']).toBe('report');
  });

  it('is idempotent: the stored report is returned without another model call or quota', async () => {
    await finishInterview();
    const first = await call('POST', '/report');
    bedrockMock.resetHistory();
    const second = await call('POST', '/report');
    expect(second.body).toEqual(first.body);
    expect(converseTools()).toEqual([]);
    expect(meta()['quota_reports']).toBe(1);
    expect((await call('GET', '/report')).body).toEqual(first.body);
  });

  it('rejects a narrative whose action names an unknown competency and stores nothing', async () => {
    await finishInterview();
    narrative.actions[0] = { competencyId: 'nope', step: 'Do a thing this week.' };
    const res = await call('POST', '/report');
    expect(errorCode(res.body)).toBe('MODEL_OUTPUT_INVALID');
    expect(table.get(`S#${SESSION_ID}`, 'REPORT')).toBeUndefined();
    expect(meta()['quota_reports']).toBe(0);
  });

  it('rejects narrative that is not schema-valid (two actions) after one repair retry', async () => {
    await finishInterview();
    bedrockMock.resetHistory();
    narrative.actions = narrative.actions.slice(0, 2);
    expect(errorCode((await call('POST', '/report')).body)).toBe('MODEL_OUTPUT_INVALID');
    expect(converseTools()).toHaveLength(2);
    expect(meta()['quota_reports']).toBe(0);
  });

  it('builds a demo report from the fixture without calling the model or using quota', async () => {
    seedSession({ mode: 'demo' });
    await finishInterview();
    bedrockMock.resetHistory();
    const res = await call('POST', '/report');
    ReportSchema.parse(res.body);
    expect(converseTools()).toEqual([]);
    expect(meta()['quota_reports']).toBe(0);
  });
});

describe('POST …/practice (Req 12.3)', () => {
  it('needs an existing, evaluated primary question', async () => {
    expect(errorCode((await practice('t1')).body)).toBe('NOT_FOUND');
    await call('POST', '/interview');
    expect(errorCode((await practice('t1')).body)).toBe('CONFLICT');
    expect(errorCode((await practice('nope')).body)).toBe('NOT_FOUND');
    expect(errorCode((await call('POST', '/practice', { turnId: '!' })).body)).toBe('VALIDATION');
  });

  it('creates a practice turn under the question, and is idempotent until it is answered', async () => {
    await finishInterview();
    const first = await practice('t1');
    expect(first.status).toBe(200);
    const { turn } = PracticeResponseSchema.parse(first.body);
    expect(turn).toMatchObject({
      kind: 'practice',
      parentTurnId: 't1',
      label: '1',
      status: 'asked',
    });
    expect((await practice('t1')).body).toEqual(first.body);
    const state = InterviewStateSchema.parse((await call('GET', '/interview')).body);
    expect(state.turns.filter((t) => t.kind === 'practice')).toHaveLength(1);
  });

  it('refuses practice for a question already at Proficient or better', async () => {
    evalOutput = structuredClone(DEMO_SAMPLE_FEEDBACK_OUTPUT['1a']);
    await finishInterview();
    expect(errorCode((await practice('t1')).body)).toBe('CONFLICT');
  });

  it('caps practice attempts at the per-session quota', async () => {
    await finishInterview();
    for (let i = 0; i < LIMITS.quotas.practiceEvaluations; i++) {
      const { turn } = PracticeResponseSchema.parse((await practice('t1')).body);
      expect((await answer(turn.id)).status).toBe(200);
    }
    expect(errorCode((await practice('t1')).body)).toBe('QUOTA_EXCEEDED');
  });

  it('a better practice answer raises the best score, records a score event, and refreshes the report', async () => {
    await finishInterview();
    const before = ReportSchema.parse((await call('POST', '/report')).body);
    const eventsBefore = before.scoreEvents.length;

    const { turn } = PracticeResponseSchema.parse((await practice('t1')).body);
    evalOutput = structuredClone(DEMO_SAMPLE_FEEDBACK_OUTPUT['1a']);
    expect((await answer(turn.id)).status).toBe(200);

    // The stored report is stale now: GET reads as "not created", POST rebuilds it.
    expect(errorCode((await call('GET', '/report')).body)).toBe('NOT_FOUND');
    const after = ReportSchema.parse((await call('POST', '/report')).body);
    const q1 = after.questions.find((q) => q.primary.id === 't1')!;
    expect(q1.practiceAttempts).toHaveLength(1);
    expect(q1.bestScore).toBeGreaterThan(q1.originalScore ?? 0);
    expect(after.readiness.score).toBeGreaterThanOrEqual(before.readiness.score);
    expect(after.scoreEvents.length).toBeGreaterThan(eventsBefore);
    expect(meta()['quota_reports']).toBe(2);
    expect(meta()['quota_practiceEvaluations']).toBe(1);
  });
});
