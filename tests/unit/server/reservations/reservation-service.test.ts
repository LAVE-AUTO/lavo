/**
 * Unit tests for reservation-service: createReservation, cancelEntry, listMyEntries (mocked deps).
 */
const mockGetConfigByStationId = jest.fn();
const mockFindFormatByIdAndStation = jest.fn();
const mockLockSlotForUpdate = jest.fn();
const mockCountReservationsBySlotId = jest.fn();
const mockIncrementSlotBookedCount = jest.fn();
const mockCreatePaymentIntent = jest.fn();
const mockCancelPaymentIntent = jest.fn();
const mockCapturePaymentIntent = jest.fn();
const mockNotifyEntry = jest.fn();
const mockFindEntryByIdAndStation = jest.fn();
const mockSetStripePaymentSucceededNotifiedAtIfMissing = jest.fn();
const mockClearStripePaymentSucceededNotifiedAt = jest.fn();
const mockSendEscrowReleasedNotificationsForEntry = jest.fn();
const mockCreateReservationEntry = jest.fn();
const mockFindEntryByIdAndUser = jest.fn();
const mockListEntriesByUserPaginated = jest.fn();
const mockHasActiveEntryAtStation = jest.fn();
const mockUpdateEntry = jest.fn();
const mockDecrementSlotBookedCount = jest.fn();

jest.mock('@/server/admin/platform-settings-service', () => ({
  getActiveCommissionRate: jest.fn().mockResolvedValue('0.10'),
  getPlatformSetting: jest.fn().mockResolvedValue(null),
  getPlatformSettingWithFallback: jest.fn().mockResolvedValue('7'),
  isAdminEscrowPushEnabled: jest.fn().mockResolvedValue(false),
}));

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
  cancelPaymentIntent: (...args: unknown[]) => mockCancelPaymentIntent(...args),
  capturePaymentIntent: (...args: unknown[]) => mockCapturePaymentIntent(...args),
}));
jest.mock('@/server/notifications/escrow-released-notifications', () => ({
  sendEscrowReleasedNotificationsForEntry: (...args: unknown[]) =>
    mockSendEscrowReleasedNotificationsForEntry(...args),
}));
jest.mock('@/server/notifications/notification-service', () => ({
  notifyEntry: (...args: unknown[]) => mockNotifyEntry(...args),
}));
jest.mock('@/server/reservations/entry-repository', () => ({
  createReservationEntry: (...args: unknown[]) => mockCreateReservationEntry(...args),
  findEntryByIdAndUser: (...args: unknown[]) => mockFindEntryByIdAndUser(...args),
  findEntryByIdAndStation: (...args: unknown[]) => mockFindEntryByIdAndStation(...args),
  hasActiveEntryAtStation: (...args: unknown[]) => mockHasActiveEntryAtStation(...args),
  listEntriesByUserPaginated: (...args: unknown[]) => mockListEntriesByUserPaginated(...args),
  listEntriesByStationPaginated: jest.fn(),
  updateEntry: (...args: unknown[]) => mockUpdateEntry(...args),
  shiftQueuePositions: jest.fn(),
  setStripePaymentSucceededNotifiedAtIfMissing: (...args: unknown[]) =>
    mockSetStripePaymentSucceededNotifiedAtIfMissing(...args),
  clearStripePaymentSucceededNotifiedAt: (...args: unknown[]) =>
    mockClearStripePaymentSucceededNotifiedAt(...args),
}));
jest.mock('@/lib/db', () => ({
  db: {
    transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({})),
  },
}));

