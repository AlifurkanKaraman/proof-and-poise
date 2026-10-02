import type { z } from 'zod';
import type { HealthResponseSchema } from '@proof-and-poise/shared';
import type { RouteHandler } from '../lib/router';

export const health: RouteHandler = () => {
  const body: z.infer<typeof HealthResponseSchema> = { status: 'ok' };
  return { body };
};
