/**
 * In-memory stand-in for the single table, wired into `aws-sdk-client-mock`. It understands
 * exactly the condition and update expressions the repositories use, and fails loudly on
 * anything else so tests can't silently pass against unmodeled behavior.
 */
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { AwsStub } from 'aws-sdk-client-mock';

type Item = Record<string, unknown>;
type Values = Record<string, unknown>;
type Names = Record<string, string>;

const key = (k: Item) => `${String(k['PK'])}|${String(k['SK'])}`;
const failed = () =>
  new ConditionalCheckFailedException({ message: 'The conditional request failed', $metadata: {} });

export class MemoryTable {
  readonly items = new Map<string, Item>();

  get(pk: string, sk: string): Item | undefined {
    return this.items.get(`${pk}|${sk}`);
  }

  put(item: Item): void {
    this.items.set(key(item), structuredClone(item));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the stub's generics are loose
  attach(mock: AwsStub<any, any, any>): void {
    mock.on(GetCommand).callsFake(({ Key }: { Key: Item }) => {
      const item = this.items.get(key(Key));
      return { Item: item ? structuredClone(item) : undefined };
    });
    mock.on(PutCommand).callsFake((input: { Item: Item; ConditionExpression?: string } & Ctx) => {
      const existing = this.items.get(key(input.Item));
      if (!this.condition(input.ConditionExpression, existing, input)) throw failed();
      this.put(input.Item);
      return {};
    });
    mock.on(UpdateCommand).callsFake((input: UpdateInput) => this.update(input));
  }

  private condition(expr: string | undefined, item: Item | undefined, ctx: Ctx): boolean {
    if (!expr) return true;
    const names = ctx.ExpressionAttributeNames ?? {};
    const values = ctx.ExpressionAttributeValues ?? {};
    const attr = (n: string) => item?.[names[n] ?? n];
    switch (expr) {
      case 'attribute_exists(PK)':
        return item !== undefined;
      case 'attribute_not_exists(PK)':
        return item === undefined;
      case 'attribute_not_exists(PK) OR #s IN (:ready, :failed)':
        return item === undefined || [values[':ready'], values[':failed']].includes(attr('#s'));
      case 'attribute_exists(PK) AND #s = :ready AND (attribute_not_exists(rev) OR rev = :rev)':
        return (
          item !== undefined &&
          attr('#s') === values[':ready'] &&
          (item['rev'] === undefined || item['rev'] === values[':rev'])
        );
      case 'attribute_exists(PK) AND rev = :rev':
        return item !== undefined && item['rev'] === values[':rev'];
      case '#s IN (:queued, :running)':
        return [values[':queued'], values[':running']].includes(attr('#s'));
      case '#c < :max':
        return item !== undefined && Number(attr('#c') ?? 0) < Number(values[':max']);
      case 'attribute_not_exists(#c) OR #c <= :limit':
        return attr('#c') === undefined || Number(attr('#c')) <= Number(values[':limit']);
      default:
        throw new Error(`MemoryTable: unmodeled condition ${expr}`);
    }
  }

  private update(input: UpdateInput): { Attributes: Item } {
    const k = key(input.Key);
    const item = this.items.get(k);
    if (!this.condition(input.ConditionExpression, item, input)) throw failed();
    const next: Item = structuredClone(item ?? { ...input.Key });
    const names = input.ExpressionAttributeNames ?? {};
    const values = input.ExpressionAttributeValues ?? {};
    const expr = input.UpdateExpression;
    for (const [, n, v] of expr.matchAll(/(#\w+|\w+) = (?:if_not_exists\([^)]*\)|(:\w+))/g)) {
      if (!n) continue;
      const name = names[n] ?? n;
      if (v) next[name] = values[v];
      else if (next[name] === undefined) next[name] = values[':ttl'];
    }
    for (const [, n, v] of expr.matchAll(/ADD (#\w+) (:\w+)/g)) {
      const name = names[n ?? ''] ?? '';
      next[name] = Number(next[name] ?? 0) + Number(values[v ?? '']);
    }
    for (const [, n] of expr.matchAll(/REMOVE (\w+)/g)) delete next[n ?? ''];
    this.items.set(k, next);
    return { Attributes: structuredClone(next) };
  }
}

interface Ctx {
  ExpressionAttributeNames?: Names;
  ExpressionAttributeValues?: Values;
}
interface UpdateInput extends Ctx {
  Key: Item;
  UpdateExpression: string;
  ConditionExpression?: string;
}
