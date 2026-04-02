/**
 * E2E — Admin dashboard page.
 *
 * Authentication required: tests in this file log in as an admin before
 * navigating to the protected /fr/admin/dashboard route.
 *
 * Covers:
 *   - Dashboard page loads without a runtime error.
 *   - The 4 KPI cards are present and visible on the page.
 *
 * The KPI row is rendered by AdminKpiRow as a CSS grid with 4 cells.
 * Each cell is a KpiCard rendered as a <div> with the class "rounded-2xl".
 * Because the data is currently mocked, the cards always render regardless
 * of API availability.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { ROUTES } from './helpers/fixtures';

test.describe('admin dashboard page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('page loads without a runtime error', async ({ page }) => {
    await page.goto(ROUTES.adminDashboard);

    /* The layout wraps the dashboard in a flex container; main content must render. */
    await expect(page.locator('main, [role="main"], .flex-1').first()).toBeVisible({
      timeout: 15_000,
    });

    const nextErrorOverlay = page.locator('nextjs-portal, [data-nextjs-dialog]');
    await expect(nextErrorOverlay).toHaveCount(0);
  });

  test('four KPI cards are visible on the dashboard', async ({ page }) => {
    await page.goto(ROUTES.adminDashboard);

    /*
     * AdminKpiRow renders a grid of 4 KpiCard components.
     * Each KpiCard is a <div> with Tailwind class "rounded-2xl" and contains
     * a sparkline and a value.
     *
     * We select KPI cards by the characteristic combination of classes that
     * every KpiCard receives.  The selector targets elements that have both
     * "rounded-2xl" and "shadow-sm" in their class list, which are unique to
     * KpiCard within the dashboard page.
     */
    const kpiCards = page.locator('.rounded-2xl.shadow-sm');
    await expect(kpiCards.first()).toBeVisible({ timeout: 15_000 });
    const count = await kpiCards.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });
});
