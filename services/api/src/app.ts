import { routes } from '@proof-and-poise/shared';
import { AnalysisRepository } from './data/analysisRepository';
import { InterviewRepository } from './data/interviewRepository';
import { QuotaCounters } from './data/quotas';
import { ReportRepository } from './data/reportRepository';
import { SessionRepository } from './data/sessionRepository';
import { TranscriptionRepository } from './data/transcriptionRepository';
import { authenticate } from './lib/auth';
import type { AwsClients } from './lib/aws';
import type { Env } from './lib/env';
import { logger as defaultLogger, type Logger } from './lib/logger';
import { Router } from './lib/router';
import type { SaltProvider } from './lib/salt';
import { getAnalysis, startAnalysis } from './routes/analysis';
import { createConfirmation, decideRecommendation } from './routes/decisions';
import { health } from './routes/health';
import { getInterview, startInterview, submitAnswer } from './routes/interview';
import { createReport, getReport, startPractice } from './routes/report';
import { createSession, deleteSession, getSession } from './routes/sessions';
import { getTranscription, presignAudio, startTranscription } from './routes/transcription';
import { presignResume } from './routes/uploads';
import { AnalysisService } from './services/analysisService';
import { DecisionService } from './services/decisionService';
import { InterviewService } from './services/interviewService';
import { ReportService } from './services/reportService';
import { SessionService } from './services/sessionService';
import { TranscriptionService } from './services/transcriptionService';
import { UploadService } from './services/uploadService';

export interface AppDeps {
  env: Pick<Env, 'TABLE_NAME' | 'BUCKET_NAME' | 'WORKER_FUNCTION_NAME' | 'MODEL_ID'>;
  clients: Pick<AwsClients, 'ddb' | 's3' | 'lambda' | 'bedrock' | 'transcribe'>;
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
  const transcription = new TranscriptionService({
    repo: new TranscriptionRepository(deps.clients.ddb, deps.env.TABLE_NAME),
    quotas,
    transcribe: deps.clients.transcribe,
    s3: deps.clients.s3,
    bucketName: deps.env.BUCKET_NAME,
    log,
    now,
  });

  const decisions = new DecisionService({
    analyses: new AnalysisRepository(deps.clients.ddb, deps.env.TABLE_NAME),
    quotas,
    model: {
      bedrock: deps.clients.bedrock,
      modelId: deps.env.MODEL_ID,
      quotas,
      log,
      now,
    },
    log,
    now,
  });

  const interview = new InterviewService({
    interviews: new InterviewRepository(deps.clients.ddb, deps.env.TABLE_NAME),
    analyses: new AnalysisRepository(deps.clients.ddb, deps.env.TABLE_NAME),
    sessions: repo,
    quotas,
    model: { bedrock: deps.clients.bedrock, modelId: deps.env.MODEL_ID, quotas, log, now },
    log,
    now,
  });

  const reports = new ReportService({
    reports: new ReportRepository(deps.clients.ddb, deps.env.TABLE_NAME),
    interviews: new InterviewRepository(deps.clients.ddb, deps.env.TABLE_NAME),
    analyses: new AnalysisRepository(deps.clients.ddb, deps.env.TABLE_NAME),
    sessions: repo,
    quotas,
    model: { bedrock: deps.clients.bedrock, modelId: deps.env.MODEL_ID, quotas, log, now },
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
    .add(routes.getAnalysis, getAnalysis(analysis))
    .add(routes.decideRecommendation, decideRecommendation(decisions))
    .add(routes.createConfirmation, createConfirmation(decisions))
    .add(routes.startInterview, startInterview(interview))
    .add(routes.getInterview, getInterview(interview))
    .add(routes.submitAnswer, submitAnswer(interview))
    .add(routes.presignAudio, presignAudio(uploads))
    .add(routes.startTranscription, startTranscription(transcription))
    .add(routes.getTranscription, getTranscription(transcription))
    .add(routes.createReport, createReport(reports))
    .add(routes.getReport, getReport(reports))
    .add(routes.startPractice, startPractice(interview));
}
