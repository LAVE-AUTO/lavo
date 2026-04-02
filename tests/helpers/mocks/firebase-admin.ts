/**
 * Stub for firebase-admin in tests.
 * Prevents tests from failing when firebase-admin is not installed.
 * Individual test files override specific methods via jest.mock().
 */

const apps: unknown[] = [];

const admin = {
  apps,
  initializeApp: jest.fn(() => ({ messaging: jest.fn() })),
  credential: {
    cert: jest.fn((c: unknown) => c),
  },
};

export default admin;
