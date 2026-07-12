/**
 * Unit tests for no-show-service: markQueueNoShows (all dependencies mocked).
 */
const mockListActiveQueueEntries = jest.fn();
const mockUpdateEntry = jest.fn();
const mockCancelQueueEntryForNoShowIfEligible = jest.fn();
const mockGetCancellationPolicy = jest.fn();
const mockGetConfigByStationId = jest.fn();
const mockCapturePaymentIntent = jest.fn();
const mockRefundPaymentIntent = jest.fn();
const mockDistributePenalty = jest.fn();
const mockNotifyEntry = jest.fn();
const mockRunWithConcurrencyLimit = jest.fn();

jest.mock('@/server/reservations/entry-repository', () => ({
  listActiveQueueEntries: (...args: unknown[]) => mockListActiveQueueEntries(...args),
  updateEntry: (...args: unknown[]) => mockUpdateEntry(...args),
  cancelQueueEntryForNoShowIfEligible: (...args: unknown[]) =>
    mockCancelQueueEntryForNoShowIfEligible(...args),
}));

jest.mock('@/server/admin/platform-settings-service', () => ({
  getCancellationPolicy: (...args: unknown[]) => mockGetCancellationPolicy(...args),
}));

jest.mock('@/server/station/config-repository', () => ({
  getConfigByStationId: (...args: unknown[]) => mockGetConfigByStationId(...args),
}));

jest.mock('@/server/payments/payment-service', () => ({
  capturePaymentIntent: (...args: unknown[]) => mockCapturePaymentIntent(...args),
  refundPaymentIntent: (...args: unknown[]) => mockRefundPaymentIntent(...args),
  distributePenalty: (...args: unknown[]) => mockDistributePenalty(...args),
}));

jest.mock('@/server/notifications/notification-service', () => ({
  notifyEntry: (...args: unknown[]) => mockNotifyEntry(...args),
}));
jest.mock('@/server/notifications/client-feed-notifications', () => ({
  notifyClientFeed: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/helpers/concurrency', () => ({
  runWithConcurrencyLimit: (...args: unknown[]) => mockRunWithConcurrencyLimit(...args),
}));

import { markQueueNoShows } from '@/server/reservations/no-show-service';

const DEFAULT_POLICY = {
  freeWindowMinutes: 60,
  penaltyRate: 0.2,
  platformPenaltyShare: 0.7,
  stationPenaltyShare: 0.3,
};

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1',
    station_id: 'station-1',
    user_id: 'user-1',
    status: 'confirmed',
    amount_paid: '50.00',
    station_service_total: '50.00',
    stripe_payment_id: 'pi_test',
    entry_type: 'queue',
    queue_position: 1,
    vehicle_format_id: 'fmt-1',
    booking_source: 'standard',
    time_slot_id: null,
    commission_rate: '0.10',
    commission_amount: '5.00',
    station_payout: '45.00',
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
    created_at: new Date(Date.now() - 25 * 60 * 60 * 1000),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeRealConcurrencyMock() {
  mockRunWithConcurrencyLimit.mockImplementation(
    async <T>(items: T[], _limit: number, fn: (item: T) => Promise<void>) =>
      Promise.allSettled(items.map((item) => fn(item)))
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCancellationPolicy.mockResolvedValue(DEFAULT_POLICY);
  // Default: the conditional cancel succeeds (returns the updated row).
  // Tests that want to simulate an already-cancelled entry override this to return undefined.
  mockCancelQueueEntryForNoShowIfEligible.mockImplementation(
    async (id: string) => ({ id, status: 'cancelled' })
  );
  makeRealConcurrencyMock();
});

