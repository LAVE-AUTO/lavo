/**
 * Unit tests for queue-service: joinQueue, listQueue, moveReservationToQueue, callNextInQueue (mocked deps).
 * @jest-environment node
 */
const mockFindServiceByIdAndStation = jest.fn();
const mockFindServiceVehicleEntryForBooking = jest.fn();
const mockNotifyEntry = jest.fn();
const mockCreateQueueEntry = jest.fn();
const mockListQueueByStation = jest.fn();
const mockFindEntryById = jest.fn();
const mockCountQueueByStation = jest.fn();
const mockUpdateEntry = jest.fn();
const mockShiftQueuePositions = jest.fn();
const mockDecrementSlotBookedCount = jest.fn();
const mockFindFirstActiveQueueEntry = jest.fn();
const mockCreatePaymentIntent = jest.fn();
const mockCancelPaymentIntent = jest.fn();
const mockUpdatePaymentIntentMetadata = jest.fn();
const mockComputeReservationSplit = jest.fn();
const mockFindPendingPaymentQueueEntryAtStation = jest.fn();
const mockHasActiveQueueEntryAtStation = jest.fn();

jest.mock('@/server/station/service-repository', () => ({
  findServiceByIdAndStation: (...args: unknown[]) => mockFindServiceByIdAndStation(...args),
  findServiceVehicleEntryForBooking: (...args: unknown[]) => mockFindServiceVehicleEntryForBooking(...args),
}));
jest.mock('@/server/station/slot-repository', () => ({
  decrementSlotBookedCount: (...args: unknown[]) => mockDecrementSlotBookedCount(...args),
}));
jest.mock('@/server/payments/payment-service', () => ({
  createPaymentIntent: (...args: unknown[]) => mockCreatePaymentIntent(...args),
  cancelPaymentIntent: (...args: unknown[]) => mockCancelPaymentIntent(...args),
  updatePaymentIntentMetadata: (...args: unknown[]) => mockUpdatePaymentIntentMetadata(...args),
}));
jest.mock('@/server/notifications/notification-service', () => ({
  notifyEntry: (...args: unknown[]) => mockNotifyEntry(...args),
}));
jest.mock('@/server/notifications/client-feed-notifications', () => ({
  notifyClientFeed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/server/notifications/station-feed-notifications', () => ({
  notifyStationFeed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/server/auth/user-repository', () => ({
  findById: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/server/reservations/entry-repository', () => ({
  createQueueEntry: (...args: unknown[]) => mockCreateQueueEntry(...args),
  listQueueByStation: (...args: unknown[]) => mockListQueueByStation(...args),
  findEntryById: (...args: unknown[]) => mockFindEntryById(...args),
  countQueueByStation: (...args: unknown[]) => mockCountQueueByStation(...args),
  updateEntry: (...args: unknown[]) => mockUpdateEntry(...args),
  shiftQueuePositions: (...args: unknown[]) => mockShiftQueuePositions(...args),
  findFirstActiveQueueEntry: (...args: unknown[]) => mockFindFirstActiveQueueEntry(...args),
  getNextQueuePosition: jest.fn().mockResolvedValue(1),
  hasActiveQueueEntryAtStation: (...args: unknown[]) => mockHasActiveQueueEntryAtStation(...args),
  findPendingPaymentQueueEntryAtStation: (...args: unknown[]) => mockFindPendingPaymentQueueEntryAtStation(...args),
}));
jest.mock('@/server/reservations/compute-reservation-split', () => ({
  computeReservationSplit: (...args: unknown[]) => mockComputeReservationSplit(...args),
}));
jest.mock('@/server/reservations/queue-position-helper', () => ({
  getQueuePositionWhenMovingFromReservation: jest.fn().mockReturnValue(1),
}));

jest.mock('@/lib/db', () => ({
  db: {
    transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({})),
  },
}));

import { joinQueue, listQueue, moveReservationToQueue, callNextInQueue } from '@/server/reservations/queue-service';
import { NotFoundError, ConflictError } from '@/lib/errors';

