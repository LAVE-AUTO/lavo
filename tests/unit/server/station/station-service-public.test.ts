/**
 * Unit tests for public stations API service: listStationsPublic, getStationDetailPublic, getStationJoinPublic.
 * Mocks repository layer and db to avoid loading pg (TextEncoder).
 */
jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/lib/email', () => ({}));

const mockStations = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    user_id: null,
    name: 'Station A',
    address: '1 Rue Test',
    city: 'Paris',
    status: 'active',
    is_open: true,
    total_ratings: 0,
    latitude: 48.86,
    longitude: 2.35,
    created_at: new Date(),
    updated_at: new Date(),
    available_slots: '5',
  },
];

const mockStationWithDetail = {
  ...mockStations[0],
  stationConfig: null,
  vehicleFormats: [],
  timeSlots: [],
};

const mockListActiveStations = jest.fn();
const mockFindActiveStationWithDetail = jest.fn();
const mockFindStationById = jest.fn();

jest.mock('@/server/station/station-repository', () => ({
  listActiveStations: (...args: unknown[]) => mockListActiveStations(...args),
  findActiveStationWithDetail: (...args: unknown[]) =>
    mockFindActiveStationWithDetail(...args),
  findStationById: (...args: unknown[]) => mockFindStationById(...args),
}));

import { NotFoundError } from '@/lib/errors';
import {
  listStationsPublic,
  getStationDetailPublic,
  getStationJoinPublic,
} from '@/server/station/station-service';

describe('station-service public API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listStationsPublic', () => {
    it('forwards filters to listActiveStations and returns items with available and available_slots', async () => {
      mockListActiveStations.mockResolvedValueOnce(mockStations);
      const result = await listStationsPublic({
        search: 'Paris',
        city: 'Lyon',
        sort: 'name',
      });
      expect(mockListActiveStations).toHaveBeenCalledWith({
        search: 'Paris',
        city: 'Lyon',
        sort: 'name',
      });
      expect(result).toHaveLength(1);
      expect(result[0].available_slots).toBe(5);
      expect(result[0].available).toBe(true);
      expect(result[0].id).toBe(mockStations[0].id);
      expect(result[0].name).toBe(mockStations[0].name);
    });

    it('passes empty object when no filters', async () => {
      mockListActiveStations.mockResolvedValueOnce([]);
      const result = await listStationsPublic({});
      expect(mockListActiveStations).toHaveBeenCalledWith({});
      expect(result).toEqual([]);
    });

    it('when repository returns available_slots 0, maps to available_slots 0 and available false', async () => {
      const rows = [{ ...mockStations[0], id: 'id-zero', available_slots: '0' }];
      mockListActiveStations.mockResolvedValueOnce(rows);
      const result = await listStationsPublic({});
      expect(result).toHaveLength(1);
      expect(result[0].available_slots).toBe(0);
      expect(result[0].available).toBe(false);
    });

    it('when repository returns negative available_slots (e.g. overbooked), caps to 0 and available false', async () => {
      const rows = [{ ...mockStations[0], id: 'id-neg', available_slots: '-2' }];
      mockListActiveStations.mockResolvedValueOnce(rows);
      const result = await listStationsPublic({});
      expect(result).toHaveLength(1);
      expect(result[0].available_slots).toBe(0);
      expect(result[0].available).toBe(false);
    });
  });

  describe('getStationDetailPublic', () => {
    it('returns station with detail and available/available_slots when active', async () => {
      mockFindActiveStationWithDetail.mockResolvedValueOnce(mockStationWithDetail);
      const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const result = await getStationDetailPublic(id);
      expect(mockFindActiveStationWithDetail).toHaveBeenCalledWith(id);
      expect(result.available_slots).toBe(0);
      expect(result.available).toBe(false);
      expect(result.id).toBe(mockStationWithDetail.id);
      expect(result.stationConfig).toBe(mockStationWithDetail.stationConfig);
      expect(result.timeSlots).toEqual(mockStationWithDetail.timeSlots);
    });

    it('throws NotFoundError when station not found or inactive', async () => {
      mockFindActiveStationWithDetail.mockResolvedValueOnce(undefined);
      await expect(
        getStationDetailPublic('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getStationJoinPublic', () => {
    it('returns mapsUrl from lat/lng when present', async () => {
      mockFindStationById.mockResolvedValueOnce(mockStations[0]);
      const result = await getStationJoinPublic(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      );
      expect(result.mapsUrl).toContain('48.86');
      expect(result.mapsUrl).toContain('2.35');
      expect(result.mapsUrl).toMatch(/^https:\/\/www\.google\.com\/maps\?q=/);
    });

    it('returns mapsUrl from address when lat/lng missing', async () => {
      const noCoords = {
        ...mockStations[0],
        latitude: null,
        longitude: null,
      };
      mockFindStationById.mockResolvedValueOnce(noCoords);
      const result = await getStationJoinPublic(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      );
      expect(result.mapsUrl).toMatch(/^https:\/\/www\.google\.com\/maps\?q=/);
      expect(decodeURIComponent(result.mapsUrl)).toContain('1 Rue Test');
      expect(decodeURIComponent(result.mapsUrl)).toContain('Paris');
    });

    it('throws NotFoundError when station not found', async () => {
      mockFindStationById.mockResolvedValueOnce(undefined);
      await expect(
        getStationJoinPublic('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when station not active', async () => {
      mockFindStationById.mockResolvedValueOnce({
        ...mockStations[0],
        status: 'pending_admin_validation',
      });
      await expect(
        getStationJoinPublic('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
