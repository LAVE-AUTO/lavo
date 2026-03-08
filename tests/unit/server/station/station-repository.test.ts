/**
 * Unit tests for station repository: listActiveStations, listActiveStationsGroup, findActiveStationWithDetail.
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
    completed_count: '5',
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
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  then(resolve: (v: unknown) => void) {
    resolve([]);
  },
};

let selectCallIndex = 0;
const getCountPromise = (count: number) => ({
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnValue(Promise.resolve([{ count }])),
});

jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
    query: {
      stations: {
        findFirst: jest.fn().mockResolvedValue(undefined),
      },
    },
  },
}));

import { db } from '@/lib/db';
import {
  listActiveStations,
  listActiveStationsGroup,
  findActiveStationWithDetail,
} from '@/server/station/station-repository';

const mockSelect = db.select as jest.Mock;
const mockFindFirst = (db.query.stations as { findFirst: jest.Mock }).findFirst;

describe('station repository', () => {
  beforeEach(() => {
    selectCallIndex = 0;
    mockSelect.mockImplementation(() => {
      selectCallIndex += 1;
      if (selectCallIndex === 1) return chain;
      return getCountPromise(0);
    });
    mockFindFirst.mockResolvedValue(undefined);
    chain.where.mockReturnValue(chain);
    chain.orderBy.mockReturnValue(chain);
    chain.limit.mockReturnValue(chain);
    chain.offset.mockReturnValue(chain);
    chain.then = function (resolve: (v: unknown) => void) {
      resolve([]);
    };
  });

  describe('listActiveStations', () => {
    it('returns { rows, total } and applies where clause', async () => {
      const result = await listActiveStations({});
      expect(result).toEqual({ rows: [], total: 0 });
      expect(chain.where).toHaveBeenCalled();
    });

    it('calls orderBy when sort array provided', async () => {
      await listActiveStations({ sort: ['name_asc'] });
      expect(chain.orderBy).toHaveBeenCalled();
    });

    it('calls orderBy when sort is slots_asc', async () => {
      await listActiveStations({ sort: ['slots_asc'] });
      expect(chain.orderBy).toHaveBeenCalled();
    });

    it('calls orderBy when sort is slots_desc', async () => {
      await listActiveStations({ sort: ['slots_desc'] });
      expect(chain.orderBy).toHaveBeenCalled();
    });

    it('returns rows and total from list query and count query', async () => {
      selectCallIndex = 0;
      mockSelect.mockImplementation(() => {
        selectCallIndex += 1;
        if (selectCallIndex === 1) {
          chain.then = (resolve: (v: unknown) => void) => resolve(mockStations);
          return chain;
        }
        return getCountPromise(1);
      });
      const result = await listActiveStations({ sort: ['name_asc'] });
      expect(result.rows).toEqual(mockStations);
      expect(result.total).toBe(1);
    });

    it('applies limit and offset for pagination', async () => {
      await listActiveStations({ page: 2, per_page: 10 });
      expect(chain.limit).toHaveBeenCalledWith(10);
      expect(chain.offset).toHaveBeenCalledWith(10);
    });

    it('accepts format_id filter and applies where', async () => {
      const result = await listActiveStations({
        format_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      });
      expect(result).toEqual({ rows: [], total: 0 });
      expect(chain.where).toHaveBeenCalled();
    });
  });

  describe('listActiveStationsGroup', () => {
    it('returns array of stations with limit', async () => {
      chain.then = function (resolve: (v: unknown) => void) {
        resolve(mockStations);
      };
      const result = await listActiveStationsGroup('most_visited', { sort: ['completed_count_desc'] }, 5);
      expect(result).toEqual(mockStations);
      expect(chain.limit).toHaveBeenCalledWith(5);
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
