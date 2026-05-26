/**
 * API tests for GET /api/v1/stations/:id/formats (public compatibility endpoint).
 * @jest-environment node
 */
const mockGetFormatsPaginated = jest.fn();

jest.mock('@/server/station/format-service', () => ({
  getFormatsPaginated: (...args: unknown[]) => mockGetFormatsPaginated(...args),
}));

import { GET } from '@/app/api/v1/stations/[id]/formats/route';
import { AppError } from '@/lib/errors';

const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('GET /api/v1/stations/:id/formats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with paginated formats payload', async () => {
    mockGetFormatsPaginated.mockResolvedValue({
      items: [
        {
          id: 'f1',
          label: 'SUV',
          price: '25.00',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      total: 1,
    });

    const res = await GET(new Request('http://localhost?page=1&per_page=20'), {
      params: Promise.resolve({ id: stationId }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].label).toBe('SUV');
    expect(body.data.meta.total).toBe(1);
    expect(mockGetFormatsPaginated).toHaveBeenCalledWith(1, 20);
  });

  it('returns 500 on unexpected errors', async () => {
    mockGetFormatsPaginated.mockRejectedValueOnce(new Error('db down'));
    const res = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ id: stationId }),
    });
    expect(res.status).toBe(500);
  });

  it('maps AppError to controlled response', async () => {
    mockGetFormatsPaginated.mockRejectedValueOnce(new AppError('oops', 422));
    const res = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ id: stationId }),
    });
    expect(res.status).toBe(422);
  });
});
