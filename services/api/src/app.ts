import { routes } from '@proof-and-poise/shared';
import type { Logger } from './lib/logger';
import { Router } from './lib/router';
import { health } from './routes/health';

export function createRouter(log?: Logger): Router {
  return new Router(log).add(routes.health, health);
}
