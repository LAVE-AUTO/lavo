/**
 * API tests for GET /api/v1/stations/:id/formats (public).
 * @jest-environment node
 */
const mockGetFormatsByStationIdPublic = jest.fn();

jest.mock('@/server/station/format-service', () => ({
  getFormatsByStationIdPublic: (...args: unknown[]) => mockGetFormatsByStationIdPublic(...args),
}));

import { GET } from '@/app/api/v1/stations/[id]/formats/route';
import { NotFoundError } from '@/lib/errors';

const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('GET /api/v1/stations/:id/formats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with list of formats', async () => {
    const formats = [
      {
        id: 'f1',
        station_id: stationId,
        label: 'SUV',
        price: '25.00',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];
    mockGetFormatsByStationIdPublic.mockResolvedValue(formats);

    const res = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ id: stationId }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].label).toBe('SUV');
    expect(body.data[0].price).toBe('25.00');
    expect(mockGetFormatsByStationIdPublic).toHaveBeenCalledWith(stationId);
  });

  it('returns 400 when id is not a valid UUID', async () => {
    const res = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'not-uuid' }),
    });
    expect(res.status).toBe(400);
    expect(mockGetFormatsByStationIdPublic).not.toHaveBeenCalled();
  });

  it('returns 404 when station not found or not active', async () => {
    mockGetFormatsByStationIdPublic.mockRejectedValue(new NotFoundError('Station not found'));
    const res = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ id: stationId }),
    });
    expect(res.status).toBe(404);
    expect(mockGetFormatsByStationIdPublic).toHaveBeenCalledWith(stationId);
  });
});
