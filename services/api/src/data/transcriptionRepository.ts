/**
 * One `TRANSCRIPTION#<turnId>` item per recorded answer (design §5, §8). It holds only
 * identifiers (no audio, no text) so the lazy poll can find the Transcribe job and the
 * objects to delete. The item is removed once the transcript is read (Req 10.6).
 */
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { ErrorCode } from '@proof-and-poise/shared';
import { transcriptionKey } from './keys';

export interface StoredTranscription {
  status: 'transcribing' | 'failed';
  /** Set with `failed`, so a repeated poll returns the same typed-fallback reason. */
  errorCode?: ErrorCode;
  jobName: string;
  audioKey: string;
  transcriptKey: string;
  startedAt: string;
  durationSec: number;
}

export class TranscriptionRepository {
  constructor(
    private readonly ddb: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async get(sessionId: string, turnId: string): Promise<StoredTranscription | null> {
    const res = await this.ddb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: transcriptionKey(sessionId, turnId),
        ConsistentRead: true,
      }),
    );
    const item = res.Item;
    if (!item || (item['status'] !== 'transcribing' && item['status'] !== 'failed')) return null;
    return {
      status: item['status'],
      ...(typeof item['errorCode'] === 'string'
        ? { errorCode: item['errorCode'] as ErrorCode }
        : {}),
      jobName: String(item['jobName']),
      audioKey: String(item['audioKey']),
      transcriptKey: String(item['transcriptKey']),
      startedAt: String(item['startedAt']),
      durationSec: Number(item['durationSec']),
    };
  }

  /** Creates the item; throws the SDK's conditional failure if one already exists. */
  async create(
    sessionId: string,
    turnId: string,
    ttl: number,
    record: StoredTranscription,
  ): Promise<void> {
    await this.ddb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...transcriptionKey(sessionId, turnId), ...record, ttl },
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );
  }

  /** Overwrites an existing item (keeps a `failed` marker until the session ends). */
  async put(
    sessionId: string,
    turnId: string,
    ttl: number,
    record: StoredTranscription,
  ): Promise<void> {
    await this.ddb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...transcriptionKey(sessionId, turnId), ...record, ttl },
      }),
    );
  }

  async delete(sessionId: string, turnId: string): Promise<void> {
    await this.ddb.send(
      new DeleteCommand({ TableName: this.tableName, Key: transcriptionKey(sessionId, turnId) }),
    );
  }
}
