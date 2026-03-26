/**
 * API tests for POST /api/v1/admin/stations/:id/approve.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockExtractLocale = jest.fn();
const mockApproveStation = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/lib/email', () => ({
  extractLocale: (...args: unknown[]) => mockExtractLocale(...args),
}));

jest.mock('@/server/station/station-service', () => ({
  approveStation: (...args: unknown[]) => mockApproveStation(...args),
}));

import { POST } from '@/app/api/v1/admin/stations/[id]/approve/route';

describe('POST /api/v1/admin/stations/:id/approve', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue({ sub: 'admin-1', role: 'admin' });
    mockExtractLocale.mockReturnValue('en');
    mockApproveStation.mockResolvedValue(undefined);
  });

  it('derives locale from Accept-Language and forwards it to approveStation', async () => {
    const req = new Request('http://localhost/api/v1/admin/stations/station-1/approve', {
      method: 'POST',
      headers: { 'accept-language': 'en-US,en;q=0.9' },
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'station-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ approved: true });
    expect(mockExtractLocale).toHaveBeenCalledWith('en-US,en;q=0.9');
    expect(mockApproveStation).toHaveBeenCalledWith('admin-1', 'station-1', 'en');
  });

  it('returns auth response when requireRole fails', async () => {
    mockRequireRole.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
    const req = new Request('http://localhost/api/v1/admin/stations/station-1/approve', {
      method: 'POST',
      headers: { 'accept-language': 'fr-CA,fr;q=0.8' },
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'station-1' }) });

    expect(res.status).toBe(401);
    expect(mockExtractLocale).not.toHaveBeenCalled();
    expect(mockApproveStation).not.toHaveBeenCalled();
  });

  it('returns 400 when station id is not a valid UUID', async () => {
    const req = new Request('http://localhost/api/v1/admin/stations/not-a-uuid/approve', {
      method: 'POST',
      headers: { 'accept-language': 'en' },
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'not-a-uuid' }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockApproveStation).not.toHaveBeenCalled();
  });
});
