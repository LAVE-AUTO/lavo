/**
 * Unit tests for cancellation-service: cancelReservationByStation path.
 * Verifies that station-initiated cancellations apply the same penalty policy
 * as client-initiated cancellations and notify the client with the right wording.
 */
const mockFindReservationWithSlotByStation = jest.fn();
const mockFindEntryByIdAndStation = jest.fn();
const mockUpdateEntry = jest.fn();
const mockDecrementSlotBookedCount = jest.fn();
const mockGetCancellationPolicy = jest.fn();
const mockGetConfigByStationId = jest.fn();
const mockCapturePaymentIntent = jest.fn();
const mockCancelPaymentIntent = jest.fn();
const mockRefundPaymentIntent = jest.fn();
const mockDistributePenalty = jest.fn();
const mockClassifyStripeError = jest.fn();
const mockMarkPiCancelFailed = jest.fn();
const mockMarkRefundPersistFailed = jest.fn();
const mockSetStripeTransferIdIfMissing = jest.fn();
const mockNotifyEntry = jest.fn();
const mockNotifyClientFeed = jest.fn();
const mockLogFinancialEvent = jest.fn();

jest.mock('@/server/reservations/entry-repository', () => ({
  findReservationWithSlot: jest.fn(),
  findReservationWithSlotByStation: (...args: unknown[]) => mockFindReservationWithSlotByStation(...args),
  findEntryByIdAndUser: jest.fn(),
  findEntryByIdAndStation: (...args: unknown[]) => mockFindEntryByIdAndStation(...args),
  updateEntry: (...args: unknown[]) => mockUpdateEntry(...args),
  markPiCancelFailed: (...args: unknown[]) => mockMarkPiCancelFailed(...args),
  markRefundPersistFailed: (...args: unknown[]) => mockMarkRefundPersistFailed(...args),
  setStripeTransferIdIfMissing: (...args: unknown[]) => Promise.resolve(mockSetStripeTransferIdIfMissing(...args)),
}));

jest.mock('@/server/station/slot-repository', () => ({
  decrementSlotBookedCount: (...args: unknown[]) => mockDecrementSlotBookedCount(...args),
}));

jest.mock('@/server/admin/platform-settings-service', () => ({
  getCancellationPolicy: (...args: unknown[]) => mockGetCancellationPolicy(...args),
}));

jest.mock('@/server/station/config-repository', () => ({
  getConfigByStationId: (...args: unknown[]) => mockGetConfigByStationId(...args),
}));

jest.mock('@/server/payments/payment-service', () => ({
  capturePaymentIntent: (...args: unknown[]) => mockCapturePaymentIntent(...args),
  cancelPaymentIntent: (...args: unknown[]) => mockCancelPaymentIntent(...args),
  refundPaymentIntent: (...args: unknown[]) => mockRefundPaymentIntent(...args),
  distributePenalty: (...args: unknown[]) => mockDistributePenalty(...args),
  classifyStripeError: (...args: unknown[]) => mockClassifyStripeError(...args),
}));

jest.mock('@/server/payments/financial-event-logger', () => ({
  logFinancialEvent: (...args: unknown[]) => mockLogFinancialEvent(...args),
}));

jest.mock('@/server/notifications/notification-service', () => ({
  notifyEntry: (...args: unknown[]) => mockNotifyEntry(...args),
}));

jest.mock('@/server/notifications/client-feed-notifications', () => ({
  notifyClientFeed: (...args: unknown[]) => mockNotifyClientFeed(...args),
}));

jest.mock('@/lib/db', () => ({
  db: {
    transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({})),
  },
}));

import { cancelReservationByStation } from '@/server/reservations/cancellation-service';
import { NotFoundError, ConflictError } from '@/lib/errors';

const DEFAULT_POLICY = {
  freeWindowMinutes: 60,
  penaltyRate: 0.2,
  platformPenaltyShare: 0.7,
  stationPenaltyShare: 0.3,
};

function makeReservation(overrides: Record<string, unknown> = {}) {
  const slotStart = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now by default
  return {
    id: 'res-1',
    user_id: 'user-1',
    station_id: 'station-1',
    entry_type: 'reservation' as const,
    status: 'confirmed' as const,
    time_slot_id: 'slot-1',
    slotStartTime: slotStart,
    amount_paid: '100.00',
    station_service_total: '80.00',
    station_payout: '70.00',
    stripe_payment_id: 'pi_test',
    ...overrides,
  };
}

function makeCurrentEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'res-1',
    user_id: 'user-1',
    station_id: 'station-1',
    entry_type: 'reservation' as const,
    status: 'confirmed' as const,
    ...overrides,
  };
}

