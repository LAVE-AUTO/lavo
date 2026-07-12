/**
 * Unit tests for updatePlatformSettings in platform-settings-service.
 *
 * Covers the auto-sync logic for complementary penalty rate keys:
 *   - Single platform_rate  → station_rate auto-calculated and persisted
 *   - Single station_rate   → platform_rate auto-calculated and persisted
 *   - Both keys summing to 1.00 → accepted without modification
 *   - Both keys not summing to 1.00 → ValidationError
 *   - platform_rate out of [0, 1] → ValidationError
 *   - No penalty rate keys → other settings written, no rate logic applied
 *
 * @jest-environment node
 */

// %%%%% Mocks %%%%%

const mockUpsertPlatformSettings = jest.fn().mockResolvedValue(undefined);
const mockGetAllPlatformSettings = jest.fn().mockResolvedValue([]);

jest.mock('@/server/admin/platform-settings-repository', () => ({
  upsertPlatformSettings: (...args: unknown[]) => mockUpsertPlatformSettings(...args),
  getAllPlatformSettings: (...args: unknown[]) => mockGetAllPlatformSettings(...args),
}));

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      settings: {
        findFirst: jest.fn().mockResolvedValue(undefined),
      },
    },
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
  },
}));


// %%%%% Imports %%%%%

import { updatePlatformSettings } from '@/server/admin/platform-settings-service';
import { ValidationError } from '@/lib/errors';


// %%%%% Fixtures %%%%%

const ADMIN_ID = 'admin-uuid-0001';
const PLATFORM_KEY = 'cancellation_penalty_platform_rate';
const STATION_KEY = 'cancellation_penalty_station_rate';
const PLATFORM_SERVICE_FEE_KEY = 'platform_service_fee';


// %%%%% Setup %%%%%

beforeEach(() => {
  jest.clearAllMocks();
});


// %%%%% Tests %%%%%

