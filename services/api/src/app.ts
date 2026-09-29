import { routes } from '@proof-and-poise/shared';
import { AnalysisRepository } from './data/analysisRepository';
import { QuotaCounters } from './data/quotas';
import { SessionRepository } from './data/sessionRepository';
import { authenticate } from './lib/auth';
import type { AwsClients } from './lib/aws';
import type { Env } from './lib/env';
import { logger as defaultLogger, type Logger } from './lib/logger';
import { Router } from './lib/router';
import type { SaltProvider } from './lib/salt';
import { getAnalysis, startAnalysis } from './routes/analysis';
import { health } from './routes/health';
import { createSession, deleteSession, getSession } from './routes/sessions';
import { presignResume } from './routes/uploads';
import { AnalysisService } from './services/analysisService';
import { SessionService } from './services/sessionService';
import { UploadService } from './services/uploadService';

export interface AppDeps {
  env: Pick<Env, 'TABLE_NAME' | 'BUCKET_NAME' | 'WORKER_FUNCTION_NAME'>;
  clients: Pick<AwsClients, 'ddb' | 's3' | 'lambda'>;
  salt: SaltProvider;
  now?: () => number;
}

/** Without deps only unauthenticated, dependency-free routes (health) are served. */
export function createRouter(log: Logger = defaultLogger, deps?: AppDeps): Router {
  if (!deps) return new Router(log).add(routes.health, health);

  const now = deps.now ?? Date.now;
  const repo = new SessionRepository(deps.clients.ddb, deps.env.TABLE_NAME);
  const quotas = new QuotaCounters(deps.clients.ddb, deps.env.TABLE_NAME);
  const sessions = new SessionService({
    repo,
    quotas,
    s3: deps.clients.s3,
    bucketName: deps.env.BUCKET_NAME,
    salt: deps.salt,
    log,
    now,
  });
  const uploads = new UploadService(deps.clients.s3, deps.env.BUCKET_NAME);
  const analysis = new AnalysisService({
    analyses: new AnalysisRepository(deps.clients.ddb, deps.env.TABLE_NAME),
    sessions: repo,
    quotas,
    lambda: deps.clients.lambda,
    workerFunctionName: deps.env.WORKER_FUNCTION_NAME,
    log,
    now,
  });

  return new Router(log, (sessionId, headers) => authenticate(repo, sessionId, headers, now()))
    .add(routes.health, health)
    .add(routes.createSession, createSession(sessions))
    .add(routes.getSession, getSession(sessions))
    .add(routes.deleteSession, deleteSession(sessions))
    .add(routes.presignResume, presignResume(uploads))
    .add(routes.startAnalysis, startAnalysis(analysis))
    .add(routes.getAnalysis, getAnalysis(analysis));
}