import {
  createReservation,
  cancelEntry,
  listMyEntries,
  setEntryStatusByStation,
} from '@/server/reservations/reservation-service';
import {
  NotFoundError,
  ConflictError,
  ActiveReservationExistsError,
  SlotFullError,
  ValidationError,
} from '@/lib/errors';
import { generateQrToken } from '@/server/qr/qr-token-service';

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
    process.env.QR_TOKEN_SECRET = 'unit-test-qr-secret-0123456789abcdef';
  });

  describe('createReservation', () => {
    it('throws NotFoundError when format not found', async () => {
      mockFindFormatByIdAndStation.mockResolvedValue(undefined);
      await expect(
        createReservation(userId, stationId, stripeAccountId, slotId, formatId)
      ).rejects.toThrow(NotFoundError);
      expect(mockCreateReservationEntry).not.toHaveBeenCalled();
    });

    it('throws ActiveReservationExistsError when user has active entry at station', async () => {
      mockFindFormatByIdAndStation.mockResolvedValue({ id: formatId, price: '10', is_active: true });
      mockGetConfigByStationId.mockResolvedValue({ reservation_surcharge: '2' });
      mockHasActiveEntryAtStation.mockResolvedValue(true);
      await expect(
        createReservation(userId, stationId, stripeAccountId, slotId, formatId)
      ).rejects.toThrow(ActiveReservationExistsError);
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

    it('throws SlotFullError when slot is full', async () => {
      mockFindFormatByIdAndStation.mockResolvedValue({ id: formatId, price: '10', is_active: true });
      mockGetConfigByStationId.mockResolvedValue({ reservation_surcharge: '2' });
      mockLockSlotForUpdate.mockResolvedValue({
        id: slotId,
        capacity: 1,
        start_time: new Date(),
      });
      mockCountReservationsBySlotId.mockResolvedValue(1);
      await expect(
        createReservation(userId, stationId, stripeAccountId, slotId, formatId)
      ).rejects.toThrow(SlotFullError);
      expect(mockCreateReservationEntry).not.toHaveBeenCalled();
    });

    it('creates entry with pending_payment status and returns client_secret', async () => {
      mockFindFormatByIdAndStation.mockResolvedValue({ id: formatId, price: '10', is_active: true });
      mockGetConfigByStationId.mockResolvedValue({ reservation_surcharge: '2' });
      mockLockSlotForUpdate.mockResolvedValue({
        id: slotId,
        capacity: 2,
        start_time: new Date(),
      });
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
        expect.objectContaining({ status: 'pending_payment', booking_source: 'standard' }),
        expect.anything()
      );
      expect(mockNotifyEntry).toHaveBeenCalledWith(
        expect.objectContaining({ entryId, type: 'reservation_created' })
      );
    });

    it('rolls back entry and decrements slot when Stripe fails', async () => {
      mockFindFormatByIdAndStation.mockResolvedValue({ id: formatId, price: '10', is_active: true });
      mockGetConfigByStationId.mockResolvedValue({ reservation_surcharge: '2' });
      mockLockSlotForUpdate.mockResolvedValue({
        id: slotId,
        capacity: 2,
        start_time: new Date(),
      });
      mockCountReservationsBySlotId.mockResolvedValue(0);
      const created = { id: entryId, entry_type: 'reservation', time_slot_id: slotId, stripe_payment_id: null };
      mockCreateReservationEntry.mockResolvedValue(created);
      mockCreatePaymentIntent.mockRejectedValue(new Error('Stripe unavailable'));
      mockUpdateEntry.mockResolvedValue({ ...created, status: 'cancelled' });

      await expect(
        createReservation(userId, stationId, stripeAccountId, slotId, formatId)
      ).rejects.toThrow('Stripe unavailable');
      expect(mockUpdateEntry).toHaveBeenCalledWith(entryId, expect.objectContaining({ status: 'cancelled' }), expect.anything());
      expect(mockDecrementSlotBookedCount).toHaveBeenCalledWith(slotId, expect.anything());
    });

    it('applies 0% commission and booking_source=qr for valid qr_token + v=1', async () => {
      mockFindFormatByIdAndStation.mockResolvedValue({ id: formatId, price: '10', is_active: true });
      mockGetConfigByStationId.mockResolvedValue({ reservation_surcharge: '2' });
      mockLockSlotForUpdate.mockResolvedValue({
        id: slotId,
        capacity: 2,
        start_time: new Date(),
      });
      mockCountReservationsBySlotId.mockResolvedValue(0);
      const created = { id: entryId, entry_type: 'reservation', time_slot_id: slotId, stripe_payment_id: null };
      mockCreateReservationEntry.mockResolvedValue(created);
      mockCreatePaymentIntent.mockResolvedValue({
        paymentIntentId: 'pi_123',
        clientSecret: 'pi_123_secret_abc',
      });
      mockUpdateEntry.mockResolvedValue({ ...created, stripe_payment_id: 'pi_123' });

      const qrToken = generateQrToken(stationId);
      await createReservation(userId, stationId, stripeAccountId, slotId, formatId, {
        qrToken,
        qrVersion: '1',
      });

      expect(mockCreateReservationEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          booking_source: 'qr',
          commission_rate: '0.0000',
          commission_amount: '0.00',
          station_payout: '12.00',
        }),
        expect.anything()
      );
      expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ commissionCents: 0 })
      );
    });

    it('rejects invalid QR token context instead of silently falling back', async () => {
      mockFindFormatByIdAndStation.mockResolvedValue({ id: formatId, price: '10', is_active: true });
      mockGetConfigByStationId.mockResolvedValue({ reservation_surcharge: '2' });
      mockLockSlotForUpdate.mockResolvedValue({
        id: slotId,
        capacity: 2,
        start_time: new Date(),
      });
      mockCountReservationsBySlotId.mockResolvedValue(0);
      const created = { id: entryId, entry_type: 'reservation', time_slot_id: slotId, stripe_payment_id: null };
      mockCreateReservationEntry.mockResolvedValue(created);
      mockCreatePaymentIntent.mockResolvedValue({
        paymentIntentId: 'pi_123',
        clientSecret: 'pi_123_secret_abc',
      });
      mockUpdateEntry.mockResolvedValue({ ...created, stripe_payment_id: 'pi_123' });

      await expect(
        createReservation(userId, stationId, stripeAccountId, slotId, formatId, {
          qrToken: 'invalid-token',
          qrVersion: '2',
        })
      ).rejects.toThrow(ValidationError);
      expect(mockCreateReservationEntry).not.toHaveBeenCalled();
    });

    it('rejects partial QR payload when version is missing', async () => {
      mockFindFormatByIdAndStation.mockResolvedValue({ id: formatId, price: '10', is_active: true });
      mockGetConfigByStationId.mockResolvedValue({ reservation_surcharge: '2' });
      mockLockSlotForUpdate.mockResolvedValue({
        id: slotId,
        capacity: 2,
        start_time: new Date(),
      });
      mockCountReservationsBySlotId.mockResolvedValue(0);
      const created = { id: entryId, entry_type: 'reservation', time_slot_id: slotId, stripe_payment_id: null };
      mockCreateReservationEntry.mockResolvedValue(created);
      mockCreatePaymentIntent.mockResolvedValue({
        paymentIntentId: 'pi_123',
        clientSecret: 'pi_123_secret_abc',
      });
      mockUpdateEntry.mockResolvedValue({ ...created, stripe_payment_id: 'pi_123' });

      const qrToken = generateQrToken(stationId);
      await expect(
        createReservation(userId, stationId, stripeAccountId, slotId, formatId, {
          qrToken,
        })
      ).rejects.toThrow(ValidationError);
      expect(mockCreateReservationEntry).not.toHaveBeenCalled();
    });

    it('rejects partial QR payload when only version is provided', async () => {
      mockFindFormatByIdAndStation.mockResolvedValue({ id: formatId, price: '10', is_active: true });
      mockGetConfigByStationId.mockResolvedValue({ reservation_surcharge: '2' });
      mockLockSlotForUpdate.mockResolvedValue({
        id: slotId,
        capacity: 2,
        start_time: new Date(),
      });
      mockCountReservationsBySlotId.mockResolvedValue(0);
      const created = { id: entryId, entry_type: 'reservation', time_slot_id: slotId, stripe_payment_id: null };
      mockCreateReservationEntry.mockResolvedValue(created);
      mockCreatePaymentIntent.mockResolvedValue({
        paymentIntentId: 'pi_123',
        clientSecret: 'pi_123_secret_abc',
      });
      mockUpdateEntry.mockResolvedValue({ ...created, stripe_payment_id: 'pi_123' });

      await expect(
        createReservation(userId, stationId, stripeAccountId, slotId, formatId, {
          qrVersion: '1',
        })
      ).rejects.toThrow(ValidationError);
      expect(mockCreateReservationEntry).not.toHaveBeenCalled();
    });

    it('rejects QR token signed for another station (bypass attempt)', async () => {
      mockFindFormatByIdAndStation.mockResolvedValue({ id: formatId, price: '10', is_active: true });
      mockGetConfigByStationId.mockResolvedValue({ reservation_surcharge: '2' });
      mockLockSlotForUpdate.mockResolvedValue({
        id: slotId,
        capacity: 2,
        start_time: new Date(),
      });
      mockCountReservationsBySlotId.mockResolvedValue(0);
      const created = { id: entryId, entry_type: 'reservation', time_slot_id: slotId, stripe_payment_id: null };
      mockCreateReservationEntry.mockResolvedValue(created);
      mockCreatePaymentIntent.mockResolvedValue({
        paymentIntentId: 'pi_123',
        clientSecret: 'pi_123_secret_abc',
      });
      mockUpdateEntry.mockResolvedValue({ ...created, stripe_payment_id: 'pi_123' });

      const qrTokenForOtherStation = generateQrToken('station-2');
      await expect(
        createReservation(userId, stationId, stripeAccountId, slotId, formatId, {
          qrToken: qrTokenForOtherStation,
          qrVersion: '1',
        })
      ).rejects.toThrow(ValidationError);
      expect(mockCreateReservationEntry).not.toHaveBeenCalled();
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

  describe('setEntryStatusByStation (escrow fallback)', () => {
    const succeededAt = new Date('2024-06-01T12:00:00.000Z');

    beforeEach(() => {
      mockCapturePaymentIntent.mockResolvedValue({ chargeId: null, transferId: null });
      mockSetStripePaymentSucceededNotifiedAtIfMissing.mockReset();
      mockClearStripePaymentSucceededNotifiedAt.mockReset().mockResolvedValue(undefined);
      mockSendEscrowReleasedNotificationsForEntry.mockReset().mockResolvedValue(undefined);
    });

    it('calls escrow notifications when completed, reservation had webhook succeeded_at first, and notify slot is claimed', async () => {
      mockFindEntryByIdAndStation.mockResolvedValue({
        id: entryId,
        user_id: userId,
        station_id: stationId,
        entry_type: 'reservation',
        status: 'in_progress',
        stripe_payment_id: 'pi_123',
        stripe_payment_succeeded_at: null,
      });
      const updated = {
        id: entryId,
        user_id: userId,
        station_id: stationId,
        entry_type: 'reservation' as const,
        status: 'completed' as const,
        stripe_payment_id: 'pi_123',
        stripe_payment_succeeded_at: succeededAt,
      };
      mockUpdateEntry.mockResolvedValue(updated);
      mockSetStripePaymentSucceededNotifiedAtIfMissing.mockResolvedValue(true);

      await setEntryStatusByStation(entryId, stationId, 'completed');

      expect(mockCapturePaymentIntent).toHaveBeenCalledWith('pi_123');
      expect(mockSetStripePaymentSucceededNotifiedAtIfMissing).toHaveBeenCalledWith(
        entryId,
        succeededAt
      );
      expect(mockSendEscrowReleasedNotificationsForEntry).toHaveBeenCalledTimes(1);
      expect(mockSendEscrowReleasedNotificationsForEntry).toHaveBeenCalledWith(updated, succeededAt);
    });

    it('does not send escrow notifications when notify flag was already set (idempotent)', async () => {
      mockFindEntryByIdAndStation.mockResolvedValue({
        id: entryId,
        user_id: userId,
        station_id: stationId,
        entry_type: 'reservation',
        status: 'in_progress',
        stripe_payment_id: 'pi_123',
      });
      mockUpdateEntry.mockResolvedValue({
        id: entryId,
        user_id: userId,
        station_id: stationId,
        entry_type: 'reservation' as const,
        status: 'completed' as const,
        stripe_payment_id: 'pi_123',
        stripe_payment_succeeded_at: succeededAt,
      });
      mockSetStripePaymentSucceededNotifiedAtIfMissing.mockResolvedValue(false);

      await setEntryStatusByStation(entryId, stationId, 'completed');

      expect(mockSendEscrowReleasedNotificationsForEntry).not.toHaveBeenCalled();
    });

    it('efface notified_at si sendEscrowReleased échoue après claim (pas de retry Stripe côté station)', async () => {
      mockFindEntryByIdAndStation.mockResolvedValue({
        id: entryId,
        user_id: userId,
        station_id: stationId,
        entry_type: 'reservation',
        status: 'in_progress',
        stripe_payment_id: 'pi_123',
      });
      mockUpdateEntry.mockResolvedValue({
        id: entryId,
        user_id: userId,
        station_id: stationId,
        entry_type: 'reservation' as const,
        status: 'completed' as const,
        stripe_payment_id: 'pi_123',
        stripe_payment_succeeded_at: succeededAt,
      });
      mockSetStripePaymentSucceededNotifiedAtIfMissing.mockResolvedValue(true);
      mockSendEscrowReleasedNotificationsForEntry.mockRejectedValue(new Error('notify failed'));

      await setEntryStatusByStation(entryId, stationId, 'completed');

      expect(mockClearStripePaymentSucceededNotifiedAt).toHaveBeenCalledWith(entryId);
    });

    it('skips escrow fallback when stripe_payment_succeeded_at is still null on completed row', async () => {
      mockFindEntryByIdAndStation.mockResolvedValue({
        id: entryId,
        user_id: userId,
        station_id: stationId,
        entry_type: 'reservation',
        status: 'in_progress',
        stripe_payment_id: 'pi_123',
      });
      mockUpdateEntry.mockResolvedValue({
        id: entryId,
        user_id: userId,
        station_id: stationId,
        entry_type: 'reservation' as const,
        status: 'completed' as const,
        stripe_payment_id: 'pi_123',
        stripe_payment_succeeded_at: null,
      });

      await setEntryStatusByStation(entryId, stationId, 'completed');

      expect(mockSetStripePaymentSucceededNotifiedAtIfMissing).not.toHaveBeenCalled();
      expect(mockSendEscrowReleasedNotificationsForEntry).not.toHaveBeenCalled();
    });
  });
});
