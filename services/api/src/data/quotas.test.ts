import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { LIMITS } from '@proof-and-poise/shared';
import { ApiError } from '../lib/errors';
import { budgetKey, dayBucket, hourBucket, ipRateKey } from './keys';
import { QuotaCounters } from './quotas';

const ddbMock = mockClient(DynamoDBDocumentClient);
const TABLE = 'proof-and-poise-test';
const NOW = Date.UTC(2026, 8, 28, 7, 30); // 2026-09-28 07:30 UTC
const SESSION = '3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f';

const conditionFailed = () =>
  new ConditionalCheckFailedException({ message: 'The conditional request failed', $metadata: {} });

let quotas: QuotaCounters;
beforeEach(() => {
  ddbMock.reset();
  quotas = new QuotaCounters(
    DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' })),
    TABLE,
  );
});

async function expectCode(p: Promise<unknown>, code: string, status: number) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).code).toBe(code);
  expect((err as ApiError).status).toBe(status);
}

describe('keys', () => {
  it('buckets by UTC hour and day', () => {
    expect(hourBucket(NOW)).toBe('2026092807');
    expect(dayBucket(NOW)).toBe('20260928');
    expect(ipRateKey('abc', NOW)).toEqual({ PK: 'IP#abc#2026092807', SK: 'RATE' });
    expect(budgetKey(NOW)).toEqual({ PK: 'GLOBAL#20260928', SK: 'BUDGET' });
  });
});

describe('QuotaCounters.consumeSession (Req 16.2)', () => {
  it('ADDs 1 to the META counter conditioned on the shared limit', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { quota_analyses: 1 } });
    await expect(quotas.consumeSession(SESSION, 'analyses')).resolves.toBe(1);
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(input).toMatchObject({
      TableName: TABLE,
      Key: { PK: `S#${SESSION}`, SK: 'META' },
      UpdateExpression: 'ADD #c :one',
      ConditionExpression: '#c < :max',
      ExpressionAttributeNames: { '#c': 'quota_analyses' },
      ExpressionAttributeValues: { ':one': 1, ':max': LIMITS.quotas.analyses },
    });
  });

  it('maps a failed condition to 429 QUOTA_EXCEEDED', async () => {
    ddbMock.on(UpdateCommand).rejects(conditionFailed());
    await expectCode(quotas.consumeSession(SESSION, 'confirmations'), 'QUOTA_EXCEEDED', 429);
  });

  it('rethrows other DynamoDB errors unchanged', async () => {
    ddbMock.on(UpdateCommand).rejects(new Error('throttled'));
    await expect(quotas.consumeSession(SESSION, 'reports')).rejects.not.toBeInstanceOf(ApiError);
  });
});

describe('QuotaCounters.consumeIpRate (Req 16.3)', () => {
  it('counts per IP hash per hour with a 2 h ttl and the hourly cap', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { count: 3 } });
    await expect(quotas.consumeIpRate('hash123', NOW)).resolves.toBe(3);
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(input?.Key).toEqual({ PK: 'IP#hash123#2026092807', SK: 'RATE' });
    expect(input?.ConditionExpression).toBe('attribute_not_exists(#n) OR #n < :max');
    expect(input?.ExpressionAttributeValues).toEqual({
      ':one': 1,
      ':max': 10,
      ':ttl': Math.floor(NOW / 1000) + 2 * 3600,
    });
  });

  it('rejects the 11th session in an hour with 429', async () => {
    ddbMock.on(UpdateCommand).rejects(conditionFailed());
    await expectCode(quotas.consumeIpRate('hash123', NOW), 'QUOTA_EXCEEDED', 429);
  });
});

describe('QuotaCounters.consumeGlobal (Req 16.4)', () => {
  it('reserves Bedrock calls under the daily cap with a 3-day ttl', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { bedrockCalls: 12 } });
    await expect(quotas.consumeGlobal('bedrockCalls', 1, NOW)).resolves.toBe(12);
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(input?.Key).toEqual({ PK: 'GLOBAL#20260928', SK: 'BUDGET' });
    expect(input?.ExpressionAttributeNames).toEqual({ '#c': 'bedrockCalls', '#ttl': 'ttl' });
    expect(input?.ExpressionAttributeValues).toEqual({
      ':amount': 1,
      ':limit': 1_499,
      ':ttl': Math.floor(NOW / 1000) + 3 * 86_400,
    });
  });

  it('keeps transcribe seconds within 60 min/day by conditioning on cap − amount', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { transcribeSeconds: 90 } });
    await quotas.consumeGlobal('transcribeSeconds', 89.2, NOW);
    const values = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input.ExpressionAttributeValues;
    expect(values?.[':amount']).toBe(90);
    expect(values?.[':limit']).toBe(3_600 - 90);
  });

  it('maps a failed condition or an impossible amount to 503 CAPACITY_REACHED', async () => {
    ddbMock.on(UpdateCommand).rejects(conditionFailed());
    await expectCode(quotas.consumeGlobal('bedrockCalls', 1, NOW), 'CAPACITY_REACHED', 503);
    await expectCode(
      quotas.consumeGlobal('transcribeSeconds', 3_601, NOW),
      'CAPACITY_REACHED',
      503,
    );
    await expectCode(quotas.consumeGlobal('bedrockCalls', 0, NOW), 'CAPACITY_REACHED', 503);
  });
});
