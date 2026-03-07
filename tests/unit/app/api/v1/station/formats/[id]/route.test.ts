/**
 * API tests for PUT, PATCH, DELETE /api/v1/station/formats/:id.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockUpdateFormat = jest.fn();
const mockDeleteFormat = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/station/format-service', () => ({
  updateFormat: (...args: unknown[]) => mockUpdateFormat(...args),
  deleteFormat: (...args: unknown[]) => mockDeleteFormat(...args),
}));

import { PUT, PATCH, DELETE } from '@/app/api/v1/station/formats/[id]/route';
import { NotFoundError, ConflictError } from '@/lib/errors';

const auth = { sub: 'user-id', role: 'station' };
const formatId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

describe('PUT /api/v1/station/formats/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(auth);
  });

  it('returns 200 with updated format', async () => {
    const updated = {
      id: formatId,
      station_id: 'station-id',
      label: 'SUV',
      price: '30.00',
      is_active: false,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockUpdateFormat.mockResolvedValue(updated);

    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'SUV', price: 30, is_active: false }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: formatId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.label).toBe('SUV');
    expect(mockUpdateFormat).toHaveBeenCalledWith(auth.sub, formatId, expect.any(Object), false);
  });

  it('returns 400 when id is not UUID', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'X', price: 10, is_active: true }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: 'not-uuid' }) });
    expect(res.status).toBe(400);
    expect(mockUpdateFormat).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: 'not json',
    });
    const res = await PUT(req, { params: Promise.resolve({ id: formatId }) });
    expect(res.status).toBe(400);
    expect(mockUpdateFormat).not.toHaveBeenCalled();
  });

  it('returns 404 when format not found', async () => {
    mockUpdateFormat.mockRejectedValue(new NotFoundError('Format not found'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'X', price: 10, is_active: true }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: formatId }) });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid body (price <= 0)', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'X', price: 0, is_active: true }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: formatId }) });
    expect(res.status).toBe(400);
    expect(mockUpdateFormat).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid body (empty label)', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '', price: 10, is_active: true }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: formatId }) });
    expect(res.status).toBe(400);
    expect(mockUpdateFormat).not.toHaveBeenCalled();
  });

  it('returns 403 when station not approved', async () => {
    mockRequireRole.mockResolvedValueOnce(new Response(null, { status: 403 }));
    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'X', price: 10, is_active: true }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: formatId }) });
    expect(res.status).toBe(403);
    expect(mockUpdateFormat).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/v1/station/formats/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(auth);
  });

  it('returns 200 with updated format (partial)', async () => {
    mockUpdateFormat.mockResolvedValue({ id: formatId, price: '20.00' } as any);
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: 20 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: formatId }) });
    expect(res.status).toBe(200);
    expect(mockUpdateFormat).toHaveBeenCalledWith(auth.sub, formatId, { price: 20 }, true);
  });

  it('returns 400 when no fields provided', async () => {
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: formatId }) });
    expect(res.status).toBe(400);
    expect(mockUpdateFormat).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: 'not json',
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: formatId }) });
    expect(res.status).toBe(400);
    expect(mockUpdateFormat).not.toHaveBeenCalled();
  });

  it('returns 400 when id is not UUID', async () => {
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: 20 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'not-uuid' }) });
    expect(res.status).toBe(400);
    expect(mockUpdateFormat).not.toHaveBeenCalled();
  });

  it('returns 400 when price <= 0 in body', async () => {
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: 0 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: formatId }) });
    expect(res.status).toBe(400);
    expect(mockUpdateFormat).not.toHaveBeenCalled();
  });

  it('returns 404 when format not found', async () => {
    mockUpdateFormat.mockRejectedValue(new NotFoundError('Format not found'));
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: 20 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: formatId }) });
    expect(res.status).toBe(404);
  });

  it('returns 403 when station not approved', async () => {
    mockRequireRole.mockResolvedValueOnce(new Response(null, { status: 403 }));
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: 20 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: formatId }) });
    expect(res.status).toBe(403);
    expect(mockUpdateFormat).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/v1/station/formats/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(auth);
    mockDeleteFormat.mockResolvedValue(undefined);
  });

  it('returns 200 with deleted true', async () => {
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: formatId }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deleted).toBe(true);
    expect(mockDeleteFormat).toHaveBeenCalledWith(auth.sub, formatId);
  });

  it('returns 409 when format has reservations', async () => {
    mockDeleteFormat.mockRejectedValue(
      new ConflictError('Cannot delete format that has reservations')
    );
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: formatId }),
    });
    expect(res.status).toBe(409);
    expect(mockDeleteFormat).toHaveBeenCalledWith(auth.sub, formatId);
  });

  it('returns 404 when format not found', async () => {
    mockDeleteFormat.mockRejectedValue(new NotFoundError('Format not found'));
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: formatId }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: formatId }),
    });
    expect(res.status).toBe(401);
    expect(mockDeleteFormat).not.toHaveBeenCalled();
  });

  it('returns 400 when id is not UUID', async () => {
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'not-uuid' }),
    });
    expect(res.status).toBe(400);
    expect(mockDeleteFormat).not.toHaveBeenCalled();
  });

  it('returns 403 when station not approved', async () => {
    mockRequireRole.mockResolvedValueOnce(new Response(null, { status: 403 }));
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: formatId }),
    });
    expect(res.status).toBe(403);
    expect(mockDeleteFormat).not.toHaveBeenCalled();
  });
});