const stationId = 'station-1';
const serviceId = 'service-1';
const userId = 'user-1';
const entryId = 'entry-1';
const stationStripeAccountId = 'acct_test_station';

describe('queue-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindPendingPaymentQueueEntryAtStation.mockResolvedValue(null);
    mockHasActiveQueueEntryAtStation.mockResolvedValue(false);
  });

  describe('joinQueue', () => {
    it('throws NotFoundError when service not found', async () => {
      mockFindServiceByIdAndStation.mockResolvedValue(undefined);
      await expect(joinQueue(userId, stationId, serviceId, null, stationStripeAccountId)).rejects.toThrow(NotFoundError);
      expect(mockCreateQueueEntry).not.toHaveBeenCalled();
    });

    it('throws ConflictError when vehicle entry is inactive', async () => {
      mockFindServiceByIdAndStation.mockResolvedValue({ id: serviceId });
      mockFindServiceVehicleEntryForBooking.mockResolvedValue({ price: '10', is_active: false });
      await expect(joinQueue(userId, stationId, serviceId, null, stationStripeAccountId)).rejects.toThrow(ConflictError);
      expect(mockCreateQueueEntry).not.toHaveBeenCalled();
    });

    it('creates queue entry when payment succeeds', async () => {
      mockFindServiceByIdAndStation.mockResolvedValue({ id: serviceId });
      mockFindServiceVehicleEntryForBooking.mockResolvedValue({ price: '15', is_active: true });
      mockComputeReservationSplit.mockResolvedValue({
        commissionRate: '0.10',
        commissionAmount: 1.5,
        stationPayout: 15.53,
        station_service_total: 15,
        platform_service_fee: 1.5,
        taxable_subtotal: 16.5,
        tps_amount: 0.83,
        tvq_amount: 1.65,
        client_total: 18.98,
        platform_subtotal: 3,
        platform_tax_amount: 0.45,
        platform_total_retained: 3.45,
        station_subtotal: 13.5,
        station_tax_amount: 2.03,
        station_total_transferred: 15.53,
      });
      mockCreatePaymentIntent.mockResolvedValue({ paymentIntentId: 'pi_1', clientSecret: 'secret_1' });
      mockUpdatePaymentIntentMetadata.mockResolvedValue(undefined);
      const created = { id: entryId, entry_type: 'queue', queue_position: 1 };
      mockCreateQueueEntry.mockResolvedValue(created);
      const result = await joinQueue(userId, stationId, serviceId, null, stationStripeAccountId);
      expect(result.entry).toEqual(created);
      expect(result.clientSecret).toBe('secret_1');
      expect(mockCreateQueueEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          amount_paid: '18.98',
          station_service_total: '15.00',
          platform_service_fee: '1.50',
          client_total: '18.98',
          station_total_transferred: '15.53',
        }),
        expect.anything(),
      );
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

  describe('callNextInQueue', () => {
    it('throws NotFoundError when no active entries in queue', async () => {
      mockFindFirstActiveQueueEntry.mockResolvedValue(undefined);
      await expect(callNextInQueue(stationId)).rejects.toThrow(NotFoundError);
    });

    it('calls pickQueueEntry on the first active entry', async () => {
      const nextEntry = {
        id: entryId,
        user_id: userId,
        station_id: stationId,
        entry_type: 'queue' as const,
        status: 'pending',
        queue_position: 1,
      };
      mockFindFirstActiveQueueEntry.mockResolvedValue(nextEntry);
      mockFindEntryById.mockResolvedValue(nextEntry);
      mockUpdateEntry.mockResolvedValue({ ...nextEntry, status: 'in_progress', queue_position: null });
      mockShiftQueuePositions.mockResolvedValue(undefined);
      mockNotifyEntry.mockResolvedValue(undefined);

      const result = await callNextInQueue(stationId);
      expect(result).toBeDefined();
      expect(mockNotifyEntry).toHaveBeenCalledWith(
        expect.objectContaining({ entryId, type: 'queue_pick' })
      );
    });
  });
});
