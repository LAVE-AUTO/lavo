/**
 * API tests for POST /api/v1/support/[id]/messages.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockAddSupportMessage = jest.fn();
const mockCheckSlidingWindowRateLimit = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/server/support/support-ticket-service', () => ({
  addSupportMessage: (...args: unknown[]) => mockAddSupportMessage(...args),
}));

jest.mock('@/lib/rate-limiter', () => ({
  checkSlidingWindowRateLimit: (...args: unknown[]) => mockCheckSlidingWindowRateLimit(...args),
  normalizeRateLimitKey: (key: string) => key,
}));

import { POST } from '@/app/api/v1/support/[id]/messages/route';
import { AppError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const clientAuth = { sub: 'client-uuid-0001', role: 'client' };
const adminAuth = { sub: 'admin-uuid-0001', role: 'admin' };
const stationAuth = { sub: 'station-uuid-0001', role: 'station' };
const ticketId = '11111111-1111-1111-1111-111111111111';

const messageFixture = {
  id: 'msg-uuid-0001-000000000001',
  ticket_id: ticketId,
  sender_id: clientAuth.sub,
  is_from_admin: false,
  content: 'My machine is still broken.',
  created_at: new Date().toISOString(),
};

function buildParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

function makePostRequest(id: string, body?: unknown): Request {
  return new Request(`http://localhost/api/v1/support/${id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ---------------------------------------------------------------------------
// POST /api/v1/support/[id]/messages
// ---------------------------------------------------------------------------

describe('POST /api/v1/support/[id]/messages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(clientAuth);
    mockAddSupportMessage.mockResolvedValue(messageFixture);
    // Default: rate limit allows the request through.
    mockCheckSlidingWindowRateLimit.mockResolvedValue({ allowed: true });
  });

  // --- Happy path ---

  it('returns 201 with the created message when a client sends a valid message', async () => {
    const res = await POST(makePostRequest(ticketId, { content: 'My machine is still broken.' }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe(messageFixture.id);
    expect(body.data.content).toBe('My machine is still broken.');
    expect(mockAddSupportMessage).toHaveBeenCalledWith(
      clientAuth.sub,
      ticketId,
      'My machine is still broken.',
      false // is_from_admin must be false for client role
    );
  });

  it('passes is_from_admin=true when the sender role is admin', async () => {
    mockRequireRole.mockResolvedValue(adminAuth);
    const adminMessage = { ...messageFixture, sender_id: adminAuth.sub, is_from_admin: true };
    mockAddSupportMessage.mockResolvedValue(adminMessage);

    const res = await POST(makePostRequest(ticketId, { content: 'We are investigating.' }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(201);
    expect(mockAddSupportMessage).toHaveBeenCalledWith(
      adminAuth.sub,
      ticketId,
      'We are investigating.',
      true // is_from_admin must be true for admin role
    );
  });

  it('passes is_from_admin=false when the sender role is station', async () => {
    mockRequireRole.mockResolvedValue(stationAuth);
    const stationMessage = { ...messageFixture, sender_id: stationAuth.sub, is_from_admin: false };
    mockAddSupportMessage.mockResolvedValue(stationMessage);

    const res = await POST(makePostRequest(ticketId, { content: 'Problem persists on our side too.' }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(201);
    expect(mockAddSupportMessage).toHaveBeenCalledWith(
      stationAuth.sub,
      ticketId,
      'Problem persists on our side too.',
      false // is_from_admin must be false for station role
    );
  });

  // --- Validation: content ---

  it('returns 400 when content is missing', async () => {
    const res = await POST(makePostRequest(ticketId, {}), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockAddSupportMessage).not.toHaveBeenCalled();
  });

  it('returns 400 when content is an empty string', async () => {
    const res = await POST(makePostRequest(ticketId, { content: '' }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(400);
    expect(mockAddSupportMessage).not.toHaveBeenCalled();
  });

  it('returns 400 when content is null', async () => {
    const res = await POST(makePostRequest(ticketId, { content: null }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(400);
    expect(mockAddSupportMessage).not.toHaveBeenCalled();
  });

  it('returns 400 when content is a number instead of a string', async () => {
    const res = await POST(makePostRequest(ticketId, { content: 42 }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(400);
    expect(mockAddSupportMessage).not.toHaveBeenCalled();
  });

  // --- Hostile: malformed body ---

  it('returns 400 on malformed (non-JSON) body', async () => {
    const req = new Request(`http://localhost/api/v1/support/${ticketId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{{not-json}}',
    });

    const res = await POST(req, { params: buildParams(ticketId) });

    expect(res.status).toBe(400);
    expect(mockAddSupportMessage).not.toHaveBeenCalled();
  });

  // --- Auth errors ---

  it('returns 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
    );

    const res = await POST(makePostRequest(ticketId, { content: 'Hello' }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(401);
    expect(mockAddSupportMessage).not.toHaveBeenCalled();
  });

  it('returns 403 when auth role is not allowed', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 })
    );

    const res = await POST(makePostRequest(ticketId, { content: 'Hello' }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(403);
    expect(mockAddSupportMessage).not.toHaveBeenCalled();
  });

  // --- Permission enforcement from service ---

  it('returns 403 when a client tries to message a ticket that is not theirs', async () => {
    mockAddSupportMessage.mockRejectedValueOnce(new AppError('Forbidden', 403));

    const res = await POST(makePostRequest(ticketId, { content: 'Can I butt in?' }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('FORBIDDEN');
  });

  it('returns 404 when the ticket does not exist', async () => {
    mockAddSupportMessage.mockRejectedValueOnce(new AppError('Ticket not found', 404));

    const res = await POST(makePostRequest(ticketId, { content: 'Hello?' }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('NOT_FOUND');
    expect(body.message).toBe('Ticket not found');
  });

  // --- Unexpected errors ---

  it('returns 500 on unexpected non-AppError exception from service', async () => {
    mockAddSupportMessage.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await POST(makePostRequest(ticketId, { content: 'Testing.' }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('INTERNAL_ERROR');
  });

  // --- Rate limiting ---

  it('returns 429 when the user has exceeded the hourly message limit', async () => {
    mockCheckSlidingWindowRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 3500 });

    const res = await POST(makePostRequest(ticketId, { content: 'One more message.' }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe('TOO_MANY_REQUESTS');
    expect(mockAddSupportMessage).not.toHaveBeenCalled();
  });
});
