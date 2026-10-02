import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Serves MSW's service worker from node_modules, only under `vite --mode mock`
 * (`pnpm dev:mock`). Nothing is copied into `public/`, so production builds never
 * contain the worker (design §10).
 */
function mswWorker(): Plugin {
  const workerPath = createRequire(import.meta.url).resolve('msw/mockServiceWorker.js');
  return {
    name: 'proof-and-poise:msw-worker',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/mockServiceWorker.js', (_req, res) => {
        void readFile(workerPath).then((body) => {
          res.setHeader('Content-Type', 'text/javascript');
          res.setHeader('Cache-Control', 'no-store');
          res.end(body);
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'mock' ? [mswWorker()] : [])],
  server: { port: 5173, strictPort: true },
  build: { sourcemap: false },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
}));
