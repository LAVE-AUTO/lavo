/**
 * Unit tests for reservation-service: createReservation, cancelEntry, listMyEntries (mocked deps).
 */
const mockGetConfigByStationId = jest.fn();
const mockFindFormatByIdAndStation = jest.fn();
const mockLockSlotForUpdate = jest.fn();
const mockCountReservationsBySlotId = jest.fn();
const mockIncrementSlotBookedCount = jest.fn();
const mockCreatePaymentIntent = jest.fn();
const mockNotifyEntry = jest.fn();
const mockCreateReservationEntry = jest.fn();
const mockFindEntryByIdAndUser = jest.fn();
const mockListEntriesByUserPaginated = jest.fn();
const mockHasActiveEntryAtStation = jest.fn();
const mockUpdateEntry = jest.fn();
const mockDecrementSlotBookedCount = jest.fn();

jest.mock('@/server/station/config-repository', () => ({
  getConfigByStationId: (...args: unknown[]) => mockGetConfigByStationId(...args),
}));
jest.mock('@/server/station/format-repository', () => ({
  findFormatByIdAndStation: (...args: unknown[]) => mockFindFormatByIdAndStation(...args),
}));
jest.mock('@/server/station/slot-repository', () => ({
  lockSlotForUpdate: (...args: unknown[]) => mockLockSlotForUpdate(...args),
  countReservationsBySlotId: (...args: unknown[]) => mockCountReservationsBySlotId(...args),
  incrementSlotBookedCount: (...args: unknown[]) => mockIncrementSlotBookedCount(...args),
  decrementSlotBookedCount: (...args: unknown[]) => mockDecrementSlotBookedCount(...args),
}));
jest.mock('@/server/payments/payment-service', () => ({
  createPaymentIntent: (...args: unknown[]) => mockCreatePaymentIntent(...args),
}));
jest.mock('@/server/notifications/notification-service', () => ({
  notifyEntry: (...args: unknown[]) => mockNotifyEntry(...args),
}));
jest.mock('@/server/reservations/entry-repository', () => ({
  createReservationEntry: (...args: unknown[]) => mockCreateReservationEntry(...args),
  findEntryByIdAndUser: (...args: unknown[]) => mockFindEntryByIdAndUser(...args),
  findEntryByIdAndStation: jest.fn(),
  hasActiveEntryAtStation: (...args: unknown[]) => mockHasActiveEntryAtStation(...args),
  listEntriesByUserPaginated: (...args: unknown[]) => mockListEntriesByUserPaginated(...args),
  listEntriesByStationPaginated: jest.fn(),
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
const stripeAccountId = 'acct_station1';
const slotId = 'slot-1';
const formatId = 'format-1';
const entryId = 'entry-1';

describe('reservation-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasActiveEntryAtStation.mockResolvedValue(false);
  });

  describe('createReservation', () => {
    it('throws NotFoundError when format not found', async () => {
      mockFindFormatByIdAndStation.mockResolvedValue(undefined);
      await expect(
        createReservation(userId, stationId, stripeAccountId, slotId, formatId)
      ).rejects.toThrow(NotFoundError);
      expect(mockCreateReservationEntry).not.toHaveBeenCalled();
    });

    it('throws ConflictError when user has active entry at station', async () => {
      mockFindFormatByIdAndStation.mockResolvedValue({ id: formatId, price: '10', is_active: true });
      mockGetConfigByStationId.mockResolvedValue({ reservation_surcharge: '2' });
      mockHasActiveEntryAtStation.mockResolvedValue(true);
      await expect(
        createReservation(userId, stationId, stripeAccountId, slotId, formatId)
      ).rejects.toThrow(ConflictError);
      expect(mockCreateReservationEntry).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when slot not found (inside transaction)', async () => {
      mockFindFormatByIdAndStation.mockResolvedValue({ id: formatId, price: '10', is_active: true });
      mockGetConfigByStationId.mockResolvedValue({ reservation_surcharge: '2' });
      mockLockSlotForUpdate.mockResolvedValue(undefined);
      await expect(
        createReservation(userId, stationId, stripeAccountId, slotId, formatId)
      ).rejects.toThrow(NotFoundError);
      expect(mockCreateReservationEntry).not.toHaveBeenCalled();
    });

    it('throws ConflictError when slot is full', async () => {
      mockFindFormatByIdAndStation.mockResolvedValue({ id: formatId, price: '10', is_active: true });
      mockGetConfigByStationId.mockResolvedValue({ reservation_surcharge: '2' });
      mockLockSlotForUpdate.mockResolvedValue({ id: slotId, capacity: 1 });
      mockCountReservationsBySlotId.mockResolvedValue(1);
      await expect(
        createReservation(userId, stationId, stripeAccountId, slotId, formatId)
      ).rejects.toThrow(ConflictError);
      expect(mockCreateReservationEntry).not.toHaveBeenCalled();
    });

    it('creates entry with pending_payment status and returns client_secret', async () => {
      mockFindFormatByIdAndStation.mockResolvedValue({ id: formatId, price: '10', is_active: true });
      mockGetConfigByStationId.mockResolvedValue({ reservation_surcharge: '2' });
      mockLockSlotForUpdate.mockResolvedValue({ id: slotId, capacity: 2 });
      mockCountReservationsBySlotId.mockResolvedValue(0);
      const created = { id: entryId, entry_type: 'reservation', time_slot_id: slotId, stripe_payment_id: null };
      mockCreateReservationEntry.mockResolvedValue(created);
      mockCreatePaymentIntent.mockResolvedValue({
        paymentIntentId: 'pi_123',
        clientSecret: 'pi_123_secret_abc',
      });
      mockUpdateEntry.mockResolvedValue({ ...created, stripe_payment_id: 'pi_123' });

      const result = await createReservation(userId, stationId, stripeAccountId, slotId, formatId);
      expect(result.clientSecret).toBe('pi_123_secret_abc');
      expect(result.entry.stripe_payment_id).toBe('pi_123');
      expect(mockIncrementSlotBookedCount).toHaveBeenCalledWith(slotId, expect.anything());
      expect(mockCreateReservationEntry).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending_payment' }),
        expect.anything()
      );
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
    it('returns paginated list from repository', async () => {
      const paginated = { rows: [{ id: entryId }], total: 1, page: 1, per_page: 20 };
      mockListEntriesByUserPaginated.mockResolvedValue(paginated);
      const result = await listMyEntries(userId);
      expect(result).toEqual(paginated);
      expect(mockListEntriesByUserPaginated).toHaveBeenCalledWith(userId, undefined);
    });
  });
});