describe('cancelReservationByStation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCancellationPolicy.mockResolvedValue(DEFAULT_POLICY);
    mockGetConfigByStationId.mockResolvedValue({ closing_time: '23:00' });
    mockClassifyStripeError.mockReturnValue({ class: 'unknown', code: undefined, message: 'test error' });
    mockNotifyEntry.mockResolvedValue(undefined);
    mockNotifyClientFeed.mockResolvedValue(undefined);
  });

  it('cancels for free when outside the free cancellation window', async () => {
    const reservation = makeReservation({ slotStartTime: new Date(Date.now() + 2 * 60 * 60 * 1000) });
    mockFindReservationWithSlotByStation.mockResolvedValue(reservation);
    mockFindEntryByIdAndStation.mockResolvedValue(makeCurrentEntry());
    mockUpdateEntry.mockResolvedValue({ ...makeCurrentEntry(), status: 'cancelled' });
    mockCancelPaymentIntent.mockResolvedValue(undefined);

    const result = await cancelReservationByStation('res-1', 'station-1');

    expect(result.isLateCancellation).toBe(false);
    expect(result.penaltyAmount).toBe(0);
    // The refundable amount is computed from amount_paid even when the PI is cancelled rather
    // than refunded; the actual money movement here is the PI cancellation, not a refund.
    expect(result.refundedAmount).toBeCloseTo(100, 5);
    expect(mockCancelPaymentIntent).toHaveBeenCalledWith('pi_test');
    expect(mockCapturePaymentIntent).not.toHaveBeenCalled();
    expect(mockNotifyClientFeed).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        kind: 'reservation_cancelled',
        body: 'La station a annulé votre réservation. Un remboursement a été initié.',
      })
    );
  });

  it('applies a late-cancellation penalty when inside the free window', async () => {
    const reservation = makeReservation({ slotStartTime: new Date(Date.now() + 15 * 60 * 1000) });
    mockFindReservationWithSlotByStation.mockResolvedValue(reservation);
    mockFindEntryByIdAndStation.mockResolvedValue(makeCurrentEntry());
    mockUpdateEntry.mockResolvedValue({ ...makeCurrentEntry(), status: 'cancelled', penalty_amount: '16.00' });
    mockCapturePaymentIntent.mockResolvedValue({ charged: true, chargeId: 'ch_test', transferId: 'tr_test' });
    mockRefundPaymentIntent.mockResolvedValue('re_test');
    mockDistributePenalty.mockResolvedValue(undefined);

    const result = await cancelReservationByStation('res-1', 'station-1', 'client no-show');

    expect(result.isLateCancellation).toBe(true);
    // 20% of station_service_total (80.00), not amount_paid (100.00).
    expect(result.penaltyAmount).toBeCloseTo(16, 5);
    expect(result.refundedAmount).toBeCloseTo(84, 5);
    expect(mockCapturePaymentIntent).toHaveBeenCalledWith('pi_test');
    expect(mockRefundPaymentIntent).toHaveBeenCalledWith('pi_test', 8400, expect.any(String));
    expect(mockDistributePenalty).toHaveBeenCalled();
    expect(mockUpdateEntry).toHaveBeenCalledWith(
      'res-1',
      expect.objectContaining({
        status: 'cancelled',
        cancellation_reason: 'client no-show',
        penalty_amount: '16.00',
      }),
      expect.anything()
    );
  });

  it('uses a default reason when the station provides none', async () => {
    const reservation = makeReservation({ slotStartTime: new Date(Date.now() + 2 * 60 * 60 * 1000) });
    mockFindReservationWithSlotByStation.mockResolvedValue(reservation);
    mockFindEntryByIdAndStation.mockResolvedValue(makeCurrentEntry());
    mockUpdateEntry.mockResolvedValue({ ...makeCurrentEntry(), status: 'cancelled' });
    mockCancelPaymentIntent.mockResolvedValue(undefined);

    await cancelReservationByStation('res-1', 'station-1');

    expect(mockUpdateEntry).toHaveBeenCalledWith(
      'res-1',
      expect.objectContaining({ cancellation_reason: 'cancelled_by_station' }),
      expect.anything()
    );
  });

  it('throws NotFoundError when the reservation does not belong to the station', async () => {
    mockFindReservationWithSlotByStation.mockResolvedValue(undefined);

    await expect(cancelReservationByStation('res-1', 'station-1')).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError when the reservation is not confirmed', async () => {
    mockFindReservationWithSlotByStation.mockResolvedValue(
      makeReservation({ status: 'pending_payment' })
    );

    await expect(cancelReservationByStation('res-1', 'station-1')).rejects.toThrow(ConflictError);
  });

  it('waives the penalty when the slot is past station closing (station-fault override)', async () => {
    const now = new Date();
    // Slot starts at 23:30, station closes at 23:00 => station-fault.
    const slotStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 30, 0);
    const reservation = makeReservation({ slotStartTime: slotStart });
    mockFindReservationWithSlotByStation.mockResolvedValue(reservation);
    mockFindEntryByIdAndStation.mockResolvedValue(makeCurrentEntry());
    mockUpdateEntry.mockResolvedValue({ ...makeCurrentEntry(), status: 'cancelled' });
    mockCancelPaymentIntent.mockResolvedValue(undefined);

    const result = await cancelReservationByStation('res-1', 'station-1');

    expect(result.isLateCancellation).toBe(false);
    expect(result.penaltyAmount).toBe(0);
    expect(mockCancelPaymentIntent).toHaveBeenCalledWith('pi_test');
    expect(mockCapturePaymentIntent).not.toHaveBeenCalled();
  });
});
