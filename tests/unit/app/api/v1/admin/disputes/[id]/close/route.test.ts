/**
 * Unit tests for POST /api/v1/admin/disputes/:id/close.
 * @jest-environment node
 */

const mockRequireRole = jest.fn();
const mockCloseDispute = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/server/disputes/dispute-service', () => ({
  closeDispute: (...args: unknown[]) => mockCloseDispute(...args),
}));

import { POST } from '@/app/api/v1/admin/disputes/[id]/close/route';
import { NotFoundError, DisputeAlreadyClosedError } from '@/lib/errors';

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const resolvedDispute = {
  id: VALID_UUID,
  reservation_id: 'res-uuid-1',
  client_id: 'client-1',
  station_id: 'station-1',
  reason: 'Rayure',
  status: 'resolved',
  closed_by: 'admin-1',
  closed_reason: 'Client indemnisé',
  created_at: new Date().toISOString(),
};

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/admin/disputes/some-id/close', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeParams(id: string = VALID_UUID) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/v1/admin/disputes/:id/close', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue({ sub: 'admin-1', role: 'admin' });
    mockCloseDispute.mockResolvedValue(resolvedDispute);
  });

  // --- Happy path ---

  it('returns 200 and closed dispute when resolved', async () => {
    const res = await POST(
      makeRequest({ status: 'resolved', reason: 'Client indemnisé' }),
      makeParams()
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.status).toBe('resolved');
    expect(body.message).toBe('Dispute closed successfully');
    expect(mockCloseDispute).toHaveBeenCalledWith(
      'admin-1',
      VALID_UUID,
      expect.objectContaining({ status: 'resolved', reason: 'Client indemnisé' })
    );
  });

  it('returns 200 when dispute is closed as rejected', async () => {
    mockCloseDispute.mockResolvedValue({ ...resolvedDispute, status: 'rejected', closed_reason: 'Non fondé' });
    const res = await POST(
      makeRequest({ status: 'rejected', reason: 'Non fondé' }),
      makeParams()
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.status).toBe('rejected');
    expect(mockCloseDispute).toHaveBeenCalledWith(
      'admin-1',
      VALID_UUID,
      expect.objectContaining({ status: 'rejected' })
    );
  });

  // --- Auth ---

  it('returns auth response when requireRole fails (401)', async () => {
    mockRequireRole.mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    const res = await POST(makeRequest({ status: 'resolved', reason: 'x' }), makeParams());
    expect(res.status).toBe(401);
    expect(mockCloseDispute).not.toHaveBeenCalled();
  });

  // --- Param validation ---

  it('returns 400 VALIDATION_FAILED for invalid dispute ID format', async () => {
    const res = await POST(
      makeRequest({ status: 'resolved', reason: 'x' }),
      makeParams('not-a-uuid')
    );
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockCloseDispute).not.toHaveBeenCalled();
  });

  // --- Body validation ---

  it('returns 400 VALIDATION_FAILED when body is invalid JSON', async () => {
    const req = new Request('http://localhost/api/v1/admin/disputes/some-id/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req, makeParams());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockCloseDispute).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_FAILED when status is missing', async () => {
    const res = await POST(makeRequest({ reason: 'Raison valide' }), makeParams());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.errors).toEqual(expect.any(Array));
  });

  it('returns 400 VALIDATION_FAILED when reason is missing', async () => {
    const res = await POST(makeRequest({ status: 'resolved' }), makeParams());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 VALIDATION_FAILED when status is invalid (open)', async () => {
    const res = await POST(makeRequest({ status: 'open', reason: 'x' }), makeParams());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 VALIDATION_FAILED when reason is empty', async () => {
    const res = await POST(makeRequest({ status: 'resolved', reason: '' }), makeParams());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  // --- Service errors ---

  it('returns 404 when dispute is not found', async () => {
    mockCloseDispute.mockRejectedValue(new NotFoundError('Dispute not found'));
    const res = await POST(makeRequest({ status: 'resolved', reason: 'x' }), makeParams());
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
  });

  it('returns 409 DISPUTE_ALREADY_CLOSED when dispute is already closed', async () => {
    mockCloseDispute.mockRejectedValue(new DisputeAlreadyClosedError());
    const res = await POST(makeRequest({ status: 'resolved', reason: 'x' }), makeParams());
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe('DISPUTE_ALREADY_CLOSED');
  });

  it('returns 500 on unexpected error', async () => {
    mockCloseDispute.mockRejectedValue(new Error('Unexpected failure'));
    const res = await POST(makeRequest({ status: 'resolved', reason: 'x' }), makeParams());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});
