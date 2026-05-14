/**
 * E2E - Authentication flows.
 *
 * Covers:
 *   - Client login with valid credentials redirects to /fr/stations.
 *   - Client login with invalid credentials shows an inline error message.
 *   - Station login with valid credentials redirects to /fr/station.
 *   - Admin login with valid credentials redirects to /fr/admin.
 *   - Direct navigation to /fr/admin without an auth cookie redirects to login.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { ROUTES } from './helpers/fixtures';

// ---------------------------------------------------------------------------
// Client login
// ---------------------------------------------------------------------------

test('client login with valid credentials redirects to /fr/stations', async ({ page }) => {
  await loginAs(page, 'client');
  await expect(page).toHaveURL(/\/fr\/stations/, { timeout: 15_000 });
});

test('client login with wrong credentials shows an error message', async ({ page }) => {
  await page.goto(ROUTES.loginClient);

  await page.locator('input[type="email"]').fill('invalid@example.com');
  await page.locator('input[type="password"]').fill('wrong-password-123');
  await page.locator('button[type="submit"]').click();

  /*
   * The LoginForm component sets inline field errors when the server returns
   * INVALID_CREDENTIALS or UNAUTHORIZED.  We wait for any of the recognised
   * error indicators to become visible.
   *
   * Acceptable selectors (at least one must appear):
   *   - An element with role="alert"
   *   - A visible element whose text contains the French error string
   *   - An input that gained an error state (aria-invalid="true")
   */
  const errorVisible = page.locator('[role="alert"], [aria-invalid="true"]').first();
  await expect(errorVisible).toBeVisible({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// Station login
// ---------------------------------------------------------------------------

test('station login with valid credentials redirects to /fr/station', async ({ page }) => {
  await loginAs(page, 'station');
  await expect(page).toHaveURL(/\/fr\/station/, { timeout: 15_000 });
});

// ---------------------------------------------------------------------------
// Admin login
// ---------------------------------------------------------------------------

test('admin login with valid credentials redirects to /fr/admin', async ({ page }) => {
  await loginAs(page, 'admin');
  await expect(page).toHaveURL(/\/fr\/admin/, { timeout: 15_000 });
});

// ---------------------------------------------------------------------------
// Admin route guard
// ---------------------------------------------------------------------------

test('accessing /fr/admin without auth redirects to the login page', async ({ page }) => {
  /*
   * The Next.js middleware checks for the Hurryline_admin_session cookie and
   * redirects to /fr/login when absent.  A fresh browser context has no
   * cookies, so this request must always land on the login page.
   */
  await page.goto('/fr/admin');
  await expect(page).toHaveURL(/\/fr\/login/, { timeout: 10_000 });
});
