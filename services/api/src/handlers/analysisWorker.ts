/**
 * Lambda entry for the analysis worker, invoked asynchronously by `POST /analysis`
 * (design §2). Env is validated at cold start (Req 15.4).
 */
import { z } from 'zod';
import { AnalysisRepository } from '../data/analysisRepository';
import { QuotaCounters } from '../data/quotas';
import { SessionRepository } from '../data/sessionRepository';
import { createWorkerClients } from '../lib/aws';
import { loadWorkerEnv } from '../lib/env';
import { logger } from '../lib/logger';
import { AnalysisWorker } from '../services/analysisWorker';

export const env = loadWorkerEnv(process.env);
const clients = createWorkerClients();

const worker = new AnalysisWorker({
  analyses: new AnalysisRepository(clients.ddb, env.TABLE_NAME),
  sessions: new SessionRepository(clients.ddb, env.TABLE_NAME),
  s3: clients.s3,
  bucketName: env.BUCKET_NAME,
  model: {
    bedrock: clients.bedrock,
    modelId: env.MODEL_ID,
    quotas: new QuotaCounters(clients.ddb, env.TABLE_NAME),
    log: logger,
    now: Date.now,
  },
  log: logger,
  now: Date.now,
});

const EventSchema = z.object({ sessionId: z.uuid({ version: 'v4' }) });

export const handler = async (event: unknown): Promise<void> => {
  const parsed = EventSchema.safeParse(event);
  if (!parsed.success) {
    logger.warn('worker_event_invalid', { errorCode: 'VALIDATION' });
    return;
  }
  await worker.run(parsed.data.sessionId);
};
