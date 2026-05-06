import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import {
  TEST_CLIENT_EMAIL,
  TEST_CLIENT_PASSWORD,
  TEST_STATION_EMAIL,
  TEST_STATION_PASSWORD,
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  ROUTES,
} from './fixtures';

export type Role = 'client' | 'station' | 'admin';

interface RoleConfig {
  loginUrl: string;
  email: string;
  password: string;
  /** URL fragment the app must navigate to after a successful login. */
  expectedPathFragment: string;
}

const ROLE_CONFIG: Record<Role, RoleConfig> = {
  client: {
    loginUrl:             ROUTES.loginClient,
    email:                TEST_CLIENT_EMAIL,
    password:             TEST_CLIENT_PASSWORD,
    expectedPathFragment: '/fr/stations',
  },
  station: {
    loginUrl:             ROUTES.loginStation,
    email:                TEST_STATION_EMAIL,
    password:             TEST_STATION_PASSWORD,
    expectedPathFragment: '/fr/station',
  },
  admin: {
    loginUrl:             ROUTES.loginAdmin,
    email:                TEST_ADMIN_EMAIL,
    password:             TEST_ADMIN_PASSWORD,
    expectedPathFragment: '/fr/admin',
  },
};

/**
 * Navigate to the role-appropriate login page, fill in credentials from
 * environment variables, submit the form, and assert that the browser
 * has been redirected to the post-login destination.
 *
 * Precondition: environment variables E2E_<ROLE>_EMAIL and E2E_<ROLE>_PASSWORD
 * must be set.  If they are empty the test will fail with a clear message
 * during the form fill rather than silently logging in as an anonymous user.
 */
export async function loginAs(page: Page, role: Role): Promise<void> {
  const config = ROLE_CONFIG[role];

  if (!config.email || !config.password) {
    throw new Error(
      `E2E credentials for role "${role}" are not set. ` +
      `Provide E2E_${role.toUpperCase()}_EMAIL and E2E_${role.toUpperCase()}_PASSWORD.`,
    );
  }

  await page.goto(config.loginUrl);

  /* Fill email - the field carries type="email" and an autoComplete="email" attribute */
  await page.locator('input[type="email"]').fill(config.email);

  /* Fill password */
  await page.locator('input[type="password"]').fill(config.password);

  /* Submit the form */
  await page.locator('button[type="submit"]').click();

  /* Wait for redirect - the app navigates via next/navigation after login */
  await expect(page).toHaveURL(
    new RegExp(config.expectedPathFragment.replace(/[/]/g, '\\/')),
    { timeout: 15_000 },
  );
}
