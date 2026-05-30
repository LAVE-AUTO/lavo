/**
 * E2E test fixture constants.
 *
 * All credentials are read from environment variables at runtime.
 * Never hard-code real credentials here.
 *
 * Required environment variables:
 *   E2E_CLIENT_EMAIL        - email of the test client account
 *   E2E_CLIENT_PASSWORD     - password of the test client account
 *   E2E_STATION_EMAIL       - email of the test station account
 *   E2E_STATION_PASSWORD    - password of the test station account
 *   E2E_ADMIN_EMAIL         - email of the test admin account
 *   E2E_ADMIN_PASSWORD      - password of the test admin account
 */

export const TEST_CLIENT_EMAIL    = process.env.E2E_CLIENT_EMAIL    ?? '';
export const TEST_CLIENT_PASSWORD = process.env.E2E_CLIENT_PASSWORD ?? '';

export const TEST_STATION_EMAIL    = process.env.E2E_STATION_EMAIL    ?? '';
export const TEST_STATION_PASSWORD = process.env.E2E_STATION_PASSWORD ?? '';

export const TEST_ADMIN_EMAIL    = process.env.E2E_ADMIN_EMAIL    ?? '';
export const TEST_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';

/**
 * Routes used across the E2E suite.
 * All paths are locale-prefixed for the default locale (fr).
 */
export const ROUTES = {
  loginClient:  '/fr/login',
  loginStation: '/fr/station/login',
  loginAdmin:   '/fr/login/admin',
  stations:     '/fr/stations',
  clientHistory: '/fr/client/history',
  adminDashboard: '/fr/admin/dashboard',
  stationDashboard: '/fr/station/dashboard',
} as const;