describe('updatePlatformSettings - penalty rate auto-sync', () => {
  // = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
  // Single key: platform_rate provided
  // = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

  describe('when only platform_rate is provided', () => {
    it('auto-calculates station_rate as 0.40 when platform_rate is 0.60', async () => {
      await updatePlatformSettings(
        { [PLATFORM_KEY]: '0.60' } as Record<typeof PLATFORM_KEY, string>,
        ADMIN_ID
      );

      expect(mockUpsertPlatformSettings).toHaveBeenCalledTimes(1);
      const entries: Array<{ key: string; value: string; updatedBy: string }> =
        mockUpsertPlatformSettings.mock.calls[0][0];

      const platformEntry = entries.find((e) => e.key === PLATFORM_KEY);
      const stationEntry = entries.find((e) => e.key === STATION_KEY);

      expect(platformEntry).toBeDefined();
      expect(platformEntry?.value).toBe('0.60');
      expect(stationEntry).toBeDefined();
      expect(stationEntry?.value).toBe('0.40');
    });

    it('auto-calculates station_rate as 0.00 when platform_rate is 1.00', async () => {
      await updatePlatformSettings(
        { [PLATFORM_KEY]: '1.00' } as Record<typeof PLATFORM_KEY, string>,
        ADMIN_ID
      );

      const entries: Array<{ key: string; value: string }> =
        mockUpsertPlatformSettings.mock.calls[0][0];
      const stationEntry = entries.find((e) => e.key === STATION_KEY);
      expect(stationEntry?.value).toBe('0.00');
    });

    it('auto-calculates station_rate as 1.00 when platform_rate is 0.00', async () => {
      await updatePlatformSettings(
        { [PLATFORM_KEY]: '0.00' } as Record<typeof PLATFORM_KEY, string>,
        ADMIN_ID
      );

      const entries: Array<{ key: string; value: string }> =
        mockUpsertPlatformSettings.mock.calls[0][0];
      const stationEntry = entries.find((e) => e.key === STATION_KEY);
      expect(stationEntry?.value).toBe('1.00');
    });

    it('throws ValidationError when platform_rate > 1 (e.g. 1.10)', async () => {
      await expect(
        updatePlatformSettings(
          { [PLATFORM_KEY]: '1.10' } as Record<typeof PLATFORM_KEY, string>,
          ADMIN_ID
        )
      ).rejects.toThrow(ValidationError);
      expect(mockUpsertPlatformSettings).not.toHaveBeenCalled();
    });

    it('throws ValidationError when platform_rate < 0 (e.g. -0.10)', async () => {
      await expect(
        updatePlatformSettings(
          { [PLATFORM_KEY]: '-0.10' } as Record<typeof PLATFORM_KEY, string>,
          ADMIN_ID
        )
      ).rejects.toThrow(ValidationError);
      expect(mockUpsertPlatformSettings).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Single key: station_rate provided
  // ---------------------------------------------------------------------------

  describe('when only station_rate is provided', () => {
    it('auto-calculates platform_rate as 0.75 when station_rate is 0.25', async () => {
      await updatePlatformSettings(
        { [STATION_KEY]: '0.25' } as Record<typeof STATION_KEY, string>,
        ADMIN_ID
      );

      const entries: Array<{ key: string; value: string; updatedBy: string }> =
        mockUpsertPlatformSettings.mock.calls[0][0];

      const platformEntry = entries.find((e) => e.key === PLATFORM_KEY);
      const stationEntry = entries.find((e) => e.key === STATION_KEY);

      expect(stationEntry).toBeDefined();
      expect(stationEntry?.value).toBe('0.25');
      expect(platformEntry).toBeDefined();
      expect(platformEntry?.value).toBe('0.75');
    });

    it('throws ValidationError when station_rate > 1', async () => {
      await expect(
        updatePlatformSettings(
          { [STATION_KEY]: '1.50' } as Record<typeof STATION_KEY, string>,
          ADMIN_ID
        )
      ).rejects.toThrow(ValidationError);
      expect(mockUpsertPlatformSettings).not.toHaveBeenCalled();
    });

    it('throws ValidationError when station_rate < 0', async () => {
      await expect(
        updatePlatformSettings(
          { [STATION_KEY]: '-0.05' } as Record<typeof STATION_KEY, string>,
          ADMIN_ID
        )
      ).rejects.toThrow(ValidationError);
      expect(mockUpsertPlatformSettings).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Both keys provided
  // ---------------------------------------------------------------------------

  describe('when both platform_rate and station_rate are provided', () => {
    it('accepts and persists both keys when their sum is exactly 1.00', async () => {
      await updatePlatformSettings(
        {
          [PLATFORM_KEY]: '0.70',
          [STATION_KEY]: '0.30',
        } as Record<typeof PLATFORM_KEY | typeof STATION_KEY, string>,
        ADMIN_ID
      );

      expect(mockUpsertPlatformSettings).toHaveBeenCalledTimes(1);
      const entries: Array<{ key: string; value: string }> =
        mockUpsertPlatformSettings.mock.calls[0][0];

      // Exactly the two supplied keys - no extra entry injected
      expect(entries.length).toBe(2);
      expect(entries.find((e) => e.key === PLATFORM_KEY)?.value).toBe('0.70');
      expect(entries.find((e) => e.key === STATION_KEY)?.value).toBe('0.30');
    });

    it('throws ValidationError when both keys are present but their sum is not 1.00', async () => {
      await expect(
        updatePlatformSettings(
          {
            [PLATFORM_KEY]: '0.60',
            [STATION_KEY]: '0.60',
          } as Record<typeof PLATFORM_KEY | typeof STATION_KEY, string>,
          ADMIN_ID
        )
      ).rejects.toThrow(ValidationError);
      expect(mockUpsertPlatformSettings).not.toHaveBeenCalled();
    });

    it('throws ValidationError when sum equals 0.99 (rounding still off)', async () => {
      await expect(
        updatePlatformSettings(
          {
            [PLATFORM_KEY]: '0.50',
            [STATION_KEY]: '0.49',
          } as Record<typeof PLATFORM_KEY | typeof STATION_KEY, string>,
          ADMIN_ID
        )
      ).rejects.toThrow(ValidationError);
      expect(mockUpsertPlatformSettings).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // No penalty rate keys in payload
  // ---------------------------------------------------------------------------

  describe('when neither penalty rate key is in the payload', () => {
    it('writes other settings without penalty rate logic', async () => {
      await updatePlatformSettings(
        { cancellation_free_window_minutes: '45' },
        ADMIN_ID
      );

      expect(mockUpsertPlatformSettings).toHaveBeenCalledTimes(1);
      const entries: Array<{ key: string; value: string }> =
        mockUpsertPlatformSettings.mock.calls[0][0];

      // Only the supplied key - no rate keys injected
      expect(entries.length).toBe(1);
      expect(entries[0].key).toBe('cancellation_free_window_minutes');
      expect(entries[0].value).toBe('45');
    });

    it('does not call upsert for rate keys when other keys are provided', async () => {
      await updatePlatformSettings(
        { rating_window_days: '7' },
        ADMIN_ID
      );

      const entries: Array<{ key: string }> =
        mockUpsertPlatformSettings.mock.calls[0][0];
      const rateKeys = entries.filter(
        (e) => e.key === PLATFORM_KEY || e.key === STATION_KEY
      );
      expect(rateKeys).toHaveLength(0);
    });

    it('persists platform_service_fee as a regular admin setting', async () => {
      await updatePlatformSettings(
        { [PLATFORM_SERVICE_FEE_KEY]: '1.99' } as Record<typeof PLATFORM_SERVICE_FEE_KEY, string>,
        ADMIN_ID
      );

      expect(mockUpsertPlatformSettings).toHaveBeenCalledTimes(1);
      const entries: Array<{ key: string; value: string }> =
        mockUpsertPlatformSettings.mock.calls[0][0];

      expect(entries).toEqual([
        {
          key: PLATFORM_SERVICE_FEE_KEY,
          value: '1.99',
          updatedBy: ADMIN_ID,
        },
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // Cache invalidation
  // ---------------------------------------------------------------------------

  describe('cache invalidation', () => {
    it('invalidates both rate keys when only platform_rate is provided', async () => {
      // The service uses an internal in-process Map - we verify behaviour indirectly
      // by confirming the upsert receives both keys (meaning both will be invalidated).
      await updatePlatformSettings(
        { [PLATFORM_KEY]: '0.55' } as Record<typeof PLATFORM_KEY, string>,
        ADMIN_ID
      );

      const entries: Array<{ key: string }> =
        mockUpsertPlatformSettings.mock.calls[0][0];
      const keys = entries.map((e) => e.key);
      expect(keys).toContain(PLATFORM_KEY);
      expect(keys).toContain(STATION_KEY);
    });

    it('invalidates both rate keys when only station_rate is provided', async () => {
      await updatePlatformSettings(
        { [STATION_KEY]: '0.40' } as Record<typeof STATION_KEY, string>,
        ADMIN_ID
      );

      const entries: Array<{ key: string }> =
        mockUpsertPlatformSettings.mock.calls[0][0];
      const keys = entries.map((e) => e.key);
      expect(keys).toContain(PLATFORM_KEY);
      expect(keys).toContain(STATION_KEY);
    });
  });
});
