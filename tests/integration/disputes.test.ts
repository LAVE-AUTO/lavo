/**
 * Integration tests for POST /api/v1/disputes.
 *
 * Focus: the dispute filing window is configurable via `dispute_window_days`.
 * The service mock controls whether the window is respected or expired, and the
 * route handler must propagate the correct status code in each case.
 *
 * @jest-environment node
 */

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const mockRequireRole = jest.fn();
const mockCreateDispute = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/server/disputes/dispute-service', () => ({
  createDispute: (...args: unknown[]) => mockCreateDispute(...args),
}));

// The endpoint rate limiter is in-memory and must not block tests.
jest.mock('@/lib/endpoint-rate-limiter', () => ({
  createEndpointRateLimiter: () => ({
    isRateLimited: () => false,
  }),
}));

import { POST } from '@/app/api/v1/disputes/route';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  DisputeAlreadyExistsError,
  AppError,
} from '@/lib/errors';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CLIENT_AUTH = { sub: 'client-uuid-0001', role: 'client', force_password_change: false };

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const CREATED_DISPUTE = {
  id: 'dispute-uuid-0001',
  reservation_id: VALID_UUID,
  client_id: CLIENT_AUTH.sub,
  station_id: 'station-uuid-0001',
  reason: 'Vehicle damage observed after wash',
  status: 'open',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/disputes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeMalformedRequest(): Request {
  return new Request('http://localhost/api/v1/disputes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{malformed json',
  });
}

const VALID_BODY = {
  reservation_id: VALID_UUID,
  reason: 'Vehicle damage observed after wash',
};

// ---------------------------------------------------------------------------
// POST /api/v1/disputes
// ---------------------------------------------------------------------------

describe('POST /api/v1/disputes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(CLIENT_AUTH);
    mockCreateDispute.mockResolvedValue(CREATED_DISPUTE);
  });

  // --- Happy path: within dispute window ---

  it('returns 201 with dispute data when within the configurable window', async () => {
    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.id).toBe(CREATED_DISPUTE.id);
    expect(body.data.status).toBe('open');
    expect(body.message).toBe('Dispute created successfully');
    expect(mockCreateDispute).toHaveBeenCalledWith(
      CLIENT_AUTH.sub,
      expect.objectContaining({ reservation_id: VALID_UUID })
    );
  });

  it('passes the authenticated client id to the service', async () => {
    await POST(makeRequest(VALID_BODY));
    const [calledClientId] = mockCreateDispute.mock.calls[0] as [string, unknown];
    expect(calledClientId).toBe(CLIENT_AUTH.sub);
  });

  // --- Outside dispute window (service raises ConflictError) ---

  it('returns 409 DISPUTE_ALREADY_EXISTS when dispute window has expired and service raises ConflictError', async () => {
    // The route handler maps AppError with statusCode 409 to DISPUTE_ALREADY_EXISTS.
    // The service raises ConflictError (statusCode 409) when the window is expired.
    mockCreateDispute.mockRejectedValue(new ConflictError('Dispute window has expired'));

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();

    // The handler maps any 409 AppError to DISPUTE_ALREADY_EXISTS
    expect(res.status).toBe(409);
    expect(body.code).toBe('DISPUTE_ALREADY_EXISTS');
  });

  // --- Auth ---

  it('returns 401 when the request is unauthenticated', async () => {
    mockRequireRole.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unauthorized', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    expect(mockCreateDispute).not.toHaveBeenCalled();
  });

  it('returns 403 when the authenticated user is not a client', async () => {
    mockRequireRole.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Forbidden', code: 'FORBIDDEN' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(mockCreateDispute).not.toHaveBeenCalled();
  });

  // --- Input validation ---

  it('returns 400 for malformed JSON body', async () => {
    const res = await POST(makeMalformedRequest());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockCreateDispute).not.toHaveBeenCalled();
  });

  it('returns 400 when reservation_id is missing', async () => {
    const res = await POST(makeRequest({ reason: 'Vehicle damage' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(Array.isArray(body.errors)).toBe(true);
  });

  it('returns 400 when reservation_id is not a valid UUID', async () => {
    const res = await POST(makeRequest({ reservation_id: 'not-a-uuid', reason: 'Damage' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when reason is an empty string', async () => {
    const res = await POST(makeRequest({ reservation_id: VALID_UUID, reason: '' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  // --- Service error propagation ---

  it('returns 404 when reservation is not found', async () => {
    mockCreateDispute.mockRejectedValue(new NotFoundError('Reservation not found'));

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
  });

  it('returns 403 when the reservation belongs to another client', async () => {
    mockCreateDispute.mockRejectedValue(new ForbiddenError('This reservation does not belong to you'));

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
  });

  it('returns 400 when the reservation is not in completed status', async () => {
    mockCreateDispute.mockRejectedValue(
      new ValidationError('Disputes can only be opened for completed reservations')
    );

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 409 DISPUTE_ALREADY_EXISTS when a dispute already exists for the reservation', async () => {
    mockCreateDispute.mockRejectedValue(new DisputeAlreadyExistsError());

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe('DISPUTE_ALREADY_EXISTS');
  });

  it('returns 500 on unexpected service failure without leaking error details', async () => {
    mockCreateDispute.mockRejectedValue(new Error('DB connection lost'));

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    // Ensure raw error message is not surfaced
    expect(JSON.stringify(body)).not.toContain('DB connection lost');
  });
});
