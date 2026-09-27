import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import { ErrorResponseSchema, HealthResponseSchema, routes } from '@proof-and-poise/shared';
import { createRouter } from '../app';
import { ApiError } from './errors';
import { createLogger } from './logger';
import { Router } from './router';

function event(method: string, rawPath: string): APIGatewayProxyEventV2 {
  return {
    rawPath,
    requestContext: { requestId: 'req-test', http: { method } },
  } as unknown as APIGatewayProxyEventV2;
}

const silent = () => createLogger(() => {});

describe('router', () => {
  it('serves GET /v1/health matching the shared contract', async () => {
    const res = await createRouter(silent()).handle(event('GET', '/v1/health'));
    expect(res.statusCode).toBe(200);
    expect(HealthResponseSchema.parse(JSON.parse(res.body!))).toEqual({ status: 'ok' });
    expect(res.headers?.['cache-control']).toBe('no-store');
  });

  it.each([
    ['GET', '/v1/nope'],
    ['POST', '/v1/health'],
    ['GET', '/health'],
  ])('returns a NOT_FOUND error body for %s %s', async (method, path) => {
    const res = await createRouter(silent()).handle(event(method, path));
    expect(res.statusCode).toBe(404);
    expect(ErrorResponseSchema.parse(JSON.parse(res.body!)).error.code).toBe('NOT_FOUND');
  });

  it('maps ApiError codes to their HTTP status and keeps field errors', async () => {
    const router = new Router(silent()).add(routes.health, () => {
      throw new ApiError('VALIDATION', undefined, { resume: 'too_short' });
    });
    const res = await router.handle(event('GET', '/v1/health'));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body!)).toEqual({
      error: {
        code: 'VALIDATION',
        message: 'The request is invalid.',
        fields: { resume: 'too_short' },
      },
    });
  });

  it('hides unexpected error details behind INTERNAL and logs only code/name', async () => {
    const lines: string[] = [];
    const router = new Router(createLogger((l) => lines.push(l))).add(routes.health, () => {
      throw new Error('leaky message with resume text');
    });
    const res = await router.handle(event('GET', '/v1/health'));
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('leaky');
    expect(lines.join('')).not.toContain('leaky');
    expect(JSON.parse(res.body!).error.code).toBe('INTERNAL');
  });
});
