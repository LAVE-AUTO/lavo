/**
 * Unit tests for queue-service: joinQueue, listQueue, moveReservationToQueue (mocked deps).
 * @jest-environment node
 */
const mockFindFormatByIdAndStation = jest.fn();
const mockProcessPayment = jest.fn();
const mockNotifyEntry = jest.fn();
const mockCreateQueueEntry = jest.fn();
const mockListQueueByStation = jest.fn();
const mockFindEntryById = jest.fn();
const mockCountQueueByStation = jest.fn();
const mockUpdateEntry = jest.fn();
const mockShiftQueuePositions = jest.fn();
const mockDecrementSlotBookedCount = jest.fn();

jest.mock('@/server/station/format-repository', () => ({
  findFormatByIdAndStation: (...args: unknown[]) => mockFindFormatByIdAndStation(...args),
}));
jest.mock('@/server/station/slot-repository', () => ({
  decrementSlotBookedCount: (...args: unknown[]) => mockDecrementSlotBookedCount(...args),
}));
jest.mock('@/server/payments/payment-service', () => ({
  processPayment: (...args: unknown[]) => mockProcessPayment(...args),
}));
jest.mock('@/server/notifications/notification-service', () => ({
  notifyEntry: (...args: unknown[]) => mockNotifyEntry(...args),
}));
jest.mock('@/server/reservations/entry-repository', () => ({
  createQueueEntry: (...args: unknown[]) => mockCreateQueueEntry(...args),
  listQueueByStation: (...args: unknown[]) => mockListQueueByStation(...args),
  findEntryById: (...args: unknown[]) => mockFindEntryById(...args),
  countQueueByStation: (...args: unknown[]) => mockCountQueueByStation(...args),
  updateEntry: (...args: unknown[]) => mockUpdateEntry(...args),
  shiftQueuePositions: (...args: unknown[]) => mockShiftQueuePositions(...args),
  getNextQueuePosition: jest.fn().mockResolvedValue(1),
  hasActiveEntryAtStation: jest.fn().mockResolvedValue(false),
}));

jest.mock('@/lib/db', () => ({
  db: {
    transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({})),
  },
}));

import { joinQueue, listQueue, moveReservationToQueue } from '@/server/reservations/queue-service';
import { NotFoundError, ConflictError } from '@/lib/errors';

const stationId = 'station-1';
const formatId = 'format-1';
const userId = 'user-1';
const entryId = 'entry-1';

describe('queue-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('joinQueue', () => {
    it('throws NotFoundError when format not found', async () => {
      mockFindFormatByIdAndStation.mockResolvedValue(undefined);
      await expect(joinQueue(userId, stationId, formatId)).rejects.toThrow(NotFoundError);
      expect(mockCreateQueueEntry).not.toHaveBeenCalled();
    });

    it('throws ConflictError when format is inactive', async () => {
      mockFindFormatByIdAndStation.mockResolvedValue({ id: formatId, price: '10', is_active: false });
      await expect(joinQueue(userId, stationId, formatId)).rejects.toThrow(ConflictError);
      expect(mockCreateQueueEntry).not.toHaveBeenCalled();
    });

    it('creates queue entry when payment succeeds', async () => {
      mockFindFormatByIdAndStation.mockResolvedValue({ id: formatId, price: '15', is_active: true });
      mockProcessPayment.mockResolvedValue({ success: true, stripePaymentId: 'pi_1' });
      const created = { id: entryId, entry_type: 'queue', queue_position: 1 };
      mockCreateQueueEntry.mockResolvedValue(created);
      const result = await joinQueue(userId, stationId, formatId);
      expect(result).toEqual(created);
      expect(mockNotifyEntry).toHaveBeenCalledWith(
        expect.objectContaining({ entryId, type: 'queue_joined' })
      );
    });
  });

  describe('listQueue', () => {
    it('returns list from repository', async () => {
      const entries = [{ id: entryId, entry_type: 'queue', queue_position: 1 }];
      mockListQueueByStation.mockResolvedValue(entries);
      const result = await listQueue(stationId);
      expect(result).toEqual(entries);
      expect(mockListQueueByStation).toHaveBeenCalledWith(stationId);
    });
  });

  describe('moveReservationToQueue', () => {
    it('throws NotFoundError when entry not found', async () => {
      mockFindEntryById.mockResolvedValue(undefined);
      await expect(moveReservationToQueue(entryId)).rejects.toThrow(NotFoundError);
      expect(mockUpdateEntry).not.toHaveBeenCalled();
    });

    it('throws ConflictError when entry is not a reservation', async () => {
      mockFindEntryById.mockResolvedValue({
        id: entryId,
        entry_type: 'queue',
        time_slot_id: null,
        station_id: stationId,
      });
      await expect(moveReservationToQueue(entryId)).rejects.toThrow(ConflictError);
      expect(mockUpdateEntry).not.toHaveBeenCalled();
    });

    it('updates entry to queue and decrements slot', async () => {
      const slotId = 'slot-1';
      const entry = {
        id: entryId,
        user_id: userId,
        entry_type: 'reservation' as const,
        time_slot_id: slotId,
        station_id: stationId,
      };
      mockFindEntryById
        .mockResolvedValueOnce(entry)
        .mockResolvedValueOnce({ ...entry, entry_type: 'queue', queue_position: 1, status: 'late' });
      mockCountQueueByStation.mockResolvedValue(0);
      mockUpdateEntry.mockResolvedValue({});
      await moveReservationToQueue(entryId);
      expect(mockShiftQueuePositions).toHaveBeenCalledWith(stationId, 1, 1, expect.anything());
      expect(mockUpdateEntry).toHaveBeenCalledWith(
        entryId,
        expect.objectContaining({
          entry_type: 'queue',
          time_slot_id: null,
          queue_position: 1,
          status: 'late',
        }),
        expect.anything()
      );
      expect(mockDecrementSlotBookedCount).toHaveBeenCalledWith(slotId, expect.anything());
      expect(mockNotifyEntry).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'moved_to_queue' })
      );
    });
  });
});
