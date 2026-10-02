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
  AnswerResponseSchema,
  DEFAULT_DEEPENING_FOLLOW_UP,
  DEMO_EVIDENCE_MAP,
  DEMO_QUESTION_CANDIDATES,
  DEMO_RESUME_TEXT,
  DEMO_SAMPLE_FEEDBACK_OUTPUT,
  ErrorResponseSchema,
  EvidenceMapSchema,
  InterviewStateSchema,
  LIMITS,
  type EvaluationModelOutput,
} from '@proof-and-poise/shared';
import { createRouter } from '../app';
import {
  EVALUATE_ANSWER_SYSTEM_PROMPT,
  EVALUATE_ANSWER_TOOL_NAME,
} from '../ai/prompts/evaluateAnswer';
import { GENERATE_QUESTIONS_TOOL_NAME } from '../ai/prompts/generateQuestions';
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
let logLines: string[];
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
    stage: 'analysis',
    createdAt: new Date(NOW).toISOString(),
    expiresAt: new Date(ttl * 1000).toISOString(),
    ttl,
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
    createLogger((l) => logLines.push(l)),
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

const startInterview = () => call('POST', '/interview');
const answer = (turnId: string, body: unknown = ANSWER) =>
  call('POST', `/turns/${turnId}/answer`, body);
const errorCode = (body: unknown) => ErrorResponseSchema.parse(body).error.code;
const storedInterview = () => table.get(`S#${SESSION_ID}`, 'INTERVIEW') as Record<string, unknown>;
const meta = () => table.get(`S#${SESSION_ID}`, 'META') as Record<string, unknown>;

const toolReply = (name: string, input: unknown): ConverseCommandOutput =>
  ({
    output: {
      message: { role: 'assistant', content: [{ toolUse: { toolUseId: 't1', name, input } }] },
    },
    stopReason: 'tool_use',
    usage: { inputTokens: 900, outputTokens: 120, totalTokens: 1020 },
    $metadata: {},
  }) as ConverseCommandOutput;

const strongOutput = (): EvaluationModelOutput =>
  structuredClone(DEMO_SAMPLE_FEEDBACK_OUTPUT['1a']);

/** A weak answer: specificity ≤ 2 plus a candidate follow-up triggers the follow-up rule. */
const weakOutput = (): EvaluationModelOutput => {
  const o = structuredClone(DEMO_SAMPLE_FEEDBACK_OUTPUT['1']);
  o.candidateFollowUp = 'You said you got it working. What did you personally change?';
  return o;
};

const converseCalls = () => bedrockMock.commandCalls(ConverseCommand);
const toolNamesCalled = () =>
  converseCalls().map(
    (c) =>
      (c.args[0].input.toolConfig?.tools?.[0] as { toolSpec?: { name?: string } } | undefined)
        ?.toolSpec?.name,
  );

beforeEach(() => {
  ddbMock.reset();
  bedrockMock.reset();
  table = new MemoryTable();
  table.attach(ddbMock);
  logLines = [];
  seedSession();
  seedAnalysis();
  bedrockMock.on(ConverseCommand).callsFake((input: { toolConfig?: unknown }) => {
    const name = (input.toolConfig as { tools: { toolSpec: { name: string } }[] }).tools[0]!
      .toolSpec.name;
    return name === GENERATE_QUESTIONS_TOOL_NAME
      ? toolReply(name, DEMO_QUESTION_CANDIDATES)
      : toolReply(name, strongOutput());
  });
});

