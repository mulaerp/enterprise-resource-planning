import { defineConfig, devices } from '@playwright/test';

// When PLAYWRIGHT_BASE_URL is set (e.g. Docker runs pointing at the "frontend"
// service), we test against an already-running server instead of spawning our
// own dev server, and default to chromium-only for speed.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const isRemoteTarget = !!process.env.PLAYWRIGHT_BASE_URL;
const useAllBrowsers = !isRemoteTarget || process.env.PLAYWRIGHT_ALL_BROWSERS === '1';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: useAllBrowsers
    ? [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'firefox',
          use: { ...devices['Desktop Firefox'] },
        },
        {
          name: 'webkit',
          use: { ...devices['Desktop Safari'] },
        },
      ]
    : [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
      ],

  ...(isRemoteTarget
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: 'http://localhost:5173',
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
        },
      }),
});
