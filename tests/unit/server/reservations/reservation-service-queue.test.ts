/**
 * Unit tests for reservation-service: cancelEntry — queue cancellation path (mocked deps).
 * Covers the queue cancellation branch added in refactor/gestion-retard.
 */
const mockFindEntryByIdAndUser = jest.fn();
const mockUpdateEntry = jest.fn();
const mockShiftQueuePositions = jest.fn();
const mockGetCancellationPolicy = jest.fn();
const mockCapturePaymentIntent = jest.fn();
const mockCancelPaymentIntent = jest.fn();
const mockRefundPaymentIntent = jest.fn();
const mockDistributePenalty = jest.fn();
const mockNotifyEntry = jest.fn();

jest.mock('@/server/reservations/entry-repository', () => ({
  findEntryByIdAndUser: (...args: unknown[]) => mockFindEntryByIdAndUser(...args),
  findEntryByIdAndStation: jest.fn(),
  updateEntry: (...args: unknown[]) => mockUpdateEntry(...args),
  shiftQueuePositions: (...args: unknown[]) => mockShiftQueuePositions(...args),
  decrementSlotBookedCount: jest.fn(),
  hasActiveEntryAtStation: jest.fn().mockResolvedValue(false),
  createReservationEntry: jest.fn(),
  listEntriesByUserPaginated: jest.fn(),
  listEntriesByStationPaginated: jest.fn(),
  setStripePaymentSucceededNotifiedAtIfMissing: jest.fn(),
  clearStripePaymentSucceededNotifiedAt: jest.fn(),
}));

jest.mock('@/server/admin/platform-settings-service', () => ({
  getPlatformSettingWithFallback: jest.fn().mockResolvedValue('7'),
  getCancellationPolicy: (...args: unknown[]) => mockGetCancellationPolicy(...args),
}));

jest.mock('@/server/payments/payment-service', () => ({
  createPaymentIntent: jest.fn(),
  cancelPaymentIntent: (...args: unknown[]) => mockCancelPaymentIntent(...args),
  capturePaymentIntent: (...args: unknown[]) => mockCapturePaymentIntent(...args),
  refundPaymentIntent: (...args: unknown[]) => mockRefundPaymentIntent(...args),
  distributePenalty: (...args: unknown[]) => mockDistributePenalty(...args),
  updatePaymentIntentMetadata: jest.fn(),
}));

jest.mock('@/server/reservations/cancellation-service', () => ({
  cancelReservation: jest.fn(),
}));

jest.mock('@/server/notifications/notification-service', () => ({
  notifyEntry: (...args: unknown[]) => mockNotifyEntry(...args),
}));

jest.mock('@/server/notifications/escrow-released-notifications', () => ({
  sendEscrowReleasedNotificationsForEntry: jest.fn(),
}));

jest.mock('@/server/station/config-repository', () => ({
  getConfigByStationId: jest.fn(),
}));

jest.mock('@/server/station/format-repository', () => ({
  findFormatByIdAndStation: jest.fn(),
}));

jest.mock('@/server/station/slot-repository', () => ({
  lockSlotForUpdate: jest.fn(),
  countReservationsBySlotId: jest.fn(),
  incrementSlotBookedCount: jest.fn(),
  decrementSlotBookedCount: jest.fn(),
}));

jest.mock('@/server/qr/qr-token-service', () => ({
  verifyQrToken: jest.fn(),
}));

jest.mock('@/server/reservations/compute-reservation-split', () => ({
  computeReservationSplit: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  db: {
    transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({})),
  },
}));

import { cancelEntry } from '@/server/reservations/reservation-service';

const DEFAULT_POLICY = {
  freeWindowMinutes: 60,
  penaltyRate: 0.2,
  platformPenaltyShare: 0.7,
  stationPenaltyShare: 0.3,
};

function makeQueueEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1',
    user_id: 'user-1',
    station_id: 'station-1',
    entry_type: 'queue',
    status: 'confirmed',
    stripe_payment_id: 'pi_test',
    amount_paid: '100.00',
    queue_position: 1,
    time_slot_id: null,
    commission_rate: '0.10',
    commission_amount: '10.00',
    station_payout: '90.00',
    tip_amount: null,
    stripe_transfer_id: null,
    stripe_refund_id: null,
    stripe_payment_succeeded_at: null,
    stripe_payment_succeeded_notified_at: null,
    client_confirmed: false,
    cancellation_reason: null,
    penalty_amount: null,
    confirmed_at: null,
    completed_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCancellationPolicy.mockResolvedValue(DEFAULT_POLICY);
  mockNotifyEntry.mockResolvedValue(undefined);
  mockShiftQueuePositions.mockResolvedValue(undefined);
});

describe('cancelEntry — queue cancellation path', () => {
  describe('confirmed queue entry with stripe_payment_id', () => {
    it('applies cancellation fees: captures PI, issues partial refund, distributes penalty', async () => {
      const entry = makeQueueEntry();
      mockFindEntryByIdAndUser.mockResolvedValue(entry);
      mockUpdateEntry.mockResolvedValue(entry);
      mockCapturePaymentIntent.mockResolvedValue(undefined);
      mockRefundPaymentIntent.mockResolvedValue('re_test');
      mockDistributePenalty.mockResolvedValue(undefined);

      const result = await cancelEntry('entry-1', 'user-1');

      expect(mockCapturePaymentIntent).toHaveBeenCalledWith('pi_test');
      expect(mockRefundPaymentIntent).toHaveBeenCalledWith(
        'pi_test',
        expect.any(Number),
        expect.stringContaining('queue-cancel-refund:')
      );
      expect(mockDistributePenalty).toHaveBeenCalledWith(
        'pi_test',
        expect.any(Number),
        DEFAULT_POLICY.stationPenaltyShare
      );
      expect(result.isLateCancellation).toBe(true);
      expect(result.penaltyAmount).toBeCloseTo(20, 5);
      expect(result.refundedAmount).toBeCloseTo(80, 5);
    });
  });

  describe('pending_payment queue entry', () => {
    it('cancels the PaymentIntent without capturing and applies no fee', async () => {
      const entry = makeQueueEntry({ status: 'pending_payment' });
      mockFindEntryByIdAndUser.mockResolvedValue(entry);
      mockUpdateEntry.mockResolvedValue(entry);
      mockCancelPaymentIntent.mockResolvedValue(undefined);

      const result = await cancelEntry('entry-1', 'user-1');

      expect(mockCapturePaymentIntent).not.toHaveBeenCalled();
      expect(mockCancelPaymentIntent).toHaveBeenCalledWith('pi_test');
      expect(result.isLateCancellation).toBeUndefined();
    });
  });

  describe('capturePaymentIntent failure', () => {
    it('does not call refundPaymentIntent when capture fails', async () => {
      const entry = makeQueueEntry();
      mockFindEntryByIdAndUser.mockResolvedValue(entry);
      mockUpdateEntry.mockResolvedValue(entry);
      mockCapturePaymentIntent.mockRejectedValue(new Error('Stripe capture failed'));

      const result = await cancelEntry('entry-1', 'user-1');

      expect(mockRefundPaymentIntent).not.toHaveBeenCalled();
      expect(mockDistributePenalty).not.toHaveBeenCalled();
      expect(result.isLateCancellation).toBe(true);
    });
  });

  describe('in_progress queue entry', () => {
    it('falls through to simple cancellation path — does not apply fees', async () => {
      // A queue entry in in_progress is already being served. Clients cannot
      // trigger the fee-bearing capture/refund path for an entry already at the
      // station; it should fall through to the simple (no-Stripe) cancel branch.
      const entry = makeQueueEntry({ status: 'in_progress', queue_position: null });
      mockFindEntryByIdAndUser.mockResolvedValue(entry);
      mockUpdateEntry.mockResolvedValue(entry);

      const result = await cancelEntry('entry-1', 'user-1');

      expect(mockCapturePaymentIntent).not.toHaveBeenCalled();
      expect(mockRefundPaymentIntent).not.toHaveBeenCalled();
      expect(result.isLateCancellation).toBeUndefined();
    });
  });
});
