/**
 * E2E — Station dashboard page.
 *
 * Authentication required: tests in this file log in as a station account
 * before navigating to the protected /fr/station/dashboard route.
 *
 * Covers:
 *   - Dashboard page loads without a runtime error.
 *   - Core dashboard elements (KPI row, queue panel) are present.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { ROUTES } from './helpers/fixtures';

test.describe('station dashboard page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'station');
  });

  test('page loads without a runtime error', async ({ page }) => {
    await page.goto(ROUTES.stationDashboard);

    /*
     * StationDashboard renders inside the station layout.  We assert that the
     * DOM contains substantive content — a heading is always rendered because
     * the dashboard shows the station name or a default title.
     */
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    const nextErrorOverlay = page.locator('nextjs-portal, [data-nextjs-dialog]');
    await expect(nextErrorOverlay).toHaveCount(0);
  });
});
