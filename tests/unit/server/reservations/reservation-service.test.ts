/**
 * Unit tests for reservation-service: createReservation, cancelEntry, listMyEntries (mocked deps).
 */
const mockGetConfigByStationId = jest.fn();
const mockFindFormatByIdAndStation = jest.fn();
const mockFindSlotByIdAndStation = jest.fn();
const mockCountReservationsBySlotId = jest.fn();
const mockIncrementSlotBookedCount = jest.fn();
const mockProcessPayment = jest.fn();
const mockNotifyEntry = jest.fn();
const mockCreateReservationEntry = jest.fn();
const mockFindEntryByIdAndUser = jest.fn();
const mockListEntriesByUser = jest.fn();
const mockUpdateEntry = jest.fn();
const mockDecrementSlotBookedCount = jest.fn();

jest.mock('@/server/station/config-repository', () => ({
  getConfigByStationId: (...args: unknown[]) => mockGetConfigByStationId(...args),
}));
jest.mock('@/server/station/format-repository', () => ({
  findFormatByIdAndStation: (...args: unknown[]) => mockFindFormatByIdAndStation(...args),
}));
jest.mock('@/server/station/slot-repository', () => ({
  findSlotByIdAndStation: (...args: unknown[]) => mockFindSlotByIdAndStation(...args),
  countReservationsBySlotId: (...args: unknown[]) => mockCountReservationsBySlotId(...args),
  incrementSlotBookedCount: (...args: unknown[]) => mockIncrementSlotBookedCount(...args),
  decrementSlotBookedCount: (...args: unknown[]) => mockDecrementSlotBookedCount(...args),
}));
jest.mock('@/server/payments/payment-service', () => ({
  processPayment: (...args: unknown[]) => mockProcessPayment(...args),
}));
jest.mock('@/server/notifications/notification-service', () => ({
  notifyEntry: (...args: unknown[]) => mockNotifyEntry(...args),
}));
jest.mock('@/server/reservations/entry-repository', () => ({
  createReservationEntry: (...args: unknown[]) => mockCreateReservationEntry(...args),
  findEntryByIdAndUser: (...args: unknown[]) => mockFindEntryByIdAndUser(...args),
  listEntriesByUser: (...args: unknown[]) => mockListEntriesByUser(...args),
  updateEntry: (...args: unknown[]) => mockUpdateEntry(...args),
  shiftQueuePositions: jest.fn(),
}));
jest.mock('@/lib/db', () => ({
  db: {
    transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({})),
  },
}));

import { createReservation, cancelEntry, listMyEntries } from '@/server/reservations/reservation-service';
import { NotFoundError, ConflictError } from '@/lib/errors';

const userId = 'user-1';
const stationId = 'station-1';
const slotId = 'slot-1';
const formatId = 'format-1';
const entryId = 'entry-1';

describe('reservation-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createReservation', () => {
    it('throws NotFoundError when slot not found', async () => {
      mockFindSlotByIdAndStation.mockResolvedValue(undefined);
      await expect(
        createReservation(userId, stationId, slotId, formatId)
      ).rejects.toThrow(NotFoundError);
      expect(mockCreateReservationEntry).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when format not found', async () => {
      mockFindSlotByIdAndStation.mockResolvedValue({ id: slotId, capacity: 2 });
      mockFindFormatByIdAndStation.mockResolvedValue(undefined);
      await expect(
        createReservation(userId, stationId, slotId, formatId)
      ).rejects.toThrow(NotFoundError);
      expect(mockCreateReservationEntry).not.toHaveBeenCalled();
    });

    it('throws ConflictError when slot is full', async () => {
      mockFindSlotByIdAndStation.mockResolvedValue({ id: slotId, capacity: 1 });
      mockFindFormatByIdAndStation.mockResolvedValue({ id: formatId, price: '10', is_active: true });
      mockGetConfigByStationId.mockResolvedValue({ reservation_surcharge: '2' });
      mockCountReservationsBySlotId.mockResolvedValue(1);
      await expect(
        createReservation(userId, stationId, slotId, formatId)
      ).rejects.toThrow(ConflictError);
      expect(mockCreateReservationEntry).not.toHaveBeenCalled();
    });

    it('creates entry and increments slot when payment succeeds', async () => {
      mockFindSlotByIdAndStation.mockResolvedValue({ id: slotId, capacity: 2 });
      mockFindFormatByIdAndStation.mockResolvedValue({ id: formatId, price: '10', is_active: true });
      mockGetConfigByStationId.mockResolvedValue({ reservation_surcharge: '2' });
      mockCountReservationsBySlotId.mockResolvedValue(0);
      mockProcessPayment.mockResolvedValue({ success: true, stripePaymentId: 'pi_1' });
      const created = { id: entryId, entry_type: 'reservation', time_slot_id: slotId };
      mockCreateReservationEntry.mockResolvedValue(created);

      const result = await createReservation(userId, stationId, slotId, formatId);
      expect(result).toEqual(created);
      expect(mockIncrementSlotBookedCount).toHaveBeenCalledWith(slotId, expect.anything());
      expect(mockNotifyEntry).toHaveBeenCalledWith(
        expect.objectContaining({ entryId, type: 'reservation_created' })
      );
    });
  });

  describe('cancelEntry', () => {
    it('throws NotFoundError when entry not found', async () => {
      mockFindEntryByIdAndUser.mockResolvedValue(undefined);
      await expect(cancelEntry(entryId, userId)).rejects.toThrow(NotFoundError);
      expect(mockUpdateEntry).not.toHaveBeenCalled();
    });

    it('updates status to cancelled and decrements slot for reservation', async () => {
      const entry = {
        id: entryId,
        user_id: userId,
        station_id: stationId,
        entry_type: 'reservation' as const,
        time_slot_id: slotId,
        status: 'pending',
      };
      mockFindEntryByIdAndUser.mockResolvedValue(entry);
      mockUpdateEntry.mockResolvedValue({ ...entry, status: 'cancelled' });
      await cancelEntry(entryId, userId);
      expect(mockDecrementSlotBookedCount).toHaveBeenCalledWith(slotId, expect.anything());
      expect(mockUpdateEntry).toHaveBeenCalledWith(entryId, expect.objectContaining({ status: 'cancelled' }), expect.anything());
    });
  });

  describe('listMyEntries', () => {
    it('returns list from repository', async () => {
      const entries = [{ id: entryId, entry_type: 'reservation' }];
      mockListEntriesByUser.mockResolvedValue(entries);
      const result = await listMyEntries(userId);
      expect(result).toEqual(entries);
      expect(mockListEntriesByUser).toHaveBeenCalledWith(userId);
    });
  });
});
