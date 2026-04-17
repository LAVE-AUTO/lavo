/**
 * Ensures rate-limiter refuses to load when RATE_LIMIT_MAX_ATTEMPTS is below 2.
 * Mocks @/lib/db so module evaluation does not require DATABASE_URL.
 */
/** @jest-environment node */

describe('rate-limiter module load assert', () => {
  it('throws when RATE_LIMIT_MAX_ATTEMPTS is less than 2', () => {
    jest.isolateModules(() => {
      jest.doMock('@/lib/db', () => ({ db: {} }));
      jest.doMock('@/helpers/constants', () => {
        const actual = jest.requireActual<typeof import('@/helpers/constants')>(
          '@/helpers/constants'
        );
        return { ...actual, RATE_LIMIT_MAX_ATTEMPTS: 1 };
      });
      expect(() => {
        require('@/lib/rate-limiter');
      }).toThrow(/RATE_LIMIT_MAX_ATTEMPTS must be at least 2/);
    });
  });

  it('loads when RATE_LIMIT_MAX_ATTEMPTS is exactly 2', () => {
    jest.isolateModules(() => {
      jest.doMock('@/lib/db', () => ({ db: {} }));
      jest.doMock('@/helpers/constants', () => {
        const actual = jest.requireActual<typeof import('@/helpers/constants')>(
          '@/helpers/constants'
        );
        return { ...actual, RATE_LIMIT_MAX_ATTEMPTS: 2 };
      });
      expect(() => {
        require('@/lib/rate-limiter');
      }).not.toThrow();
    });
  });
});
