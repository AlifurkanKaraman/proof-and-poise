/** Single-table key layout (design §5). All time buckets are UTC. */

export interface ItemKey {
  PK: string;
  SK: string;
}

export const SK = {
  meta: 'META',
  input: 'INPUT',
  analysis: 'ANALYSIS',
  interview: 'INTERVIEW',
  report: 'REPORT',
  rate: 'RATE',
  budget: 'BUDGET',
} as const;

export const sessionPk = (sessionId: string): string => `S#${sessionId}`;

const pad = (n: number) => String(n).padStart(2, '0');

/** `yyyymmdd` in UTC. */
export function dayBucket(nowMs: number): string {
  const d = new Date(nowMs);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/** `yyyymmddhh` in UTC. */
export function hourBucket(nowMs: number): string {
  return `${dayBucket(nowMs)}${pad(new Date(nowMs).getUTCHours())}`;
}

export const metaKey = (sessionId: string): ItemKey => ({ PK: sessionPk(sessionId), SK: SK.meta });

export const ipRateKey = (ipHash: string, nowMs: number): ItemKey => ({
  PK: `IP#${ipHash}#${hourBucket(nowMs)}`,
  SK: SK.rate,
});

export const transcriptionKey = (sessionId: string, turnId: string): ItemKey => ({
  PK: sessionPk(sessionId),
  SK: `TRANSCRIPTION#${turnId}`,
});

export const budgetKey = (nowMs: number): ItemKey => ({
  PK: `GLOBAL#${dayBucket(nowMs)}`,
  SK: SK.budget,
});

/** DynamoDB TTL value: epoch seconds. */
export const ttlAt = (nowMs: number, seconds: number): number => Math.floor(nowMs / 1000) + seconds;
