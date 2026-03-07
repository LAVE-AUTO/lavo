/**
 * API tests for POST /api/v1/stations/onboarding/submit.
 * Mocks completeStationOnboarding and rate-limiter.
 * @jest-environment node
 */
const mockCompleteStationOnboarding = jest.fn();
const mockCheckRateLimit = jest.fn();
const mockRecordFailedAttempt = jest.fn();
const mockResetOnSuccess = jest.fn();

jest.mock('@/server/station/station-service', () => ({
  completeStationOnboarding: (...args: unknown[]) =>
    mockCompleteStationOnboarding(...args),
}));

jest.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  recordFailedAttempt: (...args: unknown[]) => mockRecordFailedAttempt(...args),
  resetOnSuccess: (...args: unknown[]) => mockResetOnSuccess(...args),
}));

const mockHeadersGet = jest.fn((key: string) =>
  key === 'x-forwarded-for' ? '10.0.0.1' : null
);
jest.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: mockHeadersGet }),
}));

import { ConflictError } from '@/lib/errors';
import { POST } from '@/app/api/v1/stations/onboarding/submit/route';

const validBody = {
  email: 'station@example.com',
  phone: '+15551234567',
  password: 'SecureP@ss1',
  confirm_password: 'SecureP@ss1',
  station_name: 'Test Wash',
  address: '123 Main St',
  city: 'Montreal',
  wash_post_count: 2,
  wash_type: 'hand_wash' as const,
  documents: [
    { document_type: 'license', file_url: 'https://example.com/a.pdf', storage: 'cloudinary' as const },
    { document_type: 'insurance', file_url: 'https://example.com/b.pdf', storage: 'local' as const },
  ],
  terms_accepted: true as const,
};

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/stations/onboarding/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/stations/onboarding/submit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ blocked: false });
  });

  it('returns 201 and calls completeStationOnboarding with parsed dto', async () => {
    const user = { id: 'u1', email: validBody.email, role: 'station', status: 'pending_verification' };
    const station = { id: 's1', name: validBody.station_name, status: 'pending_admin_validation' };
    mockCompleteStationOnboarding.mockResolvedValueOnce({ user, station });
    const req = buildRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data).toEqual({ user, station });
    expect(data.message).toMatch(/verify your email/i);
    expect(mockCompleteStationOnboarding).toHaveBeenCalledTimes(1);
    const dto = mockCompleteStationOnboarding.mock.calls[0][0];
    expect(dto.email).toBe(validBody.email);
    expect(dto.documents).toHaveLength(2);
    expect(dto.documents[0].storage).toBe('cloudinary');
    expect(dto.documents[1].storage).toBe('local');
    expect(dto).not.toHaveProperty('confirm_password');
    expect(mockResetOnSuccess).toHaveBeenCalledWith('10.0.0.1');
  });

  it('returns 400 when body is not valid JSON', async () => {
    const req = new Request('http://localhost/api/v1/stations/onboarding/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json {{{',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/invalid json/i);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockCompleteStationOnboarding).not.toHaveBeenCalled();
  });

  it('returns 400 when required fields are missing', async () => {
    const req = buildRequest({
      email: 'a@b.com',
      station_name: 'X',
      address: '123',
      city: 'Y',
      wash_post_count: 1,
      wash_type: 'hand_wash',
      documents: [{ document_type: 'x', file_url: 'https://example.com/x.pdf' }],
      terms_accepted: true,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockCompleteStationOnboarding).not.toHaveBeenCalled();
    expect(mockRecordFailedAttempt).toHaveBeenCalled();
  });

  it('returns 400 when documents contain storage not in enum', async () => {
    const badBody = {
      ...validBody,
      documents: [
        { document_type: 'license', file_url: 'https://example.com/a.pdf', storage: 's3' },
      ],
    };
    const req = buildRequest(badBody);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockCompleteStationOnboarding).not.toHaveBeenCalled();
  });

  it('returns 429 when rate limit blocks request', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ blocked: true });
    const req = buildRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe('TOO_MANY_REQUESTS');
    expect(mockCompleteStationOnboarding).not.toHaveBeenCalled();
  });

  it('returns 409 when email already exists', async () => {
    mockCompleteStationOnboarding.mockRejectedValueOnce(
      new ConflictError('Email already in use')
    );
    const req = buildRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('EMAIL_ALREADY_EXISTS');
    expect(body.message).toMatch(/email already/i);
  });
});
