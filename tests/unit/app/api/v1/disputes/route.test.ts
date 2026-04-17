/**
 * Unit tests for POST /api/v1/disputes.
 * @jest-environment node
 */

const mockRequireRole = jest.fn();
const mockCreateDispute = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/server/disputes/dispute-service', () => ({
  createDispute: (...args: unknown[]) => mockCreateDispute(...args),
}));

import { POST } from '@/app/api/v1/disputes/route';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  DisputeAlreadyExistsError,
} from '@/lib/errors';

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const createdDispute = {
  id: 'dispute-uuid-1',
  reservation_id: VALID_UUID,
  client_id: 'client-1',
  station_id: 'station-1',
  reason: 'Rayure',
  status: 'open',
  created_at: new Date().toISOString(),
};

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/v1/disputes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/disputes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue({ sub: 'client-1', role: 'client' });
    mockCreateDispute.mockResolvedValue(createdDispute);
  });

  // --- Happy path ---

  it('returns 201 and the created dispute on success', async () => {
    const req = makeRequest({ reservation_id: VALID_UUID, reason: 'Rayure sur le capot' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.id).toBe('dispute-uuid-1');
    expect(body.data.status).toBe('open');
    expect(body.message).toBe('Dispute created successfully');
    expect(mockCreateDispute).toHaveBeenCalledWith('client-1', expect.objectContaining({ reservation_id: VALID_UUID }));
  });

  // --- Auth ---

  it('returns auth response when requireRole fails (401)', async () => {
    mockRequireRole.mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    const res = await POST(makeRequest({ reservation_id: VALID_UUID, reason: 'x' }));
    expect(res.status).toBe(401);
    expect(mockCreateDispute).not.toHaveBeenCalled();
  });

  // --- Validation ---

  it('returns 400 when body is not valid JSON', async () => {
    const req = new Request('http://localhost/api/v1/disputes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockCreateDispute).not.toHaveBeenCalled();
  });

  it('returns 400 when reservation_id is missing', async () => {
    const res = await POST(makeRequest({ reason: 'Rayure' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.errors).toEqual(expect.any(Array));
  });

  it('returns 400 when reservation_id is not a UUID', async () => {
    const res = await POST(makeRequest({ reservation_id: 'not-a-uuid', reason: 'x' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when reason is empty', async () => {
    const res = await POST(makeRequest({ reservation_id: VALID_UUID, reason: '' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  // --- Service errors ---

  it('returns 404 when reservation is not found', async () => {
    mockCreateDispute.mockRejectedValue(new NotFoundError('Reservation not found'));
    const res = await POST(makeRequest({ reservation_id: VALID_UUID, reason: 'x' }));
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
  });

  it('returns 403 when reservation belongs to another user', async () => {
    mockCreateDispute.mockRejectedValue(new ForbiddenError('This reservation does not belong to you'));
    const res = await POST(makeRequest({ reservation_id: VALID_UUID, reason: 'x' }));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
  });

  it('returns 400 when reservation is not completed', async () => {
    mockCreateDispute.mockRejectedValue(new ValidationError('Disputes can only be opened for completed reservations'));
    const res = await POST(makeRequest({ reservation_id: VALID_UUID, reason: 'x' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when the 30-day dispute window has expired', async () => {
    mockCreateDispute.mockRejectedValue(new ValidationError('Disputes must be opened within 30 days of reservation completion'));
    const res = await POST(makeRequest({ reservation_id: VALID_UUID, reason: 'x' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 409 DISPUTE_ALREADY_EXISTS when dispute already exists', async () => {
    mockCreateDispute.mockRejectedValue(new DisputeAlreadyExistsError());
    const res = await POST(makeRequest({ reservation_id: VALID_UUID, reason: 'x' }));
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe('DISPUTE_ALREADY_EXISTS');
  });

  it('returns 500 on unexpected error', async () => {
    mockCreateDispute.mockRejectedValue(new Error('DB connection lost'));
    const res = await POST(makeRequest({ reservation_id: VALID_UUID, reason: 'x' }));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});
