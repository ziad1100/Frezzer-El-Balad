import { defineConfig, devices } from '@playwright/test';

// E2E tests target the Vite dev server (port 5173) by default — it proxies
// /api to the local backend (docker stack on :5000). To run the same suite
// against the Docker production build instead, set E2E_BASE_URL:
//   E2E_BASE_URL=http://localhost:5000 npm run test:e2e
// When targeting a non-dev URL, Playwright skips starting the dev server.
const baseURL = (process.env.E2E_BASE_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
const isDevServer = baseURL.includes('5173');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: isDevServer
    ? {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
