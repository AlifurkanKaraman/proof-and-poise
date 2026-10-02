import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Proof & Poise e2e tests (Task 22).
 * Tests run against the dev server in mock mode (MSW).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      // Device presets pick the browser: 'Pixel 7' is Chromium, 'iPhone 12' is WebKit.
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 375, height: 667 },
      },
    },
    {
      name: 'webkit-mobile',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 375, height: 667 },
      },
    },
    {
      name: 'webkit-desktop',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  webServer: {
    command: 'pnpm dev:mock',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
