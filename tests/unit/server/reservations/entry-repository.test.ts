/**
 * Unit tests for entry-repository. Mocks db (insert, update, query.reservations, select chains).
 * Mock is built inside the factory to avoid Jest hoisting TDZ; refs are exposed on global for assertions.
 */
jest.mock('@/lib/db', () => {
  const mockInsertValues = jest.fn();
  const mockInsertReturning = jest.fn();
  const mockUpdateSet = jest.fn();
  const mockUpdateWhere = jest.fn();
  const mockUpdateReturning = jest.fn();
  const mockFindFirst = jest.fn();
  const mockFindMany = jest.fn();
  const orderByMock = jest.fn().mockResolvedValue([]);
  const fromWhereMock = jest.fn();
  const innerWhereMock = jest.fn().mockResolvedValue([]);
  const leftJoinReturn = {
    where: jest.fn().mockReturnValue({ orderBy: orderByMock }),
  };
  const innerJoinReturn = {
    innerJoin: jest.fn().mockReturnValue({ where: innerWhereMock }),
  };
  const mockFromReturn = {
    where: fromWhereMock,
    leftJoin: jest.fn().mockReturnValue(leftJoinReturn),
    innerJoin: jest.fn().mockReturnValue(innerJoinReturn),
  };
  const mockFrom = jest.fn().mockReturnValue(mockFromReturn);
  const mockSelect = jest.fn().mockReturnValue({ from: mockFrom });
  const updateWhereReturn = {
    returning: mockUpdateReturning,
    then(resolve: (v: unknown) => void) {
      resolve(undefined);
    },
  };
  (global as unknown as { __entryRepoDbMocks: Record<string, jest.Mock> }).__entryRepoDbMocks = {
    mockInsertValues,
    mockInsertReturning,
    mockUpdateSet,
    mockUpdateWhere,
    mockUpdateReturning,
    mockFindFirst,
    mockFindMany,
    orderByMock,
    fromWhereMock,
    innerWhereMock,
  };
  return {
    db: {
      insert: jest.fn().mockReturnValue({
        values: mockInsertValues.mockReturnValue({ returning: mockInsertReturning }),
      }),
      update: jest.fn().mockReturnValue({
        set: mockUpdateSet.mockReturnValue({
          where: mockUpdateWhere.mockReturnValue(updateWhereReturn),
        }),
      }),
      query: {
        reservations: {
          findFirst: mockFindFirst,
          findMany: mockFindMany,
        },
      },
      select: mockSelect,
    },
  };
});

import {
  createReservationEntry,
  createQueueEntry,
  findEntryById,
  findEntryByIdAndUser,
  findEntryByIdAndStation,
  listEntriesByStation,
  listQueueByStation,
  countQueueByStation,
  getNextQueuePosition,
  listEntriesByUser,
  updateEntry,
  shiftQueuePositions,
  listLateUnconfirmedReservations,
} from '@/server/reservations/entry-repository';

const __dbMocks = (global as unknown as { __entryRepoDbMocks: Record<string, jest.Mock> }).__entryRepoDbMocks;
const mockInsertValues = __dbMocks.mockInsertValues;
const mockInsertReturning = __dbMocks.mockInsertReturning;
const mockUpdateSet = __dbMocks.mockUpdateSet;
const mockUpdateWhere = __dbMocks.mockUpdateWhere;
const mockUpdateReturning = __dbMocks.mockUpdateReturning;
const mockFindFirst = __dbMocks.mockFindFirst;
const mockFindMany = __dbMocks.mockFindMany;
const orderByMock = __dbMocks.orderByMock;
const fromWhereMock = __dbMocks.fromWhereMock;
const innerWhereMock = __dbMocks.innerWhereMock;