describe('markQueueNoShows', () => {
  it('returns zero counts when there are no active entries', async () => {
    mockListActiveQueueEntries.mockResolvedValue([]);

    const result = await markQueueNoShows();

    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0, errors: [] });
    expect(mockUpdateEntry).not.toHaveBeenCalled();
  });

  it('skips entries whose station has no closing_time configured', async () => {
    const entry = makeEntry();
    mockListActiveQueueEntries.mockResolvedValue([entry]);
    mockGetConfigByStationId.mockResolvedValue({ closing_time: null });

    const result = await markQueueNoShows();

    expect(result.processed).toBe(0);
    expect(mockCancelQueueEntryForNoShowIfEligible).not.toHaveBeenCalled();
  });

  it('skips entries whose station has not yet closed for the day', async () => {
    const entry = makeEntry({ created_at: new Date() });
    mockListActiveQueueEntries.mockResolvedValue([entry]);
    mockGetConfigByStationId.mockResolvedValue({ closing_time: '23:59' });

    const result = await markQueueNoShows();

    expect(result.processed).toBe(0);
    expect(mockCancelQueueEntryForNoShowIfEligible).not.toHaveBeenCalled();
  });

  it('processes an eligible entry: cancels in DB, captures PI, issues partial refund, notifies', async () => {
    const entry = makeEntry();
    mockListActiveQueueEntries.mockResolvedValue([entry]);
    mockGetConfigByStationId.mockResolvedValue({ closing_time: '00:01' });
    mockUpdateEntry.mockResolvedValue(entry);
    mockCapturePaymentIntent.mockResolvedValue({ chargeId: null, transferId: null });
    mockRefundPaymentIntent.mockResolvedValue('re_test');
    mockDistributePenalty.mockResolvedValue(undefined);
    mockNotifyEntry.mockResolvedValue(undefined);

    const result = await markQueueNoShows();

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);

    expect(mockCancelQueueEntryForNoShowIfEligible).toHaveBeenCalledWith(
      entry.id,
      expect.any(String)
    );
    expect(mockCapturePaymentIntent).toHaveBeenCalledWith(entry.stripe_payment_id);
    expect(mockRefundPaymentIntent).toHaveBeenCalledWith(
      entry.stripe_payment_id,
      expect.any(Number),
      expect.stringContaining('no-show-refund:')
    );
    expect(mockNotifyEntry).toHaveBeenCalledWith(
      expect.objectContaining({ entryId: entry.id, type: 'queue_no_show' })
    );
  });

  it('skips Stripe work when the conditional cancel finds no eligible row (already processed)', async () => {
    const entry = makeEntry();
    mockListActiveQueueEntries.mockResolvedValue([entry]);
    mockGetConfigByStationId.mockResolvedValue({ closing_time: '00:01' });
    mockCancelQueueEntryForNoShowIfEligible.mockResolvedValueOnce(undefined);

    const result = await markQueueNoShows();

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(mockCapturePaymentIntent).not.toHaveBeenCalled();
    expect(mockRefundPaymentIntent).not.toHaveBeenCalled();
    expect(mockDistributePenalty).not.toHaveBeenCalled();
    expect(mockNotifyEntry).not.toHaveBeenCalled();
  });

  it('increments failed and records error when the conditional cancel throws', async () => {
    const entry = makeEntry();
    mockListActiveQueueEntries.mockResolvedValue([entry]);
    mockGetConfigByStationId.mockResolvedValue({ closing_time: '00:01' });
    mockCancelQueueEntryForNoShowIfEligible.mockRejectedValueOnce(new Error('DB write failed'));

    const result = await markQueueNoShows();

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      entryId: entry.id,
      error: 'DB write failed',
    });
  });

  it('does not call refundPaymentIntent when capturePaymentIntent fails', async () => {
    const entry = makeEntry();
    mockListActiveQueueEntries.mockResolvedValue([entry]);
    mockGetConfigByStationId.mockResolvedValue({ closing_time: '00:01' });
    mockCapturePaymentIntent.mockRejectedValue(new Error('Stripe capture error'));
    mockNotifyEntry.mockResolvedValue(undefined);

    const result = await markQueueNoShows();

    expect(result.succeeded).toBe(1);
    expect(mockRefundPaymentIntent).not.toHaveBeenCalled();
    expect(mockDistributePenalty).not.toHaveBeenCalled();
  });

  it('clamps a negative or invalid amount_paid so Stripe never receives negative cents', async () => {
    const entry = makeEntry({ amount_paid: '-10.00', station_service_total: '-10.00' });
    mockListActiveQueueEntries.mockResolvedValue([entry]);
    mockGetConfigByStationId.mockResolvedValue({ closing_time: '00:01' });
    mockCapturePaymentIntent.mockResolvedValue({ chargeId: null, transferId: null });
    mockNotifyEntry.mockResolvedValue(undefined);

    const result = await markQueueNoShows();

    expect(result.succeeded).toBe(1);
    // Clamped to 0 → no refund, no penalty distribution.
    expect(mockRefundPaymentIntent).not.toHaveBeenCalled();
    expect(mockDistributePenalty).not.toHaveBeenCalled();
  });

  it('does not mark as failed when only the notification fails (DB + Stripe already settled)', async () => {
    const entry = makeEntry();
    mockListActiveQueueEntries.mockResolvedValue([entry]);
    mockGetConfigByStationId.mockResolvedValue({ closing_time: '00:01' });
    mockCapturePaymentIntent.mockResolvedValue({ chargeId: null, transferId: null });
    mockRefundPaymentIntent.mockResolvedValue('re_test');
    mockDistributePenalty.mockResolvedValue(undefined);
    mockNotifyEntry.mockRejectedValue(new Error('FCM down'));

    const result = await markQueueNoShows();

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockRefundPaymentIntent).toHaveBeenCalled();
  });
});
