/**
 * Unit tests for station repository: listActiveStations, findActiveStationWithDetail.
 * Mocks the database layer to assert filter/sort usage and return values.
 */
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
    created_at: new Date(),
    updated_at: new Date(),
    available_slots: '3',
  },
];

const mockStationWithDetail = {
  ...mockStations[0],
  stationConfig: null,
  vehicleFormats: [],
  timeSlots: [],
};

const chain = {
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockResolvedValue([]),
  then(resolve: (v: unknown) => void) {
    resolve([]);
  },
};

const mockFindFirst = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(() => chain),
    query: {
      stations: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
  },
}));

import {
  listActiveStations,
  findActiveStationWithDetail,
} from '@/server/station/station-repository';

describe('station repository', () => {
  beforeEach(() => {
    chain.where.mockReturnValue(chain);
    chain.orderBy.mockResolvedValue([]);
    chain.then = function (resolve: (v: unknown) => void) {
      resolve([]);
    };
    mockFindFirst.mockResolvedValue(undefined);
  });

  describe('listActiveStations', () => {
    it('applies where clause and returns array when no sort', async () => {
      const result = await listActiveStations({});
      expect(result).toEqual([]);
      expect(chain.where).toHaveBeenCalled();
      expect(chain.orderBy).not.toHaveBeenCalled();
    });

    it('calls orderBy when sort is name', async () => {
      await listActiveStations({ sort: 'name' });
      expect(chain.orderBy).toHaveBeenCalled();
    });

    it('calls orderBy when sort is slots_asc', async () => {
      await listActiveStations({ sort: 'slots_asc' });
      expect(chain.orderBy).toHaveBeenCalled();
    });

    it('calls orderBy when sort is slots_desc', async () => {
      await listActiveStations({ sort: 'slots_desc' });
      expect(chain.orderBy).toHaveBeenCalled();
    });

    it('returns stations from orderBy promise when sort provided', async () => {
      chain.orderBy.mockResolvedValueOnce(mockStations);
      const result = await listActiveStations({ sort: 'name' });
      expect(result).toEqual(mockStations);
    });
  });

  describe('findActiveStationWithDetail', () => {
    it('calls findFirst with where and with relations', async () => {
      mockFindFirst.mockResolvedValueOnce(mockStationWithDetail);
      const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const result = await findActiveStationWithDetail(id);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          with: {
            stationConfig: true,
            vehicleFormats: true,
            timeSlots: true,
          },
        })
      );
      expect(result).toEqual(mockStationWithDetail);
    });

    it('returns undefined when findFirst resolves undefined', async () => {
      mockFindFirst.mockResolvedValueOnce(undefined);
      const result = await findActiveStationWithDetail('00000000-0000-0000-0000-000000000000');
      expect(result).toBeUndefined();
    });
  });
});
