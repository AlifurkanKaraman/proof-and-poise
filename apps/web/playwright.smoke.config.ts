import { defineConfig, devices } from '@playwright/test';

/**
 * Production smoke test (task 24): the demo journey with typed answers against a deployed
 * site. Demo sessions use fixtures, so this makes no Bedrock calls. Each run creates one
 * session per project, which counts toward the per-IP limit of 10 new sessions an hour.
 *
 *   SMOKE_BASE_URL=https://main.<appId>.amplifyapp.com \
 *     pnpm --filter @proof-and-poise/web exec playwright test -c playwright.smoke.config.ts
 */
const baseURL = process.env['SMOKE_BASE_URL'];
if (!baseURL) throw new Error('Set SMOKE_BASE_URL to the deployed site URL.');

export default defineConfig({
  testDir: './e2e',
  testMatch: 'demo-journey.spec.ts',
  grep: /full demo/,
  retries: 1,
  workers: 1,
  reporter: [['list']],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 12'] } },
  ],
});
