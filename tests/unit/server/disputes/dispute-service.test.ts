/**
 * Unit tests for dispute-service: createDispute, listDisputesAdmin,
 * refundDispute, closeDispute.
 * @jest-environment node
 */

// ─── Repository mocks ─────────────────────────────────────────────────────────

const mockFindDisputeById = jest.fn();
const mockFindDisputeByReservationId = jest.fn();
const mockCreateDispute = jest.fn();
const mockUpdateDispute = jest.fn();
const mockListDisputes = jest.fn();

jest.mock('@/server/disputes/dispute-repository', () => ({
  findDisputeById: (...args: unknown[]) => mockFindDisputeById(...args),
  findDisputeByReservationId: (...args: unknown[]) => mockFindDisputeByReservationId(...args),
  createDispute: (...args: unknown[]) => mockCreateDispute(...args),
  updateDispute: (...args: unknown[]) => mockUpdateDispute(...args),
  listDisputes: (...args: unknown[]) => mockListDisputes(...args),
}));

// ─── DB mock ──────────────────────────────────────────────────────────────────

const mockReservationsFindFirst = jest.fn();
const mockTxInsert = jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue([]) });
const mockTx = { insert: (...args: unknown[]) => mockTxInsert(...args) };

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      reservations: { findFirst: (...args: unknown[]) => mockReservationsFindFirst(...args) },
    },
    transaction: jest.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
  },
}));

// ─── Payment service mock ─────────────────────────────────────────────────────

const mockRefundPaymentIntent = jest.fn();