describe('POST/GET …/interview (Req 9.1, 9.7)', () => {
  it('generates the plan with one model call, reveals question 1, and locks decisions', async () => {
    const res = await startInterview();
    expect(res.status).toBe(200);
    const state = InterviewStateSchema.parse(res.body);
    expect(state).toMatchObject({ total: 5, followUpsUsed: 0, status: 'in_progress' });
    expect(state.turns).toHaveLength(1);
    expect(state.turns[0]).toMatchObject({ id: 't1', label: '1', status: 'asked' });
    expect(toolNamesCalled()).toEqual([GENERATE_QUESTIONS_TOOL_NAME]);

    // B1, R1, GAP, B2, R2 are stored server-side (Req 9.1).
    const plan = storedInterview()['plan'] as { kind: string }[];
    expect(plan.map((p) => p.kind)).toEqual([
      'behavioral',
      'role_specific',
      'evidence_gap',
      'behavioral',
      'role_specific',
    ]);
    expect(meta()['stage']).toBe('interview');
  });

  it('is idempotent: a second start returns the same state without another model call', async () => {
    const first = await startInterview();
    const second = await startInterview();
    expect(second.body).toEqual(first.body);
    expect(converseCalls()).toHaveLength(1);
    expect((await call('GET', '/interview')).body).toEqual(first.body);
  });

  it('needs a finished analysis and an existing interview for GET', async () => {
    table.items.delete(`S#${SESSION_ID}|ANALYSIS`);
    expect(errorCode((await startInterview()).body)).toBe('NOT_FOUND');
    expect(errorCode((await call('GET', '/interview')).body)).toBe('NOT_FOUND');
  });

  it('rejects a plan that targets an unknown competency after one repair retry', async () => {
    bedrockMock.on(ConverseCommand).resolves(
      toolReply(GENERATE_QUESTIONS_TOOL_NAME, {
        ...DEMO_QUESTION_CANDIDATES,
        evidenceGap: {
          competencyId: 'c1',
          question: 'What experience do you have with Kubernetes?',
        },
      }),
    );
    const res = await startInterview();
    expect(errorCode(res.body)).toBe('MODEL_OUTPUT_INVALID');
    expect(converseCalls()).toHaveLength(2);
    expect(storedInterview()).toBeUndefined();
  });
});

describe('POST …/turns/{turnId}/answer (Req 9.3–9.4, 11)', () => {
  beforeEach(async () => {
    await startInterview();
    bedrockMock.resetHistory();
  });

  it('evaluates, computes the weighted score server-side, and returns the next turn', async () => {
    const res = await answer('t1');
    expect(res.status).toBe(200);
    const body = AnswerResponseSchema.parse(res.body);
    expect(body.evaluation.feedbackSource).toBe('live');
    expect(body.evaluation.weightedScore).toBeGreaterThanOrEqual(1);
    expect(body.evaluation.weightedScore).toBeLessThanOrEqual(4);
    expect(body.next).toMatchObject({ id: 't2', label: '2', status: 'asked' });
    expect(toolNamesCalled()).toEqual([EVALUATE_ANSWER_TOOL_NAME]);

    const state = InterviewStateSchema.parse((await call('GET', '/interview')).body);
    expect(state.turns[0]).toMatchObject({ id: 't1', status: 'evaluated', answer: ANSWER });
    expect(state.turns).toHaveLength(2);
  });

  it('rejects keyboard mashing with 400 before any model call or quota use', async () => {
    const res = await answer('t1', {
      text: 'asdgsdagsadgasdgasgasdgs',
      source: 'typed',
      edited: false,
    });
    expect(res.status).toBe(400);
    expect(errorCode(res.body)).toBe('VALIDATION');
    expect(converseCalls()).toHaveLength(0);
    expect(meta()['quota_evaluations']).toBeUndefined();
  });
  it('updates competency readiness, Interview Readiness, and the score events', async () => {
    await answer('t1');
    const map = EvidenceMapSchema.parse(
      (table.get(`S#${SESSION_ID}`, 'ANALYSIS') as Record<string, unknown>)['evidenceMap'],
    );
    expect(map.scores.interviewReadiness).not.toBeNull();
    expect(map.scoreEvents.some((e) => e.metric === 'interviewReadiness')).toBe(true);
    expect(map.competencies.some((c) => c.interview?.bestScore != null)).toBe(true);
    expect(meta()).toMatchObject({ quota_evaluations: 1, quota_primaryEvaluations: 1 });
  });

  it('answers a duplicate submission with 409 and stores it once (idempotent per turn)', async () => {
    expect((await answer('t1')).status).toBe(200);
    bedrockMock.resetHistory();
    const dup = await answer('t1');
    expect(dup.status).toBe(409);
    expect(errorCode(dup.body)).toBe('CONFLICT');
    expect(converseCalls()).toHaveLength(0);
    expect(meta()['quota_evaluations']).toBe(1);
  });

  it('rejects unknown turns, turns not yet asked, and invalid answers', async () => {
    expect(errorCode((await answer('t9')).body)).toBe('NOT_FOUND');
    // Question 2 has not been revealed yet.
    expect(errorCode((await answer('t2')).body)).toBe('NOT_FOUND');
    const short = await answer('t1', { ...ANSWER, text: 'too short' });
    expect(short.status).toBe(400);
    expect(errorCode(short.body)).toBe('VALIDATION');
    expect(converseCalls()).toHaveLength(0);
  });

  it('keeps the answer retryable when the model output is invalid twice', async () => {
    bedrockMock.on(ConverseCommand).resolves(toolReply(EVALUATE_ANSWER_TOOL_NAME, { nope: true }));
    const res = await answer('t1');
    expect(errorCode(res.body)).toBe('MODEL_OUTPUT_INVALID');
    expect(converseCalls()).toHaveLength(2);
    // Nothing stored, no attempt burned (Req 11.2).
    expect(meta()['quota_evaluations'] ?? 0).toBe(0);
    const state = InterviewStateSchema.parse((await call('GET', '/interview')).body);
    expect(state.turns[0]?.status).toBe('asked');
  });

  it('coerces STAR to null on non-behavioral questions (Req 11.1)', async () => {
    await answer('t1');
    const res = await answer('t2');
    expect(AnswerResponseSchema.parse(res.body).evaluation.dimensions.star).toBeNull();
  });

  it('asks a follow-up on a weak answer, labeled and tied to the parent turn (Req 9.3–9.4)', async () => {
    bedrockMock.on(ConverseCommand).resolves(toolReply(EVALUATE_ANSWER_TOOL_NAME, weakOutput()));
    const body = AnswerResponseSchema.parse((await answer('t1')).body);
    expect(body.next).toMatchObject({
      id: 't1a',
      label: '1a',
      kind: 'follow_up',
      parentTurnId: 't1',
      question: 'You said you got it working. What did you personally change?',
    });
    const state = InterviewStateSchema.parse((await call('GET', '/interview')).body);
    expect(state.followUpsUsed).toBe(1);
  });

  it('guarantees a follow-up on the GAP question even when every answer is strong', async () => {
    let next: string | undefined = 't1';
    const asked: string[] = [];
    while (next) {
      const res = AnswerResponseSchema.parse((await answer(next)).body);
      if (res.next) asked.push(res.next.label);
      next = res.next?.id;
    }
    expect(asked).toContain('3a');
    const state = InterviewStateSchema.parse((await call('GET', '/interview')).body);
    expect(state.status).toBe('complete');
    expect(state.followUpsUsed).toBe(1);
    const gapFollowUp = state.turns.find((t) => t.id === 't3a');
    expect(gapFollowUp?.question).toBe(DEFAULT_DEEPENING_FOLLOW_UP);
  });

  it('never exceeds two follow-ups even when every answer is weak', async () => {
    bedrockMock.on(ConverseCommand).resolves(toolReply(EVALUATE_ANSWER_TOOL_NAME, weakOutput()));
    let next: string | undefined = 't1';
    while (next) {
      const res = await answer(next);
      next = AnswerResponseSchema.parse(res.body).next?.id;
    }
    const state = InterviewStateSchema.parse((await call('GET', '/interview')).body);
    expect(state.followUpsUsed).toBe(LIMITS.interview.maxFollowUps);
    expect(state.status).toBe('complete');
    expect(state.turns.filter((t) => t.kind === 'follow_up')).toHaveLength(2);
  });

  it('logs only allowlisted fields, never the answer text', async () => {
    await answer('t1');
    expect(logLines.join('\n')).not.toContain('checkout Lambda');
  });
});

