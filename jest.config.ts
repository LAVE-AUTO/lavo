import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^libphonenumber-js$': '<rootDir>/tests/helpers/mocks/libphonenumber-js.ts',
    '^firebase-admin$': '<rootDir>/tests/helpers/mocks/firebase-admin.ts',
    '^isomorphic-dompurify$': '<rootDir>/tests/helpers/mocks/isomorphic-dompurify.ts',
  },
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    // Playwright E2E specs use @playwright/test — they cannot run under Jest.
    // Playwright has its own config (playwright.config.ts) and runner (npm run test:e2e).
    '<rootDir>/tests/e2e/',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
};

export default createJestConfig(config);