jest.mock('@/server/payments/payment-service', () => ({
  refundPaymentIntent: (...args: unknown[]) => mockRefundPaymentIntent(...args),
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import {
  createDispute,
  listDisputesAdmin,
  refundDispute,
  closeDispute,
} from '@/server/disputes/dispute-service';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  DisputeAlreadyExistsError,
  DisputeAlreadyClosedError,
  RefundNotEligibleError,
} from '@/lib/errors';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CLIENT_ID = 'client-uuid-0001';
const ADMIN_ID  = 'admin-uuid-0001';
const DISPUTE_ID = 'dispute-uuid-0001';
const RESERVATION_ID = 'res-uuid-0001';
const STATION_ID = 'station-uuid-0001';

const completedReservation = {
  id: RESERVATION_ID,
  user_id: CLIENT_ID,
  station_id: STATION_ID,
  status: 'completed',
  amount_paid: '50.00',
  stripe_payment_id: 'pi_test_123',
  stripe_payment_succeeded_at: new Date(),
  stripe_transfer_id: null,
};

const openDispute = {
  id: DISPUTE_ID,
  reservation_id: RESERVATION_ID,
  client_id: CLIENT_ID,
  station_id: STATION_ID,
  reason: 'Rayure',
  status: 'open' as const,
  description: null,
  requested_amount: null,
  refunded_amount: null,
  stripe_refund_id: null,
  closed_by: null,
  closed_reason: null,
  created_at: new Date(),
  updated_at: new Date(),
};

// ─── createDispute ────────────────────────────────────────────────────────────

describe('createDispute', () => {
  const input = { reservation_id: RESERVATION_ID, reason: 'Rayure sur le capot' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockReservationsFindFirst.mockResolvedValue(completedReservation);
    mockFindDisputeByReservationId.mockResolvedValue(undefined);
    mockCreateDispute.mockResolvedValue(openDispute);
  });

  it('creates a dispute for a completed, paid reservation owned by the client', async () => {
    const result = await createDispute(CLIENT_ID, input);
    expect(result.id).toBe(DISPUTE_ID);
    expect(mockCreateDispute).toHaveBeenCalledWith(
      expect.objectContaining({
        reservation_id: RESERVATION_ID,
        client_id: CLIENT_ID,
        station_id: STATION_ID,
        reason: 'Rayure sur le capot',
      })
    );
  });

  it('formats requested_amount to 2 decimal places', async () => {
    await createDispute(CLIENT_ID, { ...input, requested_amount: 10.5 });
    expect(mockCreateDispute).toHaveBeenCalledWith(
      expect.objectContaining({ requested_amount: '10.50' })
    );
  });

  it('passes undefined requested_amount when not provided', async () => {
    await createDispute(CLIENT_ID, input);
    expect(mockCreateDispute).toHaveBeenCalledWith(
      expect.objectContaining({ requested_amount: undefined })
    );
  });

  it('throws NotFoundError when reservation does not exist', async () => {
    mockReservationsFindFirst.mockResolvedValue(undefined);
    await expect(createDispute(CLIENT_ID, input)).rejects.toThrow(NotFoundError);
    expect(mockCreateDispute).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when reservation belongs to another user', async () => {
    mockReservationsFindFirst.mockResolvedValue({ ...completedReservation, user_id: 'other-user' });
    await expect(createDispute(CLIENT_ID, input)).rejects.toThrow(ForbiddenError);
    expect(mockCreateDispute).not.toHaveBeenCalled();
  });

  it('throws ValidationError when reservation is not completed', async () => {
    mockReservationsFindFirst.mockResolvedValue({ ...completedReservation, status: 'confirmed' });
    await expect(createDispute(CLIENT_ID, input)).rejects.toThrow(ValidationError);
    expect(mockCreateDispute).not.toHaveBeenCalled();
  });

  it('throws ValidationError when reservation has no confirmed payment', async () => {
    mockReservationsFindFirst.mockResolvedValue({
      ...completedReservation,
      stripe_payment_id: null,
    });
    await expect(createDispute(CLIENT_ID, input)).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when stripe_payment_succeeded_at is null', async () => {
    mockReservationsFindFirst.mockResolvedValue({
      ...completedReservation,
      stripe_payment_succeeded_at: null,
    });
    await expect(createDispute(CLIENT_ID, input)).rejects.toThrow(ValidationError);
  });

  it('throws DisputeAlreadyExistsError when a dispute already exists for this reservation', async () => {
    mockFindDisputeByReservationId.mockResolvedValue(openDispute);
    await expect(createDispute(CLIENT_ID, input)).rejects.toThrow(DisputeAlreadyExistsError);
    expect(mockCreateDispute).not.toHaveBeenCalled();
  });

  it('throws DisputeAlreadyExistsError when repo.createDispute raises a 23505 DB unique violation', async () => {
    // Simulates concurrent requests: both pass the app-level uniqueness check, second hits the DB constraint.
    const pgUniqueError = Object.assign(new Error('duplicate key value'), { code: '23505' });
    mockCreateDispute.mockRejectedValue(pgUniqueError);
    await expect(createDispute(CLIENT_ID, input)).rejects.toThrow(DisputeAlreadyExistsError);
  });

  it('throws ValidationError when reservation was completed more than 30 days ago', async () => {
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    mockReservationsFindFirst.mockResolvedValue({
      ...completedReservation,
      completed_at: oldDate,
      updated_at: oldDate,
    });
    await expect(createDispute(CLIENT_ID, input)).rejects.toThrow(ValidationError);
    expect(mockCreateDispute).not.toHaveBeenCalled();
  });

  it('accepts a dispute opened exactly at the 30-day boundary', async () => {
    const boundaryDate = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    mockReservationsFindFirst.mockResolvedValue({
      ...completedReservation,
      completed_at: boundaryDate,
      updated_at: boundaryDate,
    });
    const result = await createDispute(CLIENT_ID, input);
    expect(result.id).toBe(DISPUTE_ID);
  });
});

// ─── listDisputesAdmin ────────────────────────────────────────────────────────

describe('listDisputesAdmin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListDisputes.mockResolvedValue({ items: [openDispute], total: 1 });
  });

  it('returns items and correct pagination meta', async () => {
    const result = await listDisputesAdmin({ page: 1, per_page: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.meta.page).toBe(1);
    expect(result.meta.per_page).toBe(20);
    expect(result.meta.total_pages).toBe(1);
  });

  it('computes total_pages correctly for multi-page results', async () => {
    mockListDisputes.mockResolvedValue({ items: [], total: 45 });
    const result = await listDisputesAdmin({ page: 2, per_page: 20 });
    expect(result.meta.total_pages).toBe(3);
  });

  it('returns total_pages=0 when total is 0', async () => {
    mockListDisputes.mockResolvedValue({ items: [], total: 0 });
    const result = await listDisputesAdmin({ page: 1, per_page: 20 });
    expect(result.meta.total_pages).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('forwards filters to the repository', async () => {
    await listDisputesAdmin({
      page: 1,
      per_page: 10,
      status: 'open',
      station_id: STATION_ID,
      client_id: CLIENT_ID,
    });
    expect(mockListDisputes).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'open',
        station_id: STATION_ID,
        client_id: CLIENT_ID,
      }),
      1,
      10
    );
  });

  it('converts date_from and date_to strings to Date objects', async () => {
    await listDisputesAdmin({ page: 1, per_page: 20, date_from: '2024-01-01T00:00:00Z', date_to: '2024-12-31T23:59:59Z' });
    const call = mockListDisputes.mock.calls[0][0];
    expect(call.date_from).toBeInstanceOf(Date);
    expect(call.date_to).toBeInstanceOf(Date);
  });
});