describe('demo sessions (Req 13.4)', () => {
  beforeEach(() => {
    seedSession({ mode: 'demo' });
  });

  it('plans and evaluates from labeled fixtures with no model call', async () => {
    const start = InterviewStateSchema.parse((await startInterview()).body);
    expect(start.turns[0]).toMatchObject({ id: 't1', status: 'asked' });
    const res = AnswerResponseSchema.parse((await answer('t1')).body);
    expect(res.evaluation.feedbackSource).toBe('sample');
    // The vague sample answer triggers the one follow-up in the demo journey.
    expect(res.next).toMatchObject({ kind: 'follow_up', label: '1a' });
    expect(converseCalls()).toHaveLength(0);
  });
});

describe('evaluation prompt fairness rules (Req 11.3–11.4)', () => {
  it('forbids judging accent or fluency and inferring emotion, honesty, or employability', () => {
    expect(EVALUATE_ANSWER_SYSTEM_PROMPT).toMatch(/accent/i);
    expect(EVALUATE_ANSWER_SYSTEM_PROMPT).toMatch(/fluency/i);
    expect(EVALUATE_ANSWER_SYSTEM_PROMPT).toMatch(/emotion, honesty/i);
    expect(EVALUATE_ANSWER_SYSTEM_PROMPT).toMatch(/employability/i);
  });
});
