/**
 * `INPUT` and `ANALYSIS` items for a session (design §5). The analysis item moves through
 * `queued → running(stage) → ready | failed`. Writes after `queued` require the item to
 * still exist, so a session deleted mid-analysis isn't resurrected.
 */
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { AnalysisStage, ErrorCode, JobInput } from '@proof-and-poise/shared';
import { ApiError } from '../lib/errors';
import { sessionPk, SK, type ItemKey } from './keys';
import type { ReadyAnalysis } from './sessionRepository';

export interface StoredInput {
  /** `pdf` until the worker extracts text; pasted text is `text` from the start. */
  resumeKind: 'pdf' | 'text';
  /** Pasted or extracted resume text (≤ 12k chars). Absent until extraction for PDFs. */
  resumeText?: string;
  /** Server-issued upload key; removed once the worker has read (and deleted) the object. */
  resumeKey?: string;
  job: JobInput;
}

export type StoredAnalysis =
  | { status: 'queued'; startedAt: string }
  | { status: 'running'; stage: AnalysisStage; startedAt: string }
  | (ReadyAnalysis & { startedAt?: string })
  | { status: 'failed'; errorCode: ErrorCode; startedAt?: string };

const inputKey = (sessionId: string): ItemKey => ({ PK: sessionPk(sessionId), SK: SK.input });
const analysisKey = (sessionId: string): ItemKey => ({
  PK: sessionPk(sessionId),
  SK: SK.analysis,
});

const isConditionFailure = (err: unknown) =>
  err instanceof ConditionalCheckFailedException ||
  (typeof err === 'object' &&
    err !== null &&
    (err as { name?: unknown }).name === 'ConditionalCheckFailedException');

export class AnalysisRepository {
  constructor(
    private readonly ddb: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async putInput(sessionId: string, ttl: number, input: StoredInput): Promise<void> {
    await this.ddb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...inputKey(sessionId), ...input, ttl },
      }),
    );
  }

  async getInput(sessionId: string): Promise<StoredInput | null> {
    const res = await this.ddb.send(
      new GetCommand({ TableName: this.tableName, Key: inputKey(sessionId), ConsistentRead: true }),
    );
    const item = res.Item;
    if (!item || (item['resumeKind'] !== 'pdf' && item['resumeKind'] !== 'text')) return null;
    return {
      resumeKind: item['resumeKind'],
      ...(typeof item['resumeText'] === 'string' ? { resumeText: item['resumeText'] } : {}),
      ...(typeof item['resumeKey'] === 'string' ? { resumeKey: item['resumeKey'] } : {}),
      job: item['job'] as JobInput,
    };
  }

  /** Stores the extracted text and drops the (now deleted) upload key (design §5). */
  async saveExtractedText(sessionId: string, text: string): Promise<void> {
    await this.ddb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: inputKey(sessionId),
        UpdateExpression: 'SET resumeText = :t REMOVE resumeKey',
        ConditionExpression: 'attribute_exists(PK)',
        ExpressionAttributeValues: { ':t': text },
      }),
    );
  }

  async getAnalysis(sessionId: string): Promise<StoredAnalysis | null> {
    const res = await this.ddb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: analysisKey(sessionId),
        ConsistentRead: true,
      }),
    );
    const item = res.Item;
    if (!item || typeof item['status'] !== 'string') return null;
    const { PK: _pk, SK: _sk, ttl: _ttl, ...rest } = item;
    return rest as StoredAnalysis;
  }

  /** The ready analysis and its revision (0 until first edited), or null if not ready. */
  async getReady(sessionId: string): Promise<{ ready: ReadyAnalysis; rev: number } | null> {
    const res = await this.ddb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: analysisKey(sessionId),
        ConsistentRead: true,
      }),
    );
    const item = res.Item;
    if (!item || item['status'] !== 'ready') return null;
    const { PK: _pk, SK: _sk, ttl: _ttl, rev, ...ready } = item;
    return { ready: ready as ReadyAnalysis, rev: typeof rev === 'number' ? rev : 0 };
  }

  /**
   * Replaces the evidence map after a decision or confirmation. Optimistic lock on `rev`, so
   * two concurrent edits can't overwrite each other; the loser gets 409 `CONFLICT`. Also
   * fails if the session was deleted meanwhile.
   */
  async saveEvidenceMap(
    sessionId: string,
    expectedRev: number,
    evidenceMap: ReadyAnalysis['evidenceMap'],
  ): Promise<void> {
    try {
      await this.ddb.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: analysisKey(sessionId),
          UpdateExpression: 'SET evidenceMap = :m, rev = :next',
          ConditionExpression:
            'attribute_exists(PK) AND #s = :ready AND (attribute_not_exists(rev) OR rev = :rev)',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':m': evidenceMap,
            ':next': expectedRev + 1,
            ':rev': expectedRev,
            ':ready': 'ready',
          },
        }),
      );
    } catch (err) {
      if (isConditionFailure(err)) throw new ApiError('CONFLICT');
      throw err;
    }
  }

  /**
   * Marks an analysis as queued. Only allowed when there is none yet or the previous one
   * finished (ready or failed); otherwise throws 409 `CONFLICT`.
   */
  async queue(sessionId: string, ttl: number, startedAt: string): Promise<void> {
    try {
      await this.ddb.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { ...analysisKey(sessionId), status: 'queued', startedAt, ttl },
          ConditionExpression: 'attribute_not_exists(PK) OR #s IN (:ready, :failed)',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':ready': 'ready', ':failed': 'failed' },
        }),
      );
    } catch (err) {
      if (isConditionFailure(err)) throw new ApiError('CONFLICT');
      throw err;
    }
  }

  /** Advances the progress stage (Req 5.1). Only a queued or running analysis moves. */
  async setStage(sessionId: string, stage: AnalysisStage): Promise<void> {
    await this.ddb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: analysisKey(sessionId),
        UpdateExpression: 'SET #s = :running, #st = :stage',
        ConditionExpression: '#s IN (:queued, :running)',
        ExpressionAttributeNames: { '#s': 'status', '#st': 'stage' },
        ExpressionAttributeValues: { ':running': 'running', ':queued': 'queued', ':stage': stage },
      }),
    );
  }

  async putReady(sessionId: string, ttl: number, ready: ReadyAnalysis): Promise<void> {
    await this.putFinal(sessionId, ttl, { ...ready });
  }

  /** Records a failure with a recoverable code only; no partial model output (Req 5.3). */
  async putFailed(sessionId: string, ttl: number, errorCode: ErrorCode): Promise<void> {
    await this.putFinal(sessionId, ttl, { status: 'failed', errorCode });
  }

  private async putFinal(
    sessionId: string,
    ttl: number,
    body: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.ddb.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { ...analysisKey(sessionId), ...body, ttl },
          ConditionExpression: 'attribute_exists(PK)',
        }),
      );
    } catch (err) {
      // The session was deleted while the worker ran: nothing to write.
      if (!isConditionFailure(err)) throw err;
    }
  }
}
