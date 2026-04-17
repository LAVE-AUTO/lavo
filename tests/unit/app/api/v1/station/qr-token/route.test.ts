/**
 * API tests for GET /api/v1/station/qr-token.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockGetMyStation = jest.fn();
const mockGenerateQrToken = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/station/station-service', () => ({
  getMyStation: (...args: unknown[]) => mockGetMyStation(...args),
}));
jest.mock('@/server/qr/qr-token-service', () => ({
  QR_TOKEN_VERSION: '1',
  generateQrToken: (...args: unknown[]) => mockGenerateQrToken(...args),
}));

import { GET } from '@/app/api/v1/station/qr-token/route';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

describe('GET /api/v1/station/qr-token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue({ sub: 'station-user-1', role: 'station' });
    mockGetMyStation.mockResolvedValue({ id: 'station-1' });
    mockGenerateQrToken.mockReturnValue('a'.repeat(64));
  });

  it('returns 200 with station_id, qr_token and version', async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({
      station_id: 'station-1',
      qr_token: 'a'.repeat(64),
      v: '1',
    });
    expect(mockGetMyStation).toHaveBeenCalledWith('station-user-1');
    expect(mockGenerateQrToken).toHaveBeenCalledWith('station-1');
  });

  it('returns auth response when requireRole fails', async () => {
    mockRequireRole.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

    const res = await GET();

    expect(res.status).toBe(401);
    expect(mockGetMyStation).not.toHaveBeenCalled();
    expect(mockGenerateQrToken).not.toHaveBeenCalled();
  });

  it('returns 404 when station is missing', async () => {
    mockGetMyStation.mockRejectedValueOnce(new NotFoundError('Station not found'));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.message).toBe('Station not found');
  });

  it('returns 403 when access is forbidden', async () => {
    mockGetMyStation.mockRejectedValueOnce(new ForbiddenError('Forbidden'));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.message).toBe('Forbidden');
  });

  it('returns 500 on unexpected error', async () => {
    mockGetMyStation.mockRejectedValueOnce(new Error('boom'));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});