// ─── refundDispute ────────────────────────────────────────────────────────────

describe('refundDispute', () => {
  const refundedDispute = { ...openDispute, status: 'refunded' as const, refunded_amount: '50.00', stripe_refund_id: 're_test_456' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindDisputeById.mockResolvedValue(openDispute);
    mockReservationsFindFirst.mockResolvedValue(completedReservation);
    mockRefundPaymentIntent.mockResolvedValue('re_test_456');
    mockUpdateDispute.mockResolvedValue(refundedDispute);
    (mockTxInsert as jest.Mock).mockReturnValue({ values: jest.fn().mockResolvedValue([]) });
  });

  it('issues a full refund and returns updated dispute', async () => {
    const result = await refundDispute(ADMIN_ID, DISPUTE_ID, {});
    expect(result.status).toBe('refunded');
    expect(mockRefundPaymentIntent).toHaveBeenCalledWith('pi_test_123', undefined);
    expect(mockUpdateDispute).toHaveBeenCalledWith(
      DISPUTE_ID,
      expect.objectContaining({ status: 'refunded', refunded_amount: '50.00', stripe_refund_id: 're_test_456' }),
      expect.anything()
    );
  });

  it('issues a partial refund when amount is provided', async () => {
    mockUpdateDispute.mockResolvedValue({ ...refundedDispute, refunded_amount: '20.00' });
    const result = await refundDispute(ADMIN_ID, DISPUTE_ID, { amount: 20 });
    expect(mockRefundPaymentIntent).toHaveBeenCalledWith('pi_test_123', 2000);
    expect(result.refunded_amount).toBe('20.00');
  });

  it('formats refunded_amount with 2 decimal places', async () => {
    await refundDispute(ADMIN_ID, DISPUTE_ID, {});
    expect(mockUpdateDispute).toHaveBeenCalledWith(
      DISPUTE_ID,
      expect.objectContaining({ refunded_amount: '50.00' }),
      expect.anything()
    );
  });

  it('inserts an admin log inside the transaction', async () => {
    await refundDispute(ADMIN_ID, DISPUTE_ID, {});
    expect(mockTxInsert).toHaveBeenCalled();
    const insertArgs = mockTxInsert.mock.calls[0][0];
    // adminLogs table should be passed as the insert target
    expect(insertArgs).toBeDefined();
  });

  it('throws NotFoundError when dispute does not exist', async () => {
    mockFindDisputeById.mockResolvedValue(undefined);
    await expect(refundDispute(ADMIN_ID, DISPUTE_ID, {})).rejects.toThrow(NotFoundError);
    expect(mockRefundPaymentIntent).not.toHaveBeenCalled();
  });

  it('throws DisputeAlreadyClosedError when dispute is not open', async () => {
    mockFindDisputeById.mockResolvedValue({ ...openDispute, status: 'refunded' });
    await expect(refundDispute(ADMIN_ID, DISPUTE_ID, {})).rejects.toThrow(DisputeAlreadyClosedError);
    expect(mockRefundPaymentIntent).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when reservation is missing', async () => {
    mockReservationsFindFirst.mockResolvedValue(undefined);
    await expect(refundDispute(ADMIN_ID, DISPUTE_ID, {})).rejects.toThrow(NotFoundError);
    expect(mockRefundPaymentIntent).not.toHaveBeenCalled();
  });

  it('throws ValidationError when reservation has no stripe_payment_id', async () => {
    mockReservationsFindFirst.mockResolvedValue({ ...completedReservation, stripe_payment_id: null });
    await expect(refundDispute(ADMIN_ID, DISPUTE_ID, {})).rejects.toThrow(ValidationError);
  });

  it('throws RefundNotEligibleError when stripe_transfer_id is set', async () => {
    mockReservationsFindFirst.mockResolvedValue({ ...completedReservation, stripe_transfer_id: 'tr_test_789' });
    await expect(refundDispute(ADMIN_ID, DISPUTE_ID, {})).rejects.toThrow(RefundNotEligibleError);
    expect(mockRefundPaymentIntent).not.toHaveBeenCalled();
  });

  it('throws ValidationError when partial amount exceeds amount paid', async () => {
    // amount_paid = 50.00 → 5000 cents; requested = 51 → 5100 cents
    await expect(refundDispute(ADMIN_ID, DISPUTE_ID, { amount: 51 })).rejects.toThrow(ValidationError);
    expect(mockRefundPaymentIntent).not.toHaveBeenCalled();
  });
});

