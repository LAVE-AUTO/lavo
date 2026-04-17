/**
 * API tests for POST /api/v1/stations/:id/reservations.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockFindStationById = jest.fn();
const mockCreateReservation = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/station/station-repository', () => ({
  findStationById: (...args: unknown[]) => mockFindStationById(...args),
}));
jest.mock('@/server/reservations/reservation-service', () => ({
  createReservation: (...args: unknown[]) => mockCreateReservation(...args),
}));

import { POST } from '@/app/api/v1/stations/[id]/reservations/route';
import { NotFoundError, ConflictError, ValidationError } from '@/lib/errors';

const userAuth = { sub: 'user-1', role: 'user' };
const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const slotId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const formatId = 'c3d4e5f6-a7b8-9012-cdef-234567890123';

function buildParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe('POST /api/v1/stations/:id/reservations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(userAuth);
    mockFindStationById.mockResolvedValue({
      id: stationId,
      status: 'active',
      stripe_account_id: 'acct_test_123',
    });
    mockCreateReservation.mockResolvedValue({
      entry: {
        id: 'entry-1',
        entry_type: 'reservation',
        time_slot_id: slotId,
        station_id: stationId,
        vehicle_format_id: formatId,
        status: 'pending',
        queue_position: null,
        amount_paid: '12.00',
        created_at: new Date(),
        updated_at: new Date(),
      },
      clientSecret: 'pi_test_secret',
    });
  });

  it('returns 201 with entry when valid body and station active', async () => {
    const req = new Request('http://localhost/api/v1/stations/1/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        time_slot_id: slotId,
        vehicle_format_id: formatId,
      }),
    });
    const res = await POST(req, { params: buildParams(stationId) });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data.entry_type).toBe('reservation');
    expect(data.data.time_slot_id).toBe(slotId);
    expect(mockCreateReservation).toHaveBeenCalledWith(
      userAuth.sub,
      stationId,
      'acct_test_123',
      slotId,
      formatId,
      {
        qrToken: undefined,
        qrVersion: undefined,
      }
    );
  });

  it('returns 400 for invalid station uuid', async () => {
    const req = new Request('http://localhost/api/v1/stations/x/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time_slot_id: slotId, vehicle_format_id: formatId }),
    });
    const res = await POST(req, { params: buildParams('not-a-uuid') });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockCreateReservation).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/v1/stations/1/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req, { params: buildParams(stationId) });
    expect(res.status).toBe(400);
    expect(mockCreateReservation).not.toHaveBeenCalled();
  });

  it('returns 400 for missing time_slot_id in body', async () => {
    const req = new Request('http://localhost/api/v1/stations/1/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicle_format_id: formatId }),
    });
    const res = await POST(req, { params: buildParams(stationId) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockCreateReservation).not.toHaveBeenCalled();
  });

  it('returns 401 when auth fails', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    mockRequireRole.mockResolvedValueOnce(errRes);
    const req = new Request('http://localhost/api/v1/stations/1/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time_slot_id: slotId, vehicle_format_id: formatId }),
    });
    const res = await POST(req, { params: buildParams(stationId) });
    expect(res.status).toBe(401);
    expect(mockCreateReservation).not.toHaveBeenCalled();
  });

  it('returns 403 when role is not user', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 });
    mockRequireRole.mockResolvedValueOnce(errRes);
    const req = new Request('http://localhost/api/v1/stations/1/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time_slot_id: slotId, vehicle_format_id: formatId }),
    });
    const res = await POST(req, { params: buildParams(stationId) });
    expect(res.status).toBe(403);
    expect(mockCreateReservation).not.toHaveBeenCalled();
  });

  it('returns 404 when station not found or not active', async () => {
    mockFindStationById.mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/v1/stations/1/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time_slot_id: slotId, vehicle_format_id: formatId }),
    });
    const res = await POST(req, { params: buildParams(stationId) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toMatch(/station not found/i);
    expect(mockCreateReservation).not.toHaveBeenCalled();
  });

  it('returns 404 when createReservation throws NotFoundError', async () => {
    mockCreateReservation.mockRejectedValueOnce(new NotFoundError('Time slot not found'));
    const req = new Request('http://localhost/api/v1/stations/1/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time_slot_id: slotId, vehicle_format_id: formatId }),
    });
    const res = await POST(req, { params: buildParams(stationId) });
    expect(res.status).toBe(404);
    expect((await res.json()).message).toBe('Time slot not found');
  });

  it('returns 409 when createReservation throws ConflictError', async () => {
    mockCreateReservation.mockRejectedValueOnce(new ConflictError('Slot is full'));
    const req = new Request('http://localhost/api/v1/stations/1/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time_slot_id: slotId, vehicle_format_id: formatId }),
    });
    const res = await POST(req, { params: buildParams(stationId) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toBe('Slot is full');
    expect(body.code).toBe('CONFLICT');
  });

  it('returns 400/VALIDATION_FAILED when createReservation throws ValidationError', async () => {
    mockCreateReservation.mockRejectedValueOnce(new ValidationError('Invalid QR booking token context'));
    const req = new Request('http://localhost/api/v1/stations/1/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time_slot_id: slotId, vehicle_format_id: formatId }),
    });
    const res = await POST(req, { params: buildParams(stationId) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe('Invalid QR booking token context');
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 404 when station exists but status is not active', async () => {
    mockFindStationById.mockResolvedValueOnce({ id: stationId, status: 'pending' });
    const req = new Request('http://localhost/api/v1/stations/1/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time_slot_id: slotId, vehicle_format_id: formatId }),
    });
    const res = await POST(req, { params: buildParams(stationId) });
    expect(res.status).toBe(404);
    expect(mockCreateReservation).not.toHaveBeenCalled();
  });

  it('passes qr_token and version to service when payload is valid', async () => {
    const qrToken = 'a'.repeat(64);
    const req = new Request('http://localhost/api/v1/stations/1/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        time_slot_id: slotId,
        vehicle_format_id: formatId,
        qr_token: qrToken,
        v: '1',
      }),
    });

    const res = await POST(req, { params: buildParams(stationId) });

    expect(res.status).toBe(201);
    expect(mockCreateReservation).toHaveBeenCalledWith(
      userAuth.sub,
      stationId,
      'acct_test_123',
      slotId,
      formatId,
      { qrToken, qrVersion: '1' }
    );
  });

  it('returns 400 when qr_token is sent without version (bypass attempt)', async () => {
    const req = new Request('http://localhost/api/v1/stations/1/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        time_slot_id: slotId,
        vehicle_format_id: formatId,
        qr_token: 'a'.repeat(64),
      }),
    });

    const res = await POST(req, { params: buildParams(stationId) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(JSON.stringify(body.errors ?? body.details)).toContain('qr_token and v must be provided together');
    expect(mockCreateReservation).not.toHaveBeenCalled();
  });

  it('returns 400 when version is sent without qr_token (bypass attempt)', async () => {
    const req = new Request('http://localhost/api/v1/stations/1/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        time_slot_id: slotId,
        vehicle_format_id: formatId,
        v: '1',
      }),
    });

    const res = await POST(req, { params: buildParams(stationId) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(JSON.stringify(body.errors ?? body.details)).toContain('qr_token and v must be provided together');
    expect(mockCreateReservation).not.toHaveBeenCalled();
  });

  it('returns 400 when version is invalid', async () => {
    const req = new Request('http://localhost/api/v1/stations/1/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        time_slot_id: slotId,
        vehicle_format_id: formatId,
        qr_token: 'a'.repeat(64),
        v: '2',
      }),
    });

    const res = await POST(req, { params: buildParams(stationId) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(JSON.stringify(body.errors ?? body.details)).toContain('v must be \\\"1\\\"');
    expect(mockCreateReservation).not.toHaveBeenCalled();
  });
});
