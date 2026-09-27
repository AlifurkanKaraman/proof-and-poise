/**
 * Session records in the single table (design §5): `S#<sessionId>` with `META`, `INPUT`,
 * `ANALYSIS`, `TURN#<nn>`, and `REPORT` items. Every item carries the session `ttl` (Req 2.4).
 */
import {
  BatchWriteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import {
  LIMITS,
  type AnalysisStatusResponse,
  type SessionMode,
  type SessionStage,
} from '@proof-and-poise/shared';
import { metaKey, sessionPk, SK, type ItemKey } from './keys';

export type SessionQuota = keyof typeof LIMITS.quotas;
export const SESSION_QUOTAS = Object.keys(LIMITS.quotas) as SessionQuota[];

/** Top-level attribute for a per-session counter (`ADD` only works on top-level attributes). */
export const quotaAttr = (quota: SessionQuota): string => `quota_${quota}`;

export interface SessionMeta {
  sessionId: string;
  /** Hex SHA-256 of the bearer token; the token itself is never stored (Req 2.2). */
  tokenHash: string;
  mode: SessionMode;
  stage: SessionStage;
  createdAt: string;
  expiresAt: string;
  /** Epoch seconds (DynamoDB TTL). */
  ttl: number;
}

export type ReadyAnalysis = Extract<AnalysisStatusResponse, { status: 'ready' }>;

const BATCH_SIZE = 25;
const BATCH_RETRIES = 3;

export class SessionRepository {
  constructor(
    private readonly ddb: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  /** Writes META (with zeroed quota counters) and, for demo sessions, the seeded ANALYSIS. */
  async create(meta: SessionMeta, analysis?: ReadyAnalysis): Promise<void> {
    const counters = Object.fromEntries(SESSION_QUOTAS.map((q) => [quotaAttr(q), 0]));
    await this.ddb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...metaKey(meta.sessionId), ...meta, ...counters },
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );
    if (analysis) {
      await this.ddb.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            PK: sessionPk(meta.sessionId),
            SK: SK.analysis,
            ...analysis,
            ttl: meta.ttl,
          },
        }),
      );
    }
  }

  async getMeta(sessionId: string): Promise<SessionMeta | null> {
    const res = await this.ddb.send(
      new GetCommand({ TableName: this.tableName, Key: metaKey(sessionId), ConsistentRead: true }),
    );
    const item = res.Item;
    if (!item || typeof item['tokenHash'] !== 'string') return null;
    return {
      sessionId: String(item['sessionId']),
      tokenHash: item['tokenHash'],
      mode: item['mode'] as SessionMode,
      stage: item['stage'] as SessionStage,
      createdAt: String(item['createdAt']),
      expiresAt: String(item['expiresAt']),
      ttl: Number(item['ttl']),
    };
  }

  /** Deletes every item under the session PK (Query + BatchWrite, Req 2.5). Returns the count. */
  async deleteAll(sessionId: string): Promise<number> {
    const keys: ItemKey[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.ddb.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: { ':pk': sessionPk(sessionId) },
          ProjectionExpression: 'PK, SK',
          ConsistentRead: true,
          ExclusiveStartKey: startKey,
        }),
      );
      for (const item of page.Items ?? [])
        keys.push({ PK: String(item['PK']), SK: String(item['SK']) });
      startKey = page.LastEvaluatedKey;
    } while (startKey);

    // META goes in the first batch so the token stops authenticating as early as possible.
    keys.sort((a, b) => (a.SK === SK.meta ? -1 : b.SK === SK.meta ? 1 : 0));
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      await this.batchDelete(keys.slice(i, i + BATCH_SIZE));
    }
    return keys.length;
  }

  private async batchDelete(keys: ItemKey[]): Promise<void> {
    let pending = keys.map((Key) => ({ DeleteRequest: { Key } }));
    for (let attempt = 0; pending.length > 0; attempt++) {
      if (attempt > BATCH_RETRIES) throw new Error('BatchWrite left unprocessed items');
      const res = await this.ddb.send(
        new BatchWriteCommand({ RequestItems: { [this.tableName]: pending } }),
      );
      pending = (res.UnprocessedItems?.[this.tableName] ?? []).flatMap((r) =>
        r.DeleteRequest?.Key ? [{ DeleteRequest: { Key: r.DeleteRequest.Key as ItemKey } }] : [],
      );
    }
  }
}
