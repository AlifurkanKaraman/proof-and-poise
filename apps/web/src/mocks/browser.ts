import { setupWorker } from 'msw/browser';
import { parseMockFault, setMockFault } from './controls';
import { createMockDb } from './db';
import { createHandlers } from './handlers';

const FAULT_STORAGE_KEY = 'proof-and-poise.mockFault';

/**
 * Starts the MSW service worker. Loaded only by `pnpm dev:mock` (`vite --mode mock`);
 * `main.tsx` imports it behind a build-time check, so production bundles never include it.
 *
 * Error toggle: `?mockError=<fault>` or `?mockError=<route>:<fault>` (see `controls.ts`);
 * the choice is kept for the tab until `?mockError=off`.
 */
export async function startMockApi() {
  const store = window.sessionStorage;
  const requested = new URLSearchParams(window.location.search).get('mockError');
  if (requested !== null) {
    if (parseMockFault(requested) === undefined) store.removeItem(FAULT_STORAGE_KEY);
    else store.setItem(FAULT_STORAGE_KEY, requested);
  }
  setMockFault(parseMockFault(store.getItem(FAULT_STORAGE_KEY)) ?? null);

  // Sessions persist in sessionStorage so a reload behaves like the real API (Req 2.6).
  const worker = setupWorker(...createHandlers(createMockDb({ storage: store })));
  await worker.start({ onUnhandledRequest: 'bypass' });
}
