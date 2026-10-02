import { setupServer } from 'msw/node';
import { createMockDb, type MockDbOptions } from './db';
import { createHandlers } from './handlers';

/** Mock API for Vitest (Node). Each call gets its own in-memory DB. */
export function createMockServer(options: MockDbOptions = {}) {
  const db = createMockDb(options);
  return { server: setupServer(...createHandlers(db)), db };
}
