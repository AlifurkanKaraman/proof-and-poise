/** Lambda entry for the HTTP API. Env is validated at cold start (fail fast, Req 15.4). */
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { createRouter } from '../app';
import { loadEnv } from '../lib/env';

export const env = loadEnv(process.env);
const router = createRouter();

export const handler = (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => router.handle(event);
