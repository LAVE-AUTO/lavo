/**
 * API tests for DELETE /api/v1/station/slots/:id.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockFindStationByUserId = jest.fn();
const mockDeleteSlot = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/station/station-repository', () => ({
  findStationByUserId: (...args: unknown[]) => mockFindStationByUserId(...args),
}));
jest.mock('@/server/station/slot-service', () => ({
  deleteSlot: (...args: unknown[]) => mockDeleteSlot(...args),
}));

import { DELETE } from '@/app/api/v1/station/slots/[id]/route';
import { NotFoundError, ConflictError } from '@/lib/errors';

const auth = { sub: 'user-id', role: 'station' };
const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const slotId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

describe('DELETE /api/v1/station/slots/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(auth);
    mockFindStationByUserId.mockResolvedValue({ id: stationId });
    mockDeleteSlot.mockResolvedValue(undefined);
  });

  it('returns 200 with deleted true when slot deleted', async () => {
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: slotId }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.deleted).toBe(true);
    expect(mockDeleteSlot).toHaveBeenCalledWith(stationId, slotId);
  });

  it('returns 400 when id is not a valid UUID', async () => {
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    });
    expect(res.status).toBe(400);
    expect(mockDeleteSlot).not.toHaveBeenCalled();
  });

  it('returns 404 when slot not found or wrong station', async () => {
    mockDeleteSlot.mockRejectedValueOnce(new NotFoundError('Slot not found or does not belong to this station'));
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: slotId }),
    });
    expect(res.status).toBe(404);
    expect(mockDeleteSlot).toHaveBeenCalledWith(stationId, slotId);
  });

  it('returns 409 when slot has reservations', async () => {
    mockDeleteSlot.mockRejectedValueOnce(new ConflictError('Cannot delete slot that has reservations'));
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: slotId }),
    });
    expect(res.status).toBe(409);
    expect(mockDeleteSlot).toHaveBeenCalledWith(stationId, slotId);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: slotId }),
    });
    expect(res.status).toBe(401);
    expect(mockDeleteSlot).not.toHaveBeenCalled();
  });

  it('returns 404 when no station for user', async () => {
    mockFindStationByUserId.mockResolvedValueOnce(undefined);
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: slotId }),
    });
    expect(res.status).toBe(404);
    expect(mockDeleteSlot).not.toHaveBeenCalled();
  });
});
