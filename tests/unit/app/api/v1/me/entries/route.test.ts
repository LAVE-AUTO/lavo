/**
 * API tests for GET /api/v1/me/entries.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockListMyEntries = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/reservations/reservation-service', () => ({
  listMyEntries: (...args: unknown[]) => mockListMyEntries(...args),
}));

import { GET } from '@/app/api/v1/me/entries/route';

const userAuth = { sub: 'user-1', role: 'user' };

describe('GET /api/v1/me/entries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(userAuth);
    mockListMyEntries.mockResolvedValue([
      {
        id: 'entry-1',
        entry_type: 'reservation',
        time_slot_id: 'slot-1',
        station_id: 'station-1',
        vehicle_format_id: 'format-1',
        status: 'pending',
        queue_position: null,
        amount_paid: '12.00',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  });

  it('returns 200 with entries when authenticated as user', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data[0].entry_type).toBe('reservation');
    expect(mockListMyEntries).toHaveBeenCalledWith(userAuth.sub);
  });

  it('returns 401 when auth fails', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    mockRequireRole.mockResolvedValueOnce(errRes);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockListMyEntries).not.toHaveBeenCalled();
  });

  it('returns 403 when role is not user', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 });
    mockRequireRole.mockResolvedValueOnce(errRes);
    const res = await GET();
    expect(res.status).toBe(403);
    expect(mockListMyEntries).not.toHaveBeenCalled();
  });
});
