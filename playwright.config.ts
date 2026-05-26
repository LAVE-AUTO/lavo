import { defineConfig, devices } from '@playwright/test';

const e2ePort = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const e2eBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${e2ePort}`;

/**
 * Playwright E2E configuration.
 *
 * Base URL defaults to an isolated local server booted by Playwright
 * so tests never hit an unrelated app running on localhost:3000.
 */
export default defineConfig({
  testDir: './tests/e2e',

  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],

  use: {
    baseURL: e2eBaseUrl,
    locale: 'fr',
    timezoneId: 'Europe/Paris',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  webServer: {
    command: `NEXT_PUBLIC_APP_URL=${e2eBaseUrl} NEXTAUTH_URL=${e2eBaseUrl} npm run dev -- --port ${e2ePort}`,
    url: e2eBaseUrl,
    reuseExistingServer: true,
    timeout: 120_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
