/**
 * E2E - Client history page.
 *
 * Authentication required: tests in this file log in as a client before
 * navigating to the protected /fr/client/history route.
 *
 * Covers:
 *   - Page loads without a runtime error (no red error boundary).
 *   - The history list container is visible regardless of whether it
 *     contains entries or shows an empty state.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { ROUTES } from './helpers/fixtures';

test.describe('client history page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'client');
  });

  test('page loads without a runtime error', async ({ page }) => {
    await page.goto(ROUTES.clientHistory);

    /*
     * The page must not show the Next.js error overlay.
     * We assert that no element with role="alert" carrying error-level text
     * is visible, and that the <main> element is rendered.
     */
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });

    await expect(page.locator('text=/application error|runtime error|hydration failed/i')).toHaveCount(0);
  });

  test('history list container is visible (empty state or entries)', async ({ page }) => {
    await page.goto(ROUTES.clientHistory);

    /*
     * ClientHistoryView renders the list directly inside a <div> inside <main>.
     * Whether the API returns entries or falls back to mock data, the container
     * must be present.
     *
     * We assert that the main content area contains text - either reservation
     * entries or an empty-state message.  A minimum character count of 1 rules
     * out a blank render without being brittle to exact copy.
     */
    const mainText = await page.locator('main').innerText({ timeout: 15_000 });
    expect(mainText.trim().length).toBeGreaterThan(0);
  });
});
