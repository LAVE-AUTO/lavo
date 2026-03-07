/**
 * API tests for POST /api/v1/station/formats.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockCreateFormat = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/station/format-service', () => ({
  createFormat: (...args: unknown[]) => mockCreateFormat(...args),
}));

import { POST } from '@/app/api/v1/station/formats/route';
import { NotFoundError } from '@/lib/errors';

const auth = { sub: 'user-id', role: 'station' };
const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const formatId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

describe('POST /api/v1/station/formats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(auth);
  });

  it('returns 201 with created format', async () => {
    const created = {
      id: formatId,
      station_id: stationId,
      label: 'Moyen',
      price: '15.00',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockCreateFormat.mockResolvedValue(created);

    const req = new Request('http://localhost/api/v1/station/formats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Moyen', price: 15 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.label).toBe('Moyen');
    expect(body.data.price).toBe('15.00');
    expect(mockCreateFormat).toHaveBeenCalledWith(auth.sub, {
      label: 'Moyen',
      price: 15,
      is_active: true,
    });
  });

  it('accepts is_active false in body', async () => {
    mockCreateFormat.mockResolvedValue({ id: formatId, is_active: false } as any);
    const req = new Request('http://localhost/api/v1/station/formats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'X', price: 10, is_active: false }),
    });
    await POST(req);
    expect(mockCreateFormat).toHaveBeenCalledWith(auth.sub, {
      label: 'X',
      price: 10,
      is_active: false,
    });
  });

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api/v1/station/formats', {
      method: 'POST',
      body: 'not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockCreateFormat).not.toHaveBeenCalled();
  });

  it('returns 400 for validation failure (missing label)', async () => {
    const req = new Request('http://localhost/api/v1/station/formats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: 15 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockCreateFormat).not.toHaveBeenCalled();
  });

  it('returns 400 for price <= 0', async () => {
    const req = new Request('http://localhost/api/v1/station/formats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'X', price: 0 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockCreateFormat).not.toHaveBeenCalled();
  });

  it('returns 400 for empty label', async () => {
    const req = new Request('http://localhost/api/v1/station/formats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '', price: 10 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockCreateFormat).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const req = new Request('http://localhost/api/v1/station/formats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'X', price: 10 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(mockCreateFormat).not.toHaveBeenCalled();
  });

  it('returns 404 when no station for user', async () => {
    mockCreateFormat.mockRejectedValue(new NotFoundError('No station associated with this account'));
    const req = new Request('http://localhost/api/v1/station/formats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'X', price: 10 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});
