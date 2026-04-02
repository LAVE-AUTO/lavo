/**
 * Unit tests for orphan-cleanup-service: cleanupOrphanedPaymentEntries.
 * All dependencies are mocked; no real DB calls are made.
 * @jest-environment node
 */

// %%%%% Mocks %%%%%

const mockFindOrphanedPendingPaymentEntries = jest.fn();
const mockCancelOrphanedEntryIfEligible = jest.fn();
const mockShiftQueuePositions = jest.fn();

jest.mock('@/server/reservations/entry-repository', () => ({
  findOrphanedPendingPaymentEntries: (...args: unknown[]) =>
    mockFindOrphanedPendingPaymentEntries(...args),
  cancelOrphanedEntryIfEligible: (...args: unknown[]) =>
    mockCancelOrphanedEntryIfEligible(...args),
  shiftQueuePositions: (...args: unknown[]) => mockShiftQueuePositions(...args),
}));

jest.mock('@/lib/db', () => ({
  db: {
    transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({})),
  },
}));


// %%%%% Imports %%%%%

import { cleanupOrphanedPaymentEntries } from '@/server/reservations/orphan-cleanup-service';


// %%%%% Fixtures %%%%%

const makeEntry = (overrides: Partial<{
  id: string;
  user_id: string;
  station_id: string;
  status: string;
  stripe_payment_id: string | null;
  entry_type: string;
  queue_position: number | null;
  created_at: Date;
}> = {}) => ({
  id: 'entry-1',
  user_id: 'user-1',
  station_id: 'station-1',
  status: 'pending_payment',
  stripe_payment_id: null,
  entry_type: 'queue',
  queue_position: 2,
  created_at: new Date(Date.now() - 20 * 60_000), // 20 minutes ago
  ...overrides,
});


// %%%%% Setup %%%%%

beforeEach(() => {
  jest.clearAllMocks();
  mockCancelOrphanedEntryIfEligible.mockResolvedValue({ id: 'entry-1', status: 'cancelled' });
  mockShiftQueuePositions.mockResolvedValue(undefined);
});


// %%%%% Tests %%%%%

describe('cleanupOrphanedPaymentEntries', () => {

  it('cancels an orphaned entry older than timeout and returns cancelled: 1', async () => {
    const entry = makeEntry();
    mockFindOrphanedPendingPaymentEntries.mockResolvedValue([entry]);

    const result = await cleanupOrphanedPaymentEntries(15);

    expect(result).toEqual({ cancelled: 1 });
    expect(mockFindOrphanedPendingPaymentEntries).toHaveBeenCalledWith(15);
    expect(mockCancelOrphanedEntryIfEligible).toHaveBeenCalledWith(
      entry.id,
      expect.anything()
    );
    expect(mockShiftQueuePositions).toHaveBeenCalledWith(
      entry.station_id,
      entry.queue_position! + 1,
      -1,
      expect.anything()
    );
  });

  it('does not touch an entry that already has a stripe_payment_id', async () => {
    // The repository query filters these out; this test confirms the service itself
    // processes only what the repository returns (empty in this case).
    mockFindOrphanedPendingPaymentEntries.mockResolvedValue([]);

    const result = await cleanupOrphanedPaymentEntries(15);

    expect(result).toEqual({ cancelled: 0 });
    expect(mockCancelOrphanedEntryIfEligible).not.toHaveBeenCalled();
  });

  it('does not touch a reservation entry (entry_type !== queue)', async () => {
    // Repository filters by entry_type='queue'; an empty result confirms the service
    // only acts on what is returned.
    mockFindOrphanedPendingPaymentEntries.mockResolvedValue([]);

    const result = await cleanupOrphanedPaymentEntries(15);

    expect(result).toEqual({ cancelled: 0 });
    expect(mockCancelOrphanedEntryIfEligible).not.toHaveBeenCalled();
  });

  it('does not cancel an orphaned entry younger than the timeout', async () => {
    // The repository filters by created_at < cutoff; an empty result reflects an entry
    // created only 5 minutes ago when the timeout is 15 minutes.
    mockFindOrphanedPendingPaymentEntries.mockResolvedValue([]);

    const result = await cleanupOrphanedPaymentEntries(15);

    expect(result).toEqual({ cancelled: 0 });
    expect(mockCancelOrphanedEntryIfEligible).not.toHaveBeenCalled();
  });

  it('cancels multiple orphaned entries and returns the correct count', async () => {
    const entries = [
      makeEntry({ id: 'entry-1', queue_position: 1 }),
      makeEntry({ id: 'entry-2', queue_position: 2 }),
      makeEntry({ id: 'entry-3', queue_position: 3 }),
    ];
    mockFindOrphanedPendingPaymentEntries.mockResolvedValue(entries);

    const result = await cleanupOrphanedPaymentEntries(15);

    expect(result).toEqual({ cancelled: 3 });
    expect(mockCancelOrphanedEntryIfEligible).toHaveBeenCalledTimes(3);
    expect(mockShiftQueuePositions).toHaveBeenCalledTimes(3);
  });

  it('counts only successfully cancelled entries when one transaction fails', async () => {
    const entries = [
      makeEntry({ id: 'entry-1', queue_position: 1 }),
      makeEntry({ id: 'entry-2', queue_position: 2 }),
    ];
    mockFindOrphanedPendingPaymentEntries.mockResolvedValue(entries);
    // First succeeds, second throws.
    mockCancelOrphanedEntryIfEligible
      .mockResolvedValueOnce({ id: 'entry-1', status: 'cancelled' })
      .mockRejectedValueOnce(new Error('DB error'));

    const result = await cleanupOrphanedPaymentEntries(15);

    expect(result).toEqual({ cancelled: 1 });
  });

  it('skips the entry and does not count it when cancelOrphanedEntryIfEligible returns undefined (race condition)', async () => {
    // Simulates the race where the entry was confirmed between the fetch and the cancel.
    const entry = makeEntry({ queue_position: 2 });
    mockFindOrphanedPendingPaymentEntries.mockResolvedValue([entry]);
    mockCancelOrphanedEntryIfEligible.mockResolvedValue(undefined);

    const result = await cleanupOrphanedPaymentEntries(15);

    expect(result).toEqual({ cancelled: 0 });
    expect(mockShiftQueuePositions).not.toHaveBeenCalled();
  });

  it('skips queue position shift when queue_position is null', async () => {
    const entry = makeEntry({ queue_position: null });
    mockFindOrphanedPendingPaymentEntries.mockResolvedValue([entry]);

    const result = await cleanupOrphanedPaymentEntries(15);

    expect(result).toEqual({ cancelled: 1 });
    expect(mockCancelOrphanedEntryIfEligible).toHaveBeenCalledTimes(1);
    expect(mockShiftQueuePositions).not.toHaveBeenCalled();
  });

  it('is idempotent: running twice on the same data produces the same result', async () => {
    // After the first run, orphans are cancelled and no longer returned by the query.
    mockFindOrphanedPendingPaymentEntries
      .mockResolvedValueOnce([makeEntry()])
      .mockResolvedValueOnce([]);

    const first = await cleanupOrphanedPaymentEntries(15);
    const second = await cleanupOrphanedPaymentEntries(15);

    expect(first).toEqual({ cancelled: 1 });
    expect(second).toEqual({ cancelled: 0 });
    expect(mockCancelOrphanedEntryIfEligible).toHaveBeenCalledTimes(1);
  });
});
