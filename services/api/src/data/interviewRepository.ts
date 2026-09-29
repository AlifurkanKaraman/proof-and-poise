/**
 * The `INTERVIEW` item for a session (design §5): the visible state (turns revealed so far),
 * the full server-side plan, and a revision for optimistic locking so a double submit can't
 * store two evaluations for the same turn.
 */
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { GetCommand, PutCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { InterviewState, PlannedQuestion } from '@proof-and-poise/shared';
import { ApiError } from '../lib/errors';
import { sessionPk, SK, type ItemKey } from './keys';

export interface StoredInterview {
  state: InterviewState;
  /** All five planned questions; only revealed ones appear in `state.turns`. */
  plan: PlannedQuestion[];
  rev: number;
}

const interviewKey = (sessionId: string): ItemKey => ({
  PK: sessionPk(sessionId),
  SK: SK.interview,
});

const isConditionFailure = (err: unknown) =>
  err instanceof ConditionalCheckFailedException ||
  (typeof err === 'object' &&
    err !== null &&
    (err as { name?: unknown }).name === 'ConditionalCheckFailedException');

export class InterviewRepository {
  constructor(
    private readonly ddb: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async get(sessionId: string): Promise<StoredInterview | null> {
    const res = await this.ddb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: interviewKey(sessionId),
        ConsistentRead: true,
      }),
    );
    const item = res.Item;
    if (!item || typeof item['rev'] !== 'number') return null;
    return {
      state: item['state'] as InterviewState,
      plan: item['plan'] as PlannedQuestion[],
      rev: item['rev'],
    };
  }

  /** Creates the interview once. Returns false when one already exists (idempotent start). */
  async create(
    sessionId: string,
    ttl: number,
    value: Omit<StoredInterview, 'rev'>,
  ): Promise<boolean> {
    try {
      await this.ddb.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { ...interviewKey(sessionId), ...value, rev: 0, ttl },
          ConditionExpression: 'attribute_not_exists(PK)',
        }),
      );
      return true;
    } catch (err) {
      if (isConditionFailure(err)) return false;
      throw err;
    }
  }

  /**
   * Replaces the state under an optimistic lock on `rev`. The loser of a race, or a save
   * after the session was deleted, gets 409 `CONFLICT`.
   */
  async save(
    sessionId: string,
    ttl: number,
    expectedRev: number,
    value: Omit<StoredInterview, 'rev'>,
  ): Promise<void> {
    try {
      await this.ddb.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { ...interviewKey(sessionId), ...value, rev: expectedRev + 1, ttl },
          ConditionExpression: 'attribute_exists(PK) AND rev = :rev',
          ExpressionAttributeValues: { ':rev': expectedRev },
        }),
      );
    } catch (err) {
      if (isConditionFailure(err)) throw new ApiError('CONFLICT');
      throw err;
    }
  }
}
