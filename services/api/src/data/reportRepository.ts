/**
 * The `REPORT` item for a session (design §5). It records how many turns had been evaluated
 * when the report was built, so a later practice answer makes the stored report stale.
 */
import { GetCommand, PutCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Report } from '@proof-and-poise/shared';
import { sessionPk, SK, type ItemKey } from './keys';

export interface StoredReport {
  report: Report;
  /** `evaluatedTurnCount` of the interview state the report was built from. */
  evaluatedTurns: number;
}

const reportKey = (sessionId: string): ItemKey => ({ PK: sessionPk(sessionId), SK: SK.report });

export class ReportRepository {
  constructor(
    private readonly ddb: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async get(sessionId: string): Promise<StoredReport | null> {
    const res = await this.ddb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: reportKey(sessionId),
        ConsistentRead: true,
      }),
    );
    const item = res.Item;
    if (!item || typeof item['evaluatedTurns'] !== 'number') return null;
    return { report: item['report'] as Report, evaluatedTurns: item['evaluatedTurns'] };
  }

  async put(sessionId: string, ttl: number, value: StoredReport): Promise<void> {
    await this.ddb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...reportKey(sessionId), ...value, ttl },
      }),
    );
  }
}