const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const mockReservationRow = {
  id: validUuid,
  user_id: 'user-1',
  station_id: 'station-1',
  vehicle_format_id: 'format-1',
  entry_type: 'reservation' as const,
  time_slot_id: 'slot-1',
  queue_position: null,
  status: 'pending',
  amount_paid: '12.00',
  commission_rate: '0.1000',
  commission_amount: '1.20',
  station_payout: '10.80',
  stripe_payment_id: null,
  stripe_transfer_id: null,
  stripe_payment_succeeded_at: null,
  stripe_payment_succeeded_notified_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('entry-repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsertReturning.mockResolvedValue([mockReservationRow]);
    mockUpdateReturning.mockResolvedValue([{ ...mockReservationRow, status: 'cancelled' }]);
    fromWhereMock.mockResolvedValue([{ count: 0 }]);
  });

  describe('createReservationEntry', () => {
    it('inserts with entry_type reservation and time_slot_id', async () => {
      const data = {
        user_id: 'user-1',
        station_id: 'station-1',
        vehicle_format_id: 'format-1',
        time_slot_id: 'slot-1',
        status: 'pending',
        amount_paid: '12.00',
        commission_rate: '0.1000',
      };
      const result = await createReservationEntry(data);
      expect(result).toEqual(mockReservationRow);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_type: 'reservation',
          time_slot_id: 'slot-1',
          queue_position: null,
        })
      );
    });

    it('throws when insert returns empty', async () => {
      mockInsertReturning.mockResolvedValueOnce([]);
      await expect(
        createReservationEntry({
          user_id: 'u',
          station_id: 's',
          vehicle_format_id: 'f',
          time_slot_id: 'slot',
          status: 'pending',
          amount_paid: '0',
          commission_rate: '0',
        })
      ).rejects.toThrow('Insert reservation entry failed');
    });
  });

  describe('createQueueEntry', () => {
    it('inserts with entry_type queue and queue_position', async () => {
      const queueRow = { ...mockReservationRow, entry_type: 'queue' as const, time_slot_id: null, queue_position: 1 };
      mockInsertReturning.mockResolvedValueOnce([queueRow]);
      const data = {
        user_id: 'user-1',
        station_id: 'station-1',
        vehicle_format_id: 'format-1',
        queue_position: 1,
        status: 'pending',
        amount_paid: '15.00',
        commission_rate: '0.1000',
      };
      const result = await createQueueEntry(data);
      expect(result.queue_position).toBe(1);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_type: 'queue',
          time_slot_id: null,
          queue_position: 1,
        })
      );
    });
  });

  describe('findEntryById', () => {
    it('returns entry when found', async () => {
      mockFindFirst.mockResolvedValueOnce(mockReservationRow);
      const result = await findEntryById(validUuid);
      expect(result).toEqual(mockReservationRow);
      expect(mockFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.anything() }));
    });

    it('returns undefined when not found', async () => {
      mockFindFirst.mockResolvedValueOnce(undefined);
      const result = await findEntryById(validUuid);
      expect(result).toBeUndefined();
    });
  });

  describe('findEntryByIdAndUser', () => {
    it('returns entry when found for user', async () => {
      mockFindFirst.mockResolvedValueOnce(mockReservationRow);
      const result = await findEntryByIdAndUser(validUuid, 'user-1');
      expect(result).toEqual(mockReservationRow);
    });

    it('returns undefined when not found', async () => {
      mockFindFirst.mockResolvedValueOnce(undefined);
      const result = await findEntryByIdAndUser(validUuid, 'user-1');
      expect(result).toBeUndefined();
    });
  });

  describe('findEntryByIdAndStation', () => {
    it('returns entry when found for station', async () => {
      mockFindFirst.mockResolvedValueOnce(mockReservationRow);
      const result = await findEntryByIdAndStation(validUuid, 'station-1');
      expect(result).toEqual(mockReservationRow);
    });
  });

  describe('listEntriesByStation', () => {
    it('returns list from select chain', async () => {
      const rows = [mockReservationRow];
      orderByMock.mockResolvedValueOnce(rows);
      const result = await listEntriesByStation('station-1');
      expect(result).toEqual(rows);
    });
  });

  describe('listQueueByStation', () => {
    it('returns queue entries from findMany', async () => {
      const rows = [{ ...mockReservationRow, entry_type: 'queue', queue_position: 1 }];
      mockFindMany.mockResolvedValueOnce(rows);
      const result = await listQueueByStation('station-1');
      expect(result).toEqual(rows);
      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.anything(), orderBy: expect.anything() }));
    });
  });

  describe('countQueueByStation', () => {
    it('returns count from select/from/where', async () => {
      fromWhereMock.mockResolvedValueOnce([{ count: 5 }]);
      const result = await countQueueByStation('station-1');
      expect(result).toBe(5);
    });

    it('returns 0 when no rows', async () => {
      fromWhereMock.mockResolvedValueOnce([]);
      const result = await countQueueByStation('station-1');
      expect(result).toBe(0);
    });
  });

  describe('getNextQueuePosition', () => {
    it('returns 1 when max is null', async () => {
      fromWhereMock.mockResolvedValueOnce([{ max: null }]);
      const result = await getNextQueuePosition('station-1');
      expect(result).toBe(1);
    });

    it('returns max + 1 when queue has entries', async () => {
      fromWhereMock.mockResolvedValueOnce([{ max: 3 }]);
      const result = await getNextQueuePosition('station-1');
      expect(result).toBe(4);
    });
  });

  describe('listEntriesByUser', () => {
    it('returns entries from findMany', async () => {
      const rows = [mockReservationRow];
      mockFindMany.mockResolvedValueOnce(rows);
      const result = await listEntriesByUser('user-1');
      expect(result).toEqual(rows);
    });
  });

  describe('updateEntry', () => {
    it('updates and returns row', async () => {
      const updated = { ...mockReservationRow, status: 'cancelled' };
      mockUpdateReturning.mockResolvedValueOnce([updated]);
      const result = await updateEntry(validUuid, { status: 'cancelled', updated_at: new Date() });
      expect(result).toEqual(updated);
      expect(mockUpdateSet).toHaveBeenCalled();
      expect(mockUpdateWhere).toHaveBeenCalled();
    });

    it('throws when update returns empty', async () => {
      mockUpdateReturning.mockResolvedValueOnce([]);
      await expect(
        updateEntry(validUuid, { status: 'cancelled', updated_at: new Date() })
      ).rejects.toThrow('Update entry failed');
    });
  });

  describe('shiftQueuePositions', () => {
    it('calls update with sql for queue_position', async () => {
      mockUpdateWhere.mockResolvedValueOnce(undefined);
      const db = require('@/lib/db').db;
      const updateChain = db.update as jest.Mock;
      updateChain.mockReturnValueOnce({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      });
      const { shiftQueuePositions: shift } = require('@/server/reservations/entry-repository');
      await shift('station-1', 1, 1);
      expect(updateChain).toHaveBeenCalled();
    });
  });

  describe('listLateUnconfirmedReservations', () => {
    it('returns list from innerJoin chain', async () => {
      const rows = [mockReservationRow];
      innerWhereMock.mockResolvedValueOnce(rows);
      const result = await listLateUnconfirmedReservations();
      expect(result).toEqual(rows);
    });
  });

  describe('shiftQueuePositions', () => {
    it('does not call update when delta is 0', async () => {
      const db = require('@/lib/db').db;
      await shiftQueuePositions('station-1', 1, 0);
      expect(db.update).not.toHaveBeenCalled();
    });
    it('calls update when delta is non-zero', async () => {
      const db = require('@/lib/db').db;
      await shiftQueuePositions('station-1', 1, 1);
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('stripe idempotence helpers', () => {
    it('setStripeTransferIdIfMissing returns true when stripe_transfer_id is null', async () => {
      mockUpdateReturning.mockResolvedValueOnce([{ id: validUuid }]);
      const { setStripeTransferIdIfMissing } = require('@/server/reservations/entry-repository');
      const updated = await setStripeTransferIdIfMissing(validUuid, 'tr_123');
      expect(updated).toBe(true);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ stripe_transfer_id: 'tr_123' })
      );
    });

    it('setStripeTransferIdIfMissing returns false when already set (no row updated)', async () => {
      mockUpdateReturning.mockResolvedValueOnce([]);
      const { setStripeTransferIdIfMissing } = require('@/server/reservations/entry-repository');
      const updated = await setStripeTransferIdIfMissing(validUuid, 'tr_123');
      expect(updated).toBe(false);
    });

    it('setStripePaymentSucceededAtIfMissing sets succeeded_at once', async () => {
      mockUpdateReturning.mockResolvedValueOnce([{ id: validUuid }]);
      const { setStripePaymentSucceededAtIfMissing } = require('@/server/reservations/entry-repository');
      const succeededAt = new Date('2026-01-01T00:00:00.000Z');
      const updated = await setStripePaymentSucceededAtIfMissing(validUuid, succeededAt);
      expect(updated).toBe(true);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ stripe_payment_succeeded_at: succeededAt })
      );
    });

    it('setStripePaymentSucceededNotifiedAtIfMissing sets notified_at once', async () => {
      mockUpdateReturning.mockResolvedValueOnce([{ id: validUuid }]);
      const {
        setStripePaymentSucceededNotifiedAtIfMissing,
      } = require('@/server/reservations/entry-repository');
      const notifiedAt = new Date('2026-01-02T00:00:00.000Z');
      const updated = await setStripePaymentSucceededNotifiedAtIfMissing(validUuid, notifiedAt);
      expect(updated).toBe(true);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ stripe_payment_succeeded_notified_at: notifiedAt })
      );
    });
  });
});
