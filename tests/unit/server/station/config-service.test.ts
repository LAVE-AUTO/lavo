/**
 * Unit tests for config-service: getOrCreateConfig, updateConfig.
 * Mocks config-repository.
 */
const mockGetConfigByStationId = jest.fn();
const mockGetPostsByStationId = jest.fn();
const mockGetStationWashPostCount = jest.fn();
const mockUpsertConfig = jest.fn();
const mockUpsertPosts = jest.fn();

jest.mock('@/server/station/config-repository', () => ({
  getConfigByStationId: (...args: unknown[]) => mockGetConfigByStationId(...args),
  getPostsByStationId: (...args: unknown[]) => mockGetPostsByStationId(...args),
  getStationWashPostCount: (...args: unknown[]) => mockGetStationWashPostCount(...args),
  upsertConfig: (...args: unknown[]) => mockUpsertConfig(...args),
  upsertPosts: (...args: unknown[]) => mockUpsertPosts(...args),
}));

import { getOrCreateConfig, updateConfig } from '@/server/station/config-service';

const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('config-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPostsByStationId.mockResolvedValue([]);
  });

  describe('getOrCreateConfig', () => {
    it('returns existing config and posts when config exists', async () => {
      const config = { id: stationId, opening_time: '09:00', closing_time: '18:00' } as any;
      const posts = [{ id: 'p1', station_id: stationId, position: 1, is_active: true }] as any;
      mockGetConfigByStationId.mockResolvedValue(config);
      mockGetPostsByStationId.mockResolvedValue(posts);

      const result = await getOrCreateConfig(stationId);
      expect(result.config).toEqual(config);
      expect(result.posts).toEqual(posts);
      expect(mockUpsertConfig).not.toHaveBeenCalled();
    });

    it('creates default config when none exists and returns it with empty posts', async () => {
      mockGetConfigByStationId.mockResolvedValue(undefined);
      const created = { id: stationId, wash_post_count: 2, max_concurrent_posts: 2 } as any;
      mockUpsertConfig.mockResolvedValue(created);

      const result = await getOrCreateConfig(stationId);
      expect(result.config).toEqual(created);
      expect(result.posts).toEqual([]);
      expect(mockGetStationWashPostCount).not.toHaveBeenCalled();
      expect(mockUpsertConfig).toHaveBeenCalledWith(
        stationId,
        expect.any(Object),
        { existing: undefined }
      );
      const payload = mockUpsertConfig.mock.calls[0][1];
      expect(payload.wash_post_count).toBeUndefined();
      expect(payload.max_concurrent_posts).toBeUndefined();
    });
  });

  describe('updateConfig', () => {
    it('updates config and optional posts', async () => {
      const updatedConfig = { id: stationId, margin_before_minutes: 10 } as any;
      const updatedPosts = [{ id: 'p1', station_id: stationId, position: 1, is_active: false }] as any;
      mockUpsertConfig.mockResolvedValue(updatedConfig);
      mockGetPostsByStationId.mockResolvedValue(updatedPosts);

      const result = await updateConfig(
        stationId,
        { margin_before_minutes: 10 },
        [{ position: 1, is_active: false }]
      );
      expect(result.config).toEqual(updatedConfig);
      expect(result.posts).toEqual(updatedPosts);
      expect(mockUpsertConfig).toHaveBeenCalledWith(stationId, { margin_before_minutes: 10 });
      expect(mockUpsertPosts).toHaveBeenCalledWith(stationId, [{ position: 1, is_active: false }]);
    });

    it('updates config without posts when postsPayload undefined', async () => {
      mockUpsertConfig.mockResolvedValue({ id: stationId } as any);
      mockGetPostsByStationId.mockResolvedValue([]);

      await updateConfig(stationId, { late_tolerance_minutes: 10 });
      expect(mockUpsertPosts).not.toHaveBeenCalled();
    });
  });
});
