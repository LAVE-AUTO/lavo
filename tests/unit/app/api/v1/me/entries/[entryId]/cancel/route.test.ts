/**
 * API tests for PATCH /api/v1/me/entries/:entryId/cancel.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockCancelEntry = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/reservations/reservation-service', () => ({
  cancelEntry: (...args: unknown[]) => mockCancelEntry(...args),
}));

import { PATCH } from '@/app/api/v1/me/entries/[entryId]/cancel/route';
import { NotFoundError, ConflictError } from '@/lib/errors';

const userAuth = { sub: 'user-1', role: 'user' };
const entryId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function buildParams(id: string): Promise<{ entryId: string }> {
  return Promise.resolve({ entryId: id });
}

describe('PATCH /api/v1/me/entries/:entryId/cancel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(userAuth);
    mockCancelEntry.mockResolvedValue({
      id: entryId,
      entry_type: 'reservation',
      time_slot_id: 'slot-1',
      station_id: 'station-1',
      vehicle_format_id: 'format-1',
      status: 'cancelled',
      queue_position: null,
      amount_paid: '12.00',
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  it('returns 200 with cancelled entry when valid entryId and own entry', async () => {
    const req = new Request('http://localhost/api/v1/me/entries/1/cancel', { method: 'PATCH' });
    const res = await PATCH(req, { params: buildParams(entryId) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.entry.status).toBe('cancelled');
    expect(mockCancelEntry).toHaveBeenCalledWith(entryId, userAuth.sub);
  });

  it('returns 400 for invalid entryId (non-UUID)', async () => {
    const req = new Request('http://localhost/api/v1/me/entries/1/cancel', { method: 'PATCH' });
    const res = await PATCH(req, { params: buildParams('not-a-uuid') });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockCancelEntry).not.toHaveBeenCalled();
  });

  it('returns 401 when auth fails', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    mockRequireRole.mockResolvedValueOnce(errRes);
    const req = new Request('http://localhost/api/v1/me/entries/1/cancel', { method: 'PATCH' });
    const res = await PATCH(req, { params: buildParams(entryId) });
    expect(res.status).toBe(401);
    expect(mockCancelEntry).not.toHaveBeenCalled();
  });

  it('returns 403 when role is not user', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 });
    mockRequireRole.mockResolvedValueOnce(errRes);
    const req = new Request('http://localhost/api/v1/me/entries/1/cancel', { method: 'PATCH' });
    const res = await PATCH(req, { params: buildParams(entryId) });
    expect(res.status).toBe(403);
    expect(mockCancelEntry).not.toHaveBeenCalled();
  });

  it('returns 404 when entry not found (wrong user cancelling another user entry)', async () => {
    mockCancelEntry.mockRejectedValueOnce(new NotFoundError('Entry not found'));
    const req = new Request('http://localhost/api/v1/me/entries/1/cancel', { method: 'PATCH' });
    const res = await PATCH(req, { params: buildParams(entryId) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toBe('Entry not found');
    expect(mockCancelEntry).toHaveBeenCalledWith(entryId, userAuth.sub);
  });

  it('returns 409 when entry already cancelled', async () => {
    mockCancelEntry.mockRejectedValueOnce(new ConflictError('Entry already cancelled'));
    const req = new Request('http://localhost/api/v1/me/entries/1/cancel', { method: 'PATCH' });
    const res = await PATCH(req, { params: buildParams(entryId) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toBe('Entry already cancelled');
    expect(body.code).toBe('CONFLICT');
  });
});
