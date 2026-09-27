/**
 * Counters enforced with DynamoDB conditional updates (design §5, Req 16.2–16.4).
 * `ADD counter :n` only succeeds while the condition holds, so concurrent requests can't
 * overshoot a cap. Limits come from `LIMITS` in packages/shared only.
 */
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { UpdateCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { LIMITS } from '@proof-and-poise/shared';
import { ApiError } from '../lib/errors';
import { budgetKey, ipRateKey, metaKey, ttlAt } from './keys';
import { quotaAttr, type SessionQuota } from './sessionRepository';

export type BudgetKind = 'bedrockCalls' | 'transcribeSeconds';

/** Daily caps for the global circuit breaker (Req 16.4). */
export const GLOBAL_BUDGET: Record<BudgetKind, number> = {
  bedrockCalls: LIMITS.globalBudget.bedrockCallsPerDay,
  transcribeSeconds: LIMITS.globalBudget.transcribeSecondsPerDay,
};

function isConditionFailure(err: unknown): boolean {
  return (
    err instanceof ConditionalCheckFailedException ||
    (typeof err === 'object' &&
      err !== null &&
      (err as { name?: unknown }).name === 'ConditionalCheckFailedException')
  );
}

export class QuotaCounters {
  constructor(
    private readonly ddb: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  /**
   * Consumes one unit of a per-session quota (Req 16.2). Counters are zeroed on META at
   * session creation, so a missing META also fails the condition and nothing is created.
   * Throws 429 `QUOTA_EXCEEDED` when the cap is reached.
   */
  async consumeSession(sessionId: string, quota: SessionQuota): Promise<number> {
    try {
      const res = await this.ddb.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: metaKey(sessionId),
          UpdateExpression: 'ADD #c :one',
          ConditionExpression: '#c < :max',
          ExpressionAttributeNames: { '#c': quotaAttr(quota) },
          ExpressionAttributeValues: { ':one': 1, ':max': LIMITS.quotas[quota] },
          ReturnValues: 'UPDATED_NEW',
        }),
      );
      return Number(res.Attributes?.[quotaAttr(quota)] ?? 0);
    } catch (err) {
      if (isConditionFailure(err)) throw new ApiError('QUOTA_EXCEEDED');
      throw err;
    }
  }

  /**
   * Counts a session creation for a salted IP hash in the current UTC hour (Req 16.3).
   * The raw IP never reaches this layer. Throws 429 `QUOTA_EXCEEDED` past the hourly cap.
   */
  async consumeIpRate(ipHash: string, nowMs: number): Promise<number> {
    try {
      const res = await this.ddb.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: ipRateKey(ipHash, nowMs),
          UpdateExpression: 'SET #ttl = if_not_exists(#ttl, :ttl) ADD #n :one',
          ConditionExpression: 'attribute_not_exists(#n) OR #n < :max',
          ExpressionAttributeNames: { '#n': 'count', '#ttl': 'ttl' },
          ExpressionAttributeValues: {
            ':one': 1,
            ':max': LIMITS.rateLimit.sessionsPerIpPerHour,
            ':ttl': ttlAt(nowMs, LIMITS.rateLimit.ttlHours * 3600),
          },
          ReturnValues: 'UPDATED_NEW',
        }),
      );
      return Number(res.Attributes?.['count'] ?? 0);
    } catch (err) {
      if (isConditionFailure(err)) {
        throw new ApiError('QUOTA_EXCEEDED', 'Too many sessions from this network. Try later.');
      }
      throw err;
    }
  }

  /**
   * Reserves `amount` units of today's global budget (Req 16.4). Succeeds only while the
   * total after adding stays within the cap; otherwise throws 503 `CAPACITY_REACHED`.
   * Consumed by the Bedrock and Transcribe tasks.
   */
  async consumeGlobal(kind: BudgetKind, amount: number, nowMs: number): Promise<number> {
    const cap = GLOBAL_BUDGET[kind];
    const units = Math.ceil(amount);
    if (!Number.isFinite(units) || units < 1 || units > cap) throw new ApiError('CAPACITY_REACHED');
    try {
      const res = await this.ddb.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: budgetKey(nowMs),
          UpdateExpression: 'SET #ttl = if_not_exists(#ttl, :ttl) ADD #c :amount',
          ConditionExpression: 'attribute_not_exists(#c) OR #c <= :limit',
          ExpressionAttributeNames: { '#c': kind, '#ttl': 'ttl' },
          ExpressionAttributeValues: {
            ':amount': units,
            ':limit': cap - units,
            ':ttl': ttlAt(nowMs, LIMITS.globalBudget.ttlDays * 86_400),
          },
          ReturnValues: 'UPDATED_NEW',
        }),
      );
      return Number(res.Attributes?.[kind] ?? 0);
    } catch (err) {
      if (isConditionFailure(err)) throw new ApiError('CAPACITY_REACHED');
      throw err;
    }
  }
}
