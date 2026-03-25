/**
 * Unit tests for PATCH /api/v1/admin/support/[id]/assign.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockAssignSupportTicket = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/server/support/support-ticket-service', () => ({
  assignSupportTicket: (...args: unknown[]) => mockAssignSupportTicket(...args),
}));

import { PATCH } from '@/app/api/v1/admin/support/[id]/assign/route';
import { AppError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const adminAuth = { sub: 'admin-uuid-0001', role: 'admin' };
const ticketId = '11111111-1111-1111-1111-111111111111';
const adminUserId = '22222222-2222-2222-2222-222222222222';

const ticketFixture = {
  id: ticketId,
  ticket_number: 'SUP-ABCD1234',
  created_by: 'client-uuid-0001',
  assigned_to: adminUserId,
  subject: 'Broken machine',
  status: 'ouvert',
  priority: 'normal',
  category: 'technique',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const unassignedTicketFixture = { ...ticketFixture, assigned_to: null };

function buildParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

function makePatchRequest(id: string, body?: unknown): Request {
  return new Request(`http://localhost/api/v1/admin/support/${id}/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/admin/support/[id]/assign
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/admin/support/[id]/assign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(adminAuth);
    mockAssignSupportTicket.mockResolvedValue(ticketFixture);
  });

  // --- Happy path: assign ---

  it('returns 200 with the updated ticket when assigning a valid admin UUID', async () => {
    const res = await PATCH(
      makePatchRequest(ticketId, { assigned_to: adminUserId }),
      { params: buildParams(ticketId) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(ticketId);
    expect(body.data.assigned_to).toBe(adminUserId);
    expect(mockAssignSupportTicket).toHaveBeenCalledWith(ticketId, adminUserId);
  });

  // --- Happy path: unassign ---

  it('returns 200 with assigned_to null when unassigning with null', async () => {
    mockAssignSupportTicket.mockResolvedValueOnce(unassignedTicketFixture);

    const res = await PATCH(
      makePatchRequest(ticketId, { assigned_to: null }),
      { params: buildParams(ticketId) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.assigned_to).toBeNull();
    expect(mockAssignSupportTicket).toHaveBeenCalledWith(ticketId, null);
  });

  // --- Param validation: ticket ID ---

  it('returns 400 when the ticket ID param is not a valid UUID', async () => {
    const res = await PATCH(
      makePatchRequest('not-a-uuid', { assigned_to: adminUserId }),
      { params: buildParams('not-a-uuid') }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockAssignSupportTicket).not.toHaveBeenCalled();
  });

  it('returns 400 when the ticket ID param is an empty string', async () => {
    const res = await PATCH(
      makePatchRequest('', { assigned_to: adminUserId }),
      { params: buildParams('') }
    );

    expect(res.status).toBe(400);
    expect(mockAssignSupportTicket).not.toHaveBeenCalled();
  });

  // --- Body validation: assigned_to ---

  it('returns 400 when assigned_to is not a valid UUID string', async () => {
    const res = await PATCH(
      makePatchRequest(ticketId, { assigned_to: 'not-a-uuid' }),
      { params: buildParams(ticketId) }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockAssignSupportTicket).not.toHaveBeenCalled();
  });

  it('returns 400 when assigned_to is a number instead of a UUID string', async () => {
    const res = await PATCH(
      makePatchRequest(ticketId, { assigned_to: 12345 }),
      { params: buildParams(ticketId) }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockAssignSupportTicket).not.toHaveBeenCalled();
  });

  it('returns 400 when the body is missing the assigned_to field entirely', async () => {
    const res = await PATCH(
      makePatchRequest(ticketId, {}),
      { params: buildParams(ticketId) }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockAssignSupportTicket).not.toHaveBeenCalled();
  });

  it('returns 400 on malformed (non-JSON) body', async () => {
    const req = new Request(`http://localhost/api/v1/admin/support/${ticketId}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{{not-json}}',
    });

    const res = await PATCH(req, { params: buildParams(ticketId) });

    expect(res.status).toBe(400);
    expect(mockAssignSupportTicket).not.toHaveBeenCalled();
  });

  // --- Auth errors ---

  it('returns 401 when the caller is not authenticated', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
    );

    const res = await PATCH(
      makePatchRequest(ticketId, { assigned_to: adminUserId }),
      { params: buildParams(ticketId) }
    );

    expect(res.status).toBe(401);
    expect(mockAssignSupportTicket).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller does not have the admin role', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 })
    );

    const res = await PATCH(
      makePatchRequest(ticketId, { assigned_to: adminUserId }),
      { params: buildParams(ticketId) }
    );

    expect(res.status).toBe(403);
    expect(mockAssignSupportTicket).not.toHaveBeenCalled();
  });

  // --- Service errors ---

  it('returns 404 when the ticket does not exist', async () => {
    mockAssignSupportTicket.mockRejectedValueOnce(new AppError('Ticket not found', 404));

    const res = await PATCH(
      makePatchRequest(ticketId, { assigned_to: adminUserId }),
      { params: buildParams(ticketId) }
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('NOT_FOUND');
    expect(body.message).toBe('Ticket not found');
  });

  it('returns 422 when the target user is not an admin', async () => {
    mockAssignSupportTicket.mockRejectedValueOnce(
      new AppError('Target user does not exist or is not an admin', 422)
    );

    const res = await PATCH(
      makePatchRequest(ticketId, { assigned_to: adminUserId }),
      { params: buildParams(ticketId) }
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.message).toBe('Target user does not exist or is not an admin');
  });

  it('returns 500 on unexpected non-AppError exception from the service', async () => {
    mockAssignSupportTicket.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await PATCH(
      makePatchRequest(ticketId, { assigned_to: adminUserId }),
      { params: buildParams(ticketId) }
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});
