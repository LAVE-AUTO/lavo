/**
 * Unit tests for POST /api/v1/admin/disputes/:id/refund.
 * @jest-environment node
 */

const mockRequireRole = jest.fn();
const mockRefundDispute = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/server/disputes/dispute-service', () => ({
  refundDispute: (...args: unknown[]) => mockRefundDispute(...args),
}));

import { POST } from '@/app/api/v1/admin/disputes/[id]/refund/route';
import {
  NotFoundError,
  DisputeAlreadyClosedError,
  RefundNotEligibleError,
  ValidationError,
} from '@/lib/errors';

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const refundedDispute = {
  id: VALID_UUID,
  reservation_id: 'res-uuid-1',
  client_id: 'client-1',
  station_id: 'station-1',
  reason: 'Rayure',
  status: 'refunded',
  refunded_amount: '50.00',
  stripe_refund_id: 're_test_456',
  created_at: new Date().toISOString(),
};

function makeRequest(body: unknown = {}): Request {
  return new Request('http://localhost/api/v1/admin/disputes/some-id/refund', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeParams(id: string = VALID_UUID) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/v1/admin/disputes/:id/refund', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue({ sub: 'admin-1', role: 'admin' });
    mockRefundDispute.mockResolvedValue(refundedDispute);
  });

  // --- Happy path ---

  it('returns 200 and refunded dispute on full refund success', async () => {
    const res = await POST(makeRequest({}), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.status).toBe('refunded');
    expect(body.data.stripe_refund_id).toBe('re_test_456');
    expect(body.message).toBe('Dispute refunded successfully');
    expect(mockRefundDispute).toHaveBeenCalledWith('admin-1', VALID_UUID, expect.objectContaining({}));
  });

  it('returns 200 on partial refund with amount', async () => {
    mockRefundDispute.mockResolvedValue({ ...refundedDispute, refunded_amount: '20.00' });
    const res = await POST(makeRequest({ amount: 20 }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.refunded_amount).toBe('20.00');
    expect(mockRefundDispute).toHaveBeenCalledWith(
      'admin-1',
      VALID_UUID,
      expect.objectContaining({ amount: 20 })
    );
  });

  it('treats missing/invalid JSON body as empty object (full refund)', async () => {
    const req = new Request('http://localhost/api/v1/admin/disputes/some-id/refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req, makeParams());
    const body = await res.json();

    // Invalid JSON falls back to {} which is a valid full-refund body
    expect(res.status).toBe(200);
    expect(mockRefundDispute).toHaveBeenCalled();
  });

  // --- Auth ---

  it('returns auth response when requireRole fails (401)', async () => {
    mockRequireRole.mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(401);
    expect(mockRefundDispute).not.toHaveBeenCalled();
  });

  // --- Param validation ---

  it('returns 400 VALIDATION_FAILED for invalid dispute ID format', async () => {
    const res = await POST(makeRequest(), makeParams('not-a-uuid'));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockRefundDispute).not.toHaveBeenCalled();
  });

  // --- Body validation ---

  it('returns 400 VALIDATION_FAILED when amount is zero', async () => {
    const res = await POST(makeRequest({ amount: 0 }), makeParams());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockRefundDispute).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_FAILED when amount is negative', async () => {
    const res = await POST(makeRequest({ amount: -10 }), makeParams());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  // --- Service errors ---

  it('returns 404 when dispute is not found', async () => {
    mockRefundDispute.mockRejectedValue(new NotFoundError('Dispute not found'));
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
  });

  it('returns 409 DISPUTE_ALREADY_CLOSED when dispute is not open', async () => {
    mockRefundDispute.mockRejectedValue(new DisputeAlreadyClosedError());
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe('DISPUTE_ALREADY_CLOSED');
  });

  it('returns 400 REFUND_NOT_ELIGIBLE when stripe_transfer_id is set', async () => {
    mockRefundDispute.mockRejectedValue(new RefundNotEligibleError('Transfer already made'));
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('REFUND_NOT_ELIGIBLE');
  });

  it('returns 400 VALIDATION_FAILED when partial amount exceeds amount paid', async () => {
    mockRefundDispute.mockRejectedValue(new ValidationError('Amount exceeds reservation amount paid'));
    const res = await POST(makeRequest({ amount: 999 }), makeParams());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 500 on unexpected error', async () => {
    mockRefundDispute.mockRejectedValue(new Error('Stripe network error'));
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});
