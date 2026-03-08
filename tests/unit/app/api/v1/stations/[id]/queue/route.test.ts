/**
 * API tests for GET /api/v1/stations/:id/queue.
 * @jest-environment node
 */
const mockFindStationById = jest.fn();
const mockListQueue = jest.fn();

jest.mock('@/server/station/station-repository', () => ({
  findStationById: (...args: unknown[]) => mockFindStationById(...args),
}));
jest.mock('@/server/reservations/queue-service', () => ({
  listQueue: (...args: unknown[]) => mockListQueue(...args),
}));

import { GET } from '@/app/api/v1/stations/[id]/queue/route';
import { NotFoundError } from '@/lib/errors';

const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function buildParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe('GET /api/v1/stations/:id/queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindStationById.mockResolvedValue({ id: stationId, status: 'active' });
    mockListQueue.mockResolvedValue([
      {
        id: 'entry-1',
        entry_type: 'queue',
        station_id: stationId,
        vehicle_format_id: 'format-1',
        status: 'pending',
        queue_position: 1,
        amount_paid: '15.00',
        created_at: new Date(),
      },
    ]);
  });

  it('returns 200 with queue entries when station active', async () => {
    const req = new Request('http://localhost/api/v1/stations/1/queue');
    const res = await GET(req, { params: buildParams(stationId) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data[0].entry_type).toBe('queue');
    expect(data.data[0].queue_position).toBe(1);
    expect(mockListQueue).toHaveBeenCalledWith(stationId);
  });

  it('returns 400 for invalid station uuid', async () => {
    const req = new Request('http://localhost/api/v1/stations/x/queue');
    const res = await GET(req, { params: buildParams('not-a-uuid') });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockListQueue).not.toHaveBeenCalled();
  });

  it('returns 404 when station not found or not active', async () => {
    mockFindStationById.mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/v1/stations/1/queue');
    const res = await GET(req, { params: buildParams(stationId) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toMatch(/station not found/i);
    expect(mockListQueue).not.toHaveBeenCalled();
  });

  it('returns 404 when listQueue throws NotFoundError', async () => {
    mockListQueue.mockRejectedValueOnce(new NotFoundError('Station not found'));
    const req = new Request('http://localhost/api/v1/stations/1/queue');
    const res = await GET(req, { params: buildParams(stationId) });
    expect(res.status).toBe(404);
    expect((await res.json()).message).toBe('Station not found');
  });
});
