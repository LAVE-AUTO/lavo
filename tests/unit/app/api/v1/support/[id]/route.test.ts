/**
 * API tests for GET + PATCH /api/v1/support/[id].
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockGetTicketDetails = jest.fn();
const mockUpdateSupportTicketStatus = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/server/support/support-ticket-service', () => ({
  getTicketDetails: (...args: unknown[]) => mockGetTicketDetails(...args),
  updateSupportTicketStatus: (...args: unknown[]) => mockUpdateSupportTicketStatus(...args),
}));

import { GET, PATCH } from '@/app/api/v1/support/[id]/route';
import { AppError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const clientAuth = { sub: 'client-uuid-0001', role: 'client' };
const adminAuth = { sub: 'admin-uuid-0001', role: 'admin' };
const stationAuth = { sub: 'station-uuid-0001', role: 'station' };
const ticketId = '11111111-1111-1111-1111-111111111111';

const ticketFixture = {
  id: '11111111-1111-1111-1111-111111111111',
  ticket_number: 'SUP-ABCD12',
  created_by: clientAuth.sub,
  subject: 'Broken machine',
  status: 'ouvert',
  priority: 'normal',
  category: 'technique',
  messages: [
    { id: 'msg-1', content: 'First message', created_at: new Date('2026-03-01T10:00:00Z') },
    { id: 'msg-2', content: 'Second message', created_at: new Date('2026-03-01T11:00:00Z') },
    { id: 'msg-3', content: 'Third message', created_at: new Date('2026-03-01T12:00:00Z') },
  ],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function buildParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

function makeGetRequest(id: string): Request {
  return new Request(`http://localhost/api/v1/support/${id}`);
}

function makePatchRequest(id: string, body?: unknown): Request {
  return new Request(`http://localhost/api/v1/support/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ---------------------------------------------------------------------------
// GET /api/v1/support/[id]
// ---------------------------------------------------------------------------

describe('GET /api/v1/support/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(clientAuth);
    mockGetTicketDetails.mockResolvedValue(ticketFixture);
  });

  // --- Happy path ---

  it('returns 200 with ticket details when the owner requests it', async () => {
    const res = await GET(makeGetRequest(ticketId), { params: buildParams(ticketId) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(ticketId);
    expect(body.data.ticket_number).toBe('SUP-ABCD12');
    expect(mockGetTicketDetails).toHaveBeenCalledWith(clientAuth.sub, clientAuth.role, ticketId);
  });

  it('returns 200 and includes messages array when ticket has a thread', async () => {
    const res = await GET(makeGetRequest(ticketId), { params: buildParams(ticketId) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data.messages)).toBe(true);
    expect(body.data.messages).toHaveLength(3);
  });

  it('messages are in ascending chronological order', async () => {
    const res = await GET(makeGetRequest(ticketId), { params: buildParams(ticketId) });

    const body = await res.json();
    const messages = body.data.messages as { id: string }[];
    expect(messages[0].id).toBe('msg-1');
    expect(messages[1].id).toBe('msg-2');
    expect(messages[2].id).toBe('msg-3');
  });

  it('admin can view any ticket regardless of ownership', async () => {
    mockRequireRole.mockResolvedValue(adminAuth);
    const otherTicket = { ...ticketFixture, created_by: 'other-user-uuid-9999' };
    mockGetTicketDetails.mockResolvedValue(otherTicket);

    const res = await GET(makeGetRequest(ticketId), { params: buildParams(ticketId) });

    expect(res.status).toBe(200);
    expect(mockGetTicketDetails).toHaveBeenCalledWith(adminAuth.sub, adminAuth.role, ticketId);
  });

  it('station user can view their own ticket', async () => {
    mockRequireRole.mockResolvedValue(stationAuth);
    mockGetTicketDetails.mockResolvedValue({ ...ticketFixture, created_by: stationAuth.sub });

    const res = await GET(makeGetRequest(ticketId), { params: buildParams(ticketId) });

    expect(res.status).toBe(200);
    expect(mockGetTicketDetails).toHaveBeenCalledWith(stationAuth.sub, stationAuth.role, ticketId);
  });

  // --- Permission enforcement ---

  it('returns 403 when a client requests another user ticket', async () => {
    mockGetTicketDetails.mockRejectedValueOnce(new AppError('Forbidden', 403));

    const res = await GET(makeGetRequest(ticketId), { params: buildParams(ticketId) });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('FORBIDDEN');
  });

  // --- Not found ---

  it('returns 404 when ticket does not exist', async () => {
    mockGetTicketDetails.mockRejectedValueOnce(new AppError('Ticket not found', 404));

    const res = await GET(makeGetRequest(ticketId), { params: buildParams(ticketId) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('NOT_FOUND');
    expect(body.message).toBe('Ticket not found');
  });

  // --- Auth errors ---

  it('returns 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
    );

    const res = await GET(makeGetRequest(ticketId), { params: buildParams(ticketId) });

    expect(res.status).toBe(401);
    expect(mockGetTicketDetails).not.toHaveBeenCalled();
  });

  it('returns 403 when auth role is not allowed', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 })
    );

    const res = await GET(makeGetRequest(ticketId), { params: buildParams(ticketId) });

    expect(res.status).toBe(403);
    expect(mockGetTicketDetails).not.toHaveBeenCalled();
  });

  // --- Unexpected errors ---

  it('returns 500 on unexpected non-AppError exception', async () => {
    mockGetTicketDetails.mockRejectedValueOnce(new Error('DB timeout'));

    const res = await GET(makeGetRequest(ticketId), { params: buildParams(ticketId) });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/support/[id] — Admin only, status update
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/support/[id]', () => {
  const updatedTicket = { ...ticketFixture, status: 'en_cours' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(adminAuth);
    mockUpdateSupportTicketStatus.mockResolvedValue(updatedTicket);
  });

  // --- Happy path: all valid statuses ---

  it('returns 200 and updated ticket when status is "ouvert"', async () => {
    mockUpdateSupportTicketStatus.mockResolvedValueOnce({ ...ticketFixture, status: 'ouvert' });

    const res = await PATCH(makePatchRequest(ticketId, { status: 'ouvert' }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('ouvert');
    expect(mockUpdateSupportTicketStatus).toHaveBeenCalledWith(ticketId, 'ouvert');
  });

  it('returns 200 and updated ticket when status is "en_cours"', async () => {
    const res = await PATCH(makePatchRequest(ticketId, { status: 'en_cours' }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('en_cours');
    expect(mockUpdateSupportTicketStatus).toHaveBeenCalledWith(ticketId, 'en_cours');
  });

  it('returns 200 and updated ticket when status is "resolu"', async () => {
    mockUpdateSupportTicketStatus.mockResolvedValueOnce({ ...ticketFixture, status: 'resolu' });

    const res = await PATCH(makePatchRequest(ticketId, { status: 'resolu' }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('resolu');
    expect(mockUpdateSupportTicketStatus).toHaveBeenCalledWith(ticketId, 'resolu');
  });

  it('returns 200 and updated ticket when status is "ferme"', async () => {
    mockUpdateSupportTicketStatus.mockResolvedValueOnce({ ...ticketFixture, status: 'ferme' });

    const res = await PATCH(makePatchRequest(ticketId, { status: 'ferme' }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('ferme');
    expect(mockUpdateSupportTicketStatus).toHaveBeenCalledWith(ticketId, 'ferme');
  });

  // --- Status validation ---

  it('returns 400 when status is not a valid enum value', async () => {
    const res = await PATCH(makePatchRequest(ticketId, { status: 'pending' }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpdateSupportTicketStatus).not.toHaveBeenCalled();
  });

  it('returns 400 when status is an empty string', async () => {
    const res = await PATCH(makePatchRequest(ticketId, { status: '' }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(400);
    expect(mockUpdateSupportTicketStatus).not.toHaveBeenCalled();
  });

  it('returns 400 when status field is missing from body', async () => {
    const res = await PATCH(makePatchRequest(ticketId, {}), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(400);
    expect(mockUpdateSupportTicketStatus).not.toHaveBeenCalled();
  });

  it('returns 400 when status is null', async () => {
    const res = await PATCH(makePatchRequest(ticketId, { status: null }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(400);
    expect(mockUpdateSupportTicketStatus).not.toHaveBeenCalled();
  });

  it('returns 400 when status is a number instead of a string', async () => {
    const res = await PATCH(makePatchRequest(ticketId, { status: 1 }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(400);
    expect(mockUpdateSupportTicketStatus).not.toHaveBeenCalled();
  });

  // --- Hostile: invalid body format ---

  it('returns 500 on malformed (non-JSON) body', async () => {
    const req = new Request(`http://localhost/api/v1/support/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid-json',
    });

    const res = await PATCH(req, { params: buildParams(ticketId) });

    expect(res.status).toBe(500);
    expect(mockUpdateSupportTicketStatus).not.toHaveBeenCalled();
  });

  // --- Auth: only admin can PATCH ---

  it('returns 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
    );

    const res = await PATCH(makePatchRequest(ticketId, { status: 'en_cours' }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(401);
    expect(mockUpdateSupportTicketStatus).not.toHaveBeenCalled();
  });

  it('returns 403 when role is client (non-admin cannot update status)', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 })
    );

    const res = await PATCH(makePatchRequest(ticketId, { status: 'en_cours' }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(403);
    expect(mockUpdateSupportTicketStatus).not.toHaveBeenCalled();
  });

  it('returns 403 when role is station (non-admin cannot update status)', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 })
    );

    const res = await PATCH(makePatchRequest(ticketId, { status: 'en_cours' }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(403);
    expect(mockUpdateSupportTicketStatus).not.toHaveBeenCalled();
  });

  // --- Unexpected errors ---

  it('returns 500 on unexpected non-AppError exception from service', async () => {
    mockUpdateSupportTicketStatus.mockRejectedValueOnce(new Error('Unexpected failure'));

    const res = await PATCH(makePatchRequest(ticketId, { status: 'en_cours' }), {
      params: buildParams(ticketId),
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});
