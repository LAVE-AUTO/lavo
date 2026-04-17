/**
 * API tests for GET + POST /api/v1/support.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockGetSupportTickets = jest.fn();
const mockCreateSupportTicket = jest.fn();
const mockCheckSlidingWindowRateLimit = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/server/support/support-ticket-service', () => ({
  getSupportTickets: (...args: unknown[]) => mockGetSupportTickets(...args),
  createSupportTicket: (...args: unknown[]) => mockCreateSupportTicket(...args),
}));

jest.mock('@/lib/rate-limiter', () => ({
  checkSlidingWindowRateLimit: (...args: unknown[]) => mockCheckSlidingWindowRateLimit(...args),
  normalizeRateLimitKey: (key: string) => key,
}));

import { GET, POST } from '@/app/api/v1/support/route';
import { AppError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const clientAuth = { sub: 'client-uuid-0001', role: 'client' };
const adminAuth = { sub: 'admin-uuid-0001', role: 'admin' };
const stationAuth = { sub: 'station-uuid-0001', role: 'station' };

const ticketFixture = {
  id: 'ticket-uuid-0001-000000000001',
  ticket_number: 'SUP-ABCD1234',
  created_by: clientAuth.sub,
  subject: 'Broken machine',
  status: 'ouvert',
  priority: 'normal',
  category: 'technique',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function makeGetRequest(query = ''): Request {
  return new Request(`http://localhost/api/v1/support${query ? `?${query}` : ''}`);
}

function makePostRequest(body?: unknown): Request {
  return new Request('http://localhost/api/v1/support', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ---------------------------------------------------------------------------
// GET /api/v1/support
// ---------------------------------------------------------------------------

describe('GET /api/v1/support', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(clientAuth);
    mockGetSupportTickets.mockResolvedValue([ticketFixture]);
  });

  // --- Happy path ---

  it('returns 200 with a list of tickets for an authenticated client', async () => {
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].ticket_number).toBe('SUP-ABCD1234');
    expect(mockGetSupportTickets).toHaveBeenCalledWith(clientAuth.sub, clientAuth.role, undefined);
  });

  it('passes status query param to the service', async () => {
    await GET(makeGetRequest('status=ouvert'));

    expect(mockGetSupportTickets).toHaveBeenCalledWith(clientAuth.sub, clientAuth.role, 'ouvert');
  });

  it('passes no status when query param is absent', async () => {
    await GET(makeGetRequest());

    expect(mockGetSupportTickets).toHaveBeenCalledWith(clientAuth.sub, clientAuth.role, undefined);
  });

  // --- Status filter validation ---

  it('returns 400 when status query param is not a valid enum value', async () => {
    const res = await GET(makeGetRequest('status=invalid_value'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockGetSupportTickets).not.toHaveBeenCalled();
  });

  it('returns 400 when status query param is an arbitrary string', async () => {
    const res = await GET(makeGetRequest('status=pending'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockGetSupportTickets).not.toHaveBeenCalled();
  });

  it('admin sees all tickets — passes admin role to service', async () => {
    mockRequireRole.mockResolvedValue(adminAuth);
    mockGetSupportTickets.mockResolvedValue([ticketFixture]);

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    expect(mockGetSupportTickets).toHaveBeenCalledWith(adminAuth.sub, adminAuth.role, undefined);
  });

  it('station user can list their own tickets', async () => {
    mockRequireRole.mockResolvedValue(stationAuth);
    mockGetSupportTickets.mockResolvedValue([]);

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    expect(mockGetSupportTickets).toHaveBeenCalledWith(stationAuth.sub, stationAuth.role, undefined);
  });

  // --- Auth errors ---

  it('returns 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
    );

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(401);
    expect(mockGetSupportTickets).not.toHaveBeenCalled();
  });

  it('returns 403 when role is not allowed', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 })
    );

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(403);
    expect(mockGetSupportTickets).not.toHaveBeenCalled();
  });

  // --- Service errors ---

  it('maps AppError from service to a controlled response', async () => {
    mockGetSupportTickets.mockRejectedValueOnce(new AppError('Service unavailable', 503));

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.message).toBe('Service unavailable');
  });

  it('returns 500 on unexpected non-AppError exception', async () => {
    mockGetSupportTickets.mockRejectedValueOnce(new Error('Unexpected DB failure'));

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/support
// ---------------------------------------------------------------------------

describe('POST /api/v1/support', () => {
  const validBody = {
    subject: 'Machine stopped working',
    message: 'It stopped mid-cycle and will not restart at all.',
    priority: 'normal',
    category: 'technique',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(clientAuth);
    mockCreateSupportTicket.mockResolvedValue(ticketFixture);
    // Default: rate limit allows the request through.
    mockCheckSlidingWindowRateLimit.mockResolvedValue({ allowed: true });
  });

  // --- Happy path ---

  it('returns 201 with created ticket on valid input', async () => {
    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.ticket_number).toBe('SUP-ABCD1234');
    expect(mockCreateSupportTicket).toHaveBeenCalledWith(clientAuth.sub, expect.objectContaining({
      subject: validBody.subject,
      message: validBody.message,
    }));
  });

  it('station user can create a ticket', async () => {
    mockRequireRole.mockResolvedValue(stationAuth);
    mockCreateSupportTicket.mockResolvedValue({ ...ticketFixture, created_by: stationAuth.sub });

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(201);
    expect(mockCreateSupportTicket).toHaveBeenCalledWith(stationAuth.sub, expect.any(Object));
  });

  it('uses default priority and category when not provided', async () => {
    const bodyWithoutOptionals = {
      subject: 'Machine stopped working',
      message: 'It stopped mid-cycle and will not restart at all.',
    };

    const res = await POST(makePostRequest(bodyWithoutOptionals));

    expect(res.status).toBe(201);
    // Zod applies defaults; service receives priority:'normal', category:'autre'.
    expect(mockCreateSupportTicket).toHaveBeenCalledWith(
      clientAuth.sub,
      expect.objectContaining({ priority: 'normal', category: 'autre' })
    );
  });

  // --- Validation: subject ---

  it('returns 400 when subject is missing', async () => {
    const res = await POST(makePostRequest({ message: validBody.message }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockCreateSupportTicket).not.toHaveBeenCalled();
  });

  it('returns 400 when subject is shorter than 5 characters', async () => {
    const res = await POST(makePostRequest({ ...validBody, subject: 'Hi' }));

    expect(res.status).toBe(400);
    expect(mockCreateSupportTicket).not.toHaveBeenCalled();
  });

  it('returns 400 when subject exceeds 255 characters', async () => {
    const res = await POST(makePostRequest({ ...validBody, subject: 'A'.repeat(256) }));

    expect(res.status).toBe(400);
    expect(mockCreateSupportTicket).not.toHaveBeenCalled();
  });

  // --- Validation: message ---

  it('returns 400 when message is missing', async () => {
    const res = await POST(makePostRequest({ subject: validBody.subject }));

    expect(res.status).toBe(400);
    expect(mockCreateSupportTicket).not.toHaveBeenCalled();
  });

  it('returns 400 when message is shorter than 10 characters', async () => {
    const res = await POST(makePostRequest({ ...validBody, message: 'Too short' }));

    expect(res.status).toBe(400);
    expect(mockCreateSupportTicket).not.toHaveBeenCalled();
  });

  // --- Validation: priority and category enums ---

  it('returns 400 when priority is not a valid enum value', async () => {
    const res = await POST(makePostRequest({ ...validBody, priority: 'critical' }));

    expect(res.status).toBe(400);
    expect(mockCreateSupportTicket).not.toHaveBeenCalled();
  });

  it('returns 400 when category is not a valid enum value', async () => {
    const res = await POST(makePostRequest({ ...validBody, category: 'unknown' }));

    expect(res.status).toBe(400);
    expect(mockCreateSupportTicket).not.toHaveBeenCalled();
  });

  // --- Hostile: malformed body ---

  it('returns 400 on malformed (non-JSON) body', async () => {
    const req = new Request('http://localhost/api/v1/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json{{{',
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockCreateSupportTicket).not.toHaveBeenCalled();
  });

  it('returns 400 when body is an empty object', async () => {
    const res = await POST(makePostRequest({}));

    expect(res.status).toBe(400);
    expect(mockCreateSupportTicket).not.toHaveBeenCalled();
  });

  it('returns 400 when body fields are wrong types (numbers instead of strings)', async () => {
    const res = await POST(makePostRequest({ subject: 12345, message: 99999 }));

    expect(res.status).toBe(400);
    expect(mockCreateSupportTicket).not.toHaveBeenCalled();
  });

  // --- Auth errors ---

  it('returns 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
    );

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(401);
    expect(mockCreateSupportTicket).not.toHaveBeenCalled();
  });

  // --- Service errors ---

  it('returns 422 when open ticket limit is reached', async () => {
    mockCreateSupportTicket.mockRejectedValueOnce(new AppError('Ticket limit reached', 422));

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.message).toBe('Ticket limit reached');
  });

  it('returns 500 on unexpected non-AppError exception from service', async () => {
    mockCreateSupportTicket.mockRejectedValueOnce(new Error('Unexpected DB failure'));

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('INTERNAL_ERROR');
  });

  // --- Rate limiting ---

  it('returns 429 when the user has exceeded the hourly ticket creation limit', async () => {
    mockCheckSlidingWindowRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 3000 });

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe('TOO_MANY_REQUESTS');
    expect(mockCreateSupportTicket).not.toHaveBeenCalled();
  });
});
