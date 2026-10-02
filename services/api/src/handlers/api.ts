/** Lambda entry for the HTTP API. Env is validated at cold start (fail fast, Req 15.4). */
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { createRouter } from '../app';
import { createAwsClients } from '../lib/aws';
import { loadEnv } from '../lib/env';
import { logger } from '../lib/logger';
import { createSaltProvider } from '../lib/salt';

export const env = loadEnv(process.env);
const clients = createAwsClients();
const salt = createSaltProvider(clients.ssm, env.IP_HASH_SALT_PARAM);
// Read the salt at cold start (Req 16.3). A failure is retried on first use.
salt().catch((err: unknown) => logger.error('salt_prefetch_failed', err));

const router = createRouter(logger, { env, clients, salt });

export const handler = (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => router.handle(event);
