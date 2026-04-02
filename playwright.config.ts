import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration.
 *
 * Base URL: override via PLAYWRIGHT_BASE_URL environment variable.
 * Default points at the local Next.js dev server.
 *
 * Tests live in tests/e2e/ and are kept separate from the Jest suites
 * so that jest.config.ts is never touched by the E2E layer.
 */
export default defineConfig({
  testDir: './tests/e2e',

  /* Maximum time a single test may run before it is considered failed. */
  timeout: 30_000,

  /* Run all tests inside each spec file in sequence (no parallelism per file).
     This avoids flakiness caused by shared auth state during early rollout. */
  fullyParallel: false,

  /* Fail the CI run immediately on the first test file failure.
     Remove this when the test suite is large enough to benefit from continuations. */
  forbidOnly: !!process.env.CI,

  /* No retries by default; add CI-level retries once a staging server is stable. */
  retries: 0,

  /* Single worker keeps things predictable while the suite is small. */
  workers: 1,

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],

  use: {
    /* All tests run against this base URL. Override for staging/preview deploys. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',

    /* Locale and timezone match the primary market. */
    locale: 'fr',
    timezoneId: 'Europe/Paris',

    /* Capture screenshot and trace only on failure to keep artifact size small. */
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