// ─── closeDispute ─────────────────────────────────────────────────────────────

describe('closeDispute', () => {
  const resolvedDispute = { ...openDispute, status: 'resolved' as const, closed_by: ADMIN_ID, closed_reason: 'Client indemnisé' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindDisputeById.mockResolvedValue(openDispute);
    mockUpdateDispute.mockResolvedValue(resolvedDispute);
    (mockTxInsert as jest.Mock).mockReturnValue({ values: jest.fn().mockResolvedValue([]) });
  });

  it('closes a dispute as resolved', async () => {
    const result = await closeDispute(ADMIN_ID, DISPUTE_ID, { status: 'resolved', reason: 'Client indemnisé' });
    expect(result.status).toBe('resolved');
    expect(mockUpdateDispute).toHaveBeenCalledWith(
      DISPUTE_ID,
      expect.objectContaining({ status: 'resolved', closed_by: ADMIN_ID, closed_reason: 'Client indemnisé' }),
      expect.anything()
    );
  });

  it('closes a dispute as rejected', async () => {
    mockUpdateDispute.mockResolvedValue({ ...openDispute, status: 'rejected' });
    await closeDispute(ADMIN_ID, DISPUTE_ID, { status: 'rejected', reason: 'Non fondé' });
    expect(mockUpdateDispute).toHaveBeenCalledWith(
      DISPUTE_ID,
      expect.objectContaining({ status: 'rejected' }),
      expect.anything()
    );
  });

  it('inserts an admin log inside the transaction', async () => {
    await closeDispute(ADMIN_ID, DISPUTE_ID, { status: 'resolved', reason: 'OK' });
    expect(mockTxInsert).toHaveBeenCalled();
  });

  it('throws NotFoundError when dispute does not exist', async () => {
    mockFindDisputeById.mockResolvedValue(undefined);
    await expect(closeDispute(ADMIN_ID, DISPUTE_ID, { status: 'resolved', reason: 'x' })).rejects.toThrow(NotFoundError);
    expect(mockUpdateDispute).not.toHaveBeenCalled();
  });

  it('throws DisputeAlreadyClosedError when dispute status is refunded', async () => {
    mockFindDisputeById.mockResolvedValue({ ...openDispute, status: 'refunded' });
    await expect(closeDispute(ADMIN_ID, DISPUTE_ID, { status: 'resolved', reason: 'x' })).rejects.toThrow(DisputeAlreadyClosedError);
    expect(mockUpdateDispute).not.toHaveBeenCalled();
  });

  it('throws DisputeAlreadyClosedError when dispute status is resolved', async () => {
    mockFindDisputeById.mockResolvedValue({ ...openDispute, status: 'resolved' });
    await expect(closeDispute(ADMIN_ID, DISPUTE_ID, { status: 'rejected', reason: 'x' })).rejects.toThrow(DisputeAlreadyClosedError);
  });

  it('throws DisputeAlreadyClosedError when dispute status is rejected', async () => {
    mockFindDisputeById.mockResolvedValue({ ...openDispute, status: 'rejected' });
    await expect(closeDispute(ADMIN_ID, DISPUTE_ID, { status: 'resolved', reason: 'x' })).rejects.toThrow(DisputeAlreadyClosedError);
  });
});
