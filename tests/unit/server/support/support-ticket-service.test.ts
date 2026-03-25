/**
 * Unit tests for support-ticket-service: business logic, permission guards,
 * ticket number retry loop, and open-ticket limit enforcement.
 * @jest-environment node
 */
const mockCreateTicket = jest.fn();
const mockAddMessage = jest.fn();
const mockFindTicketById = jest.fn();
const mockListTickets = jest.fn();
const mockCountOpenTicketsByUser = jest.fn();
const mockUpdateTicketStatus = jest.fn();
const mockGetSettings = jest.fn();
const mockUpdateSetting = jest.fn();
const mockNotifyEntry = jest.fn();

jest.mock('@/server/support/support-ticket-repository', () => ({
  createTicket: (...args: unknown[]) => mockCreateTicket(...args),
  addMessage: (...args: unknown[]) => mockAddMessage(...args),
  findTicketById: (...args: unknown[]) => mockFindTicketById(...args),
  listTickets: (...args: unknown[]) => mockListTickets(...args),
  countOpenTicketsByUser: (...args: unknown[]) => mockCountOpenTicketsByUser(...args),
  updateTicketStatus: (...args: unknown[]) => mockUpdateTicketStatus(...args),
  getSettings: (...args: unknown[]) => mockGetSettings(...args),
  updateSetting: (...args: unknown[]) => mockUpdateSetting(...args),
}));

jest.mock('@/server/notifications/notification-service', () => ({
  notifyEntry: (...args: unknown[]) => mockNotifyEntry(...args),
}));

import {
  createSupportTicket,
  addSupportMessage,
  getTicketDetails,
  getSupportTickets,
  updateSupportTicketStatus,
  getSupportSettings,
  updateSupportSettings,
} from '@/server/support/support-ticket-service';
import { AppError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const userId = 'user-uuid-0001-0000-0000-000000000001';
const adminId = 'admin-uuid-0001-000000000001';
const otherUserId = 'user-uuid-0002-0000-0000-000000000002';
const ticketId = 'ticket-uuid-0001-00000000000001';
const now = new Date();

const baseTicket = {
  id: ticketId,
  ticket_number: 'SUP-ABCD12',
  created_by: userId,
  assigned_to: null,
  subject: 'My washer is broken',
  message: 'It stopped mid-cycle and will not restart.',
  status: 'ouvert',
  priority: 'normal',
  category: 'technique',
  resolved_at: null,
  created_at: now,
  updated_at: now,
};

const createInput = {
  subject: 'My washer is broken',
  message: 'It stopped mid-cycle and will not restart.',
  priority: 'normal' as const,
  category: 'technique' as const,
};

// ---------------------------------------------------------------------------
// createSupportTicket
// ---------------------------------------------------------------------------

describe('createSupportTicket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSettings.mockResolvedValue({});
    mockCountOpenTicketsByUser.mockResolvedValue(0);
    mockCreateTicket.mockResolvedValue(baseTicket);
    mockNotifyEntry.mockResolvedValue(undefined);
  });

  // --- Happy path ---

  it('creates a ticket and sends a notification on success', async () => {
    const result = await createSupportTicket(userId, createInput);

    expect(mockCreateTicket).toHaveBeenCalledTimes(1);
    expect(mockCreateTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        created_by: userId,
        subject: createInput.subject,
        message: createInput.message,
        status: 'ouvert',
        ticket_number: expect.stringMatching(/^SUP-[A-Z0-9]{6}$/),
      }),
      createInput.message
    );
    expect(mockNotifyEntry).toHaveBeenCalledWith({
      userId,
      entryId: baseTicket.id,
      type: 'support_ticket_created',
    });
    expect(result.id).toBe(ticketId);
  });

  it('applies default priority and category when not provided', async () => {
    const minimalInput = {
      subject: 'My washer is broken',
      message: 'It stopped mid-cycle and will not restart.',
      priority: 'normal' as const,
      category: 'autre' as const,
    };

    await createSupportTicket(userId, minimalInput);

    expect(mockCreateTicket).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'normal', category: 'autre' }),
      expect.any(String)
    );
  });

  // --- max_open_tickets_per_user enforcement ---

  it('throws 422 AppError when open ticket count meets the configured limit', async () => {
    mockGetSettings.mockResolvedValue({ max_open_tickets_per_user: '2' });
    mockCountOpenTicketsByUser.mockResolvedValue(2);

    await expect(createSupportTicket(userId, createInput)).rejects.toThrow(AppError);
    await expect(createSupportTicket(userId, createInput)).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(mockCreateTicket).not.toHaveBeenCalled();
  });

  it('allows creation when open count is below the configured limit', async () => {
    mockGetSettings.mockResolvedValue({ max_open_tickets_per_user: '3' });
    mockCountOpenTicketsByUser.mockResolvedValue(2);

    await expect(createSupportTicket(userId, createInput)).resolves.toBeDefined();
    expect(mockCreateTicket).toHaveBeenCalledTimes(1);
  });

  it('ignores the setting when max_open_tickets_per_user is 0 (disabled)', async () => {
    mockGetSettings.mockResolvedValue({ max_open_tickets_per_user: '0' });
    mockCountOpenTicketsByUser.mockResolvedValue(99);

    await expect(createSupportTicket(userId, createInput)).resolves.toBeDefined();
    expect(mockCreateTicket).toHaveBeenCalledTimes(1);
  });

  it('ignores a non-numeric setting value and does not enforce the limit', async () => {
    mockGetSettings.mockResolvedValue({ max_open_tickets_per_user: 'disabled' });
    mockCountOpenTicketsByUser.mockResolvedValue(99);

    await expect(createSupportTicket(userId, createInput)).resolves.toBeDefined();
    expect(mockCreateTicket).toHaveBeenCalledTimes(1);
  });

  it('skips the open-ticket count query when the setting is absent', async () => {
    mockGetSettings.mockResolvedValue({});

    await createSupportTicket(userId, createInput);

    expect(mockCountOpenTicketsByUser).not.toHaveBeenCalled();
  });

  // --- Ticket number uniqueness retry loop ---

  it('retries on 23505 unique constraint and succeeds on the second attempt', async () => {
    const pgUniqueViolation = Object.assign(
      new Error('duplicate key value violates unique constraint'),
      { code: '23505' }
    );

    // First attempt collides; second attempt succeeds.
    mockCreateTicket
      .mockRejectedValueOnce(pgUniqueViolation)
      .mockResolvedValueOnce(baseTicket);

    const result = await createSupportTicket(userId, createInput);

    expect(mockCreateTicket).toHaveBeenCalledTimes(2);
    expect(result.id).toBe(ticketId);
    expect(mockNotifyEntry).toHaveBeenCalledTimes(1);
  });

  it('retries up to 5 times on 23505 then throws 500 AppError', async () => {
    const pgUniqueViolation = Object.assign(
      new Error('duplicate key value violates unique constraint'),
      { code: '23505' }
    );

    mockCreateTicket.mockRejectedValue(pgUniqueViolation);

    await expect(createSupportTicket(userId, createInput)).rejects.toMatchObject({
      statusCode: 500,
    });
    // Exactly 5 attempts before giving up.
    expect(mockCreateTicket).toHaveBeenCalledTimes(5);
    expect(mockNotifyEntry).not.toHaveBeenCalled();
  });

  it('immediately re-throws non-23505 database errors without retrying', async () => {
    const connectionError = Object.assign(new Error('connection refused'), { code: '08006' });
    mockCreateTicket.mockRejectedValue(connectionError);

    await expect(createSupportTicket(userId, createInput)).rejects.toThrow('connection refused');
    // Must not retry.
    expect(mockCreateTicket).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// addSupportMessage
// ---------------------------------------------------------------------------

describe('addSupportMessage', () => {
  const messageFixture = {
    id: 'msg-uuid-0001-000000000001',
    ticket_id: ticketId,
    sender_id: userId,
    is_from_admin: false,
    content: 'Still not working.',
    created_at: now,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindTicketById.mockResolvedValue({ ...baseTicket, assigned_to: adminId });
    mockAddMessage.mockResolvedValue(messageFixture);
    mockNotifyEntry.mockResolvedValue(undefined);
  });

  // --- Happy path ---

  it('client can add a message to their own ticket', async () => {
    const result = await addSupportMessage(userId, ticketId, 'Still not working.', false);

    expect(mockAddMessage).toHaveBeenCalledWith({
      ticket_id: ticketId,
      sender_id: userId,
      content: 'Still not working.',
      is_from_admin: false,
    });
    expect(result.id).toBe(messageFixture.id);
  });

  it('admin can add a message to any ticket regardless of ownership', async () => {
    // Ticket belongs to userId, not adminId — admin must still be allowed.
    const result = await addSupportMessage(adminId, ticketId, 'We are looking into it.', true);

    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({ sender_id: adminId, is_from_admin: true })
    );
    expect(result).toBeDefined();
  });

  it('station user can add a message to their own ticket', async () => {
    const stationId = 'station-uuid-0001-000000000001';
    mockFindTicketById.mockResolvedValue({ ...baseTicket, created_by: stationId });

    const result = await addSupportMessage(stationId, ticketId, 'Problem persists.', false);

    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({ sender_id: stationId, is_from_admin: false })
    );
    expect(result).toBeDefined();
  });

  // --- Closed ticket guard ---

  it('throws 422 AppError when adding a message to a closed (ferme) ticket', async () => {
    mockFindTicketById.mockResolvedValue({ ...baseTicket, status: 'ferme' });

    await expect(
      addSupportMessage(userId, ticketId, 'Can I reopen?', false)
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(mockAddMessage).not.toHaveBeenCalled();
  });

  it('allows adding a message to a resolved (resolu) ticket', async () => {
    mockFindTicketById.mockResolvedValue({ ...baseTicket, status: 'resolu', assigned_to: adminId });

    const result = await addSupportMessage(userId, ticketId, 'Still an issue.', false);

    expect(mockAddMessage).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
  });

  // --- Permission enforcement ---

  it('throws 403 AppError when a non-admin sends a message to another user ticket', async () => {
    await expect(
      addSupportMessage(otherUserId, ticketId, 'Can I help?', false)
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(mockAddMessage).not.toHaveBeenCalled();
  });

  // --- Ticket not found ---

  it('throws 404 AppError when the ticket does not exist', async () => {
    mockFindTicketById.mockResolvedValue(undefined);

    await expect(
      addSupportMessage(userId, ticketId, 'Hello?', false)
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(mockAddMessage).not.toHaveBeenCalled();
  });

  // --- Notification routing ---

  it('notifies assigned admin when a client sends a message', async () => {
    mockFindTicketById.mockResolvedValue({ ...baseTicket, assigned_to: adminId });

    await addSupportMessage(userId, ticketId, 'Update?', false);

    expect(mockNotifyEntry).toHaveBeenCalledWith({
      userId: adminId,
      entryId: ticketId,
      type: 'support_message_received',
    });
  });

  it('notifies the ticket creator when an admin sends a message', async () => {
    await addSupportMessage(adminId, ticketId, 'We are on it.', true);

    expect(mockNotifyEntry).toHaveBeenCalledWith({
      userId,
      entryId: ticketId,
      type: 'support_message_received',
    });
  });

  it('sends no notification when no assigned admin and client sends a message', async () => {
    mockFindTicketById.mockResolvedValue({ ...baseTicket, assigned_to: null });

    await addSupportMessage(userId, ticketId, 'Still waiting.', false);

    expect(mockNotifyEntry).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getTicketDetails
// ---------------------------------------------------------------------------

describe('getTicketDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindTicketById.mockResolvedValue(baseTicket);
  });

  // --- Happy path ---

  it('returns ticket when owner requests their own ticket', async () => {
    const result = await getTicketDetails(userId, 'client', ticketId);
    expect(result.id).toBe(ticketId);
  });

  it('returns ticket when admin requests any ticket', async () => {
    const otherTicket = { ...baseTicket, created_by: otherUserId };
    mockFindTicketById.mockResolvedValue(otherTicket);

    const result = await getTicketDetails(adminId, 'admin', ticketId);
    expect(result.id).toBe(ticketId);
  });

  it('returns ticket when station user requests their own ticket', async () => {
    const stationId = 'station-uuid-0001-000000000001';
    mockFindTicketById.mockResolvedValue({ ...baseTicket, created_by: stationId });

    const result = await getTicketDetails(stationId, 'station', ticketId);
    expect(result.id).toBe(ticketId);
  });

  // --- Permission enforcement ---

  it('throws 403 AppError when a client requests another user ticket', async () => {
    await expect(
      getTicketDetails(otherUserId, 'client', ticketId)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 403 AppError when a station requests another user ticket', async () => {
    const stationId = 'station-uuid-0001-000000000001';
    await expect(
      getTicketDetails(stationId, 'station', ticketId)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  // --- Not found ---

  it('throws 404 AppError when ticket does not exist', async () => {
    mockFindTicketById.mockResolvedValue(undefined);

    await expect(
      getTicketDetails(userId, 'client', ticketId)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ---------------------------------------------------------------------------
// getSupportTickets
// ---------------------------------------------------------------------------

describe('getSupportTickets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListTickets.mockResolvedValue([baseTicket]);
  });

  it('passes only the userId filter for non-admin roles (client)', async () => {
    await getSupportTickets(userId, 'client');

    expect(mockListTickets).toHaveBeenCalledWith({ userId });
  });

  it('passes only the userId filter for non-admin roles (station)', async () => {
    const stationId = 'station-uuid-0001-000000000001';
    await getSupportTickets(stationId, 'station');

    expect(mockListTickets).toHaveBeenCalledWith({ userId: stationId });
  });

  it('does not include userId in the filter for admin (admin sees all tickets)', async () => {
    await getSupportTickets(adminId, 'admin');

    const call = mockListTickets.mock.calls[0][0] as { userId?: string };
    expect(call).not.toHaveProperty('userId');
  });

  it('adds status filter for non-admin when status is provided', async () => {
    await getSupportTickets(userId, 'client', 'ouvert');

    expect(mockListTickets).toHaveBeenCalledWith({ userId, status: 'ouvert' });
  });

  it('adds status filter for admin when status is provided', async () => {
    await getSupportTickets(adminId, 'admin', 'resolu');

    expect(mockListTickets).toHaveBeenCalledWith({ status: 'resolu' });
  });

  it('omits status filter when no status is given', async () => {
    await getSupportTickets(userId, 'client');

    const call = mockListTickets.mock.calls[0][0] as { status?: string };
    expect(call).not.toHaveProperty('status');
  });
});

// ---------------------------------------------------------------------------
// updateSupportTicketStatus
// ---------------------------------------------------------------------------

describe('updateSupportTicketStatus', () => {
  const updatedTicket = { ...baseTicket, status: 'resolu', resolved_at: now };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateTicketStatus.mockResolvedValue(updatedTicket);
  });

  it('delegates to the repository and returns the updated ticket', async () => {
    const result = await updateSupportTicketStatus(ticketId, 'resolu');

    expect(mockUpdateTicketStatus).toHaveBeenCalledWith(ticketId, 'resolu');
    expect(result.status).toBe('resolu');
  });

  it('forwards each valid status string without modification', async () => {
    for (const status of ['ouvert', 'en_cours', 'resolu', 'ferme']) {
      mockUpdateTicketStatus.mockResolvedValueOnce({ ...baseTicket, status });
      const result = await updateSupportTicketStatus(ticketId, status);
      expect(mockUpdateTicketStatus).toHaveBeenCalledWith(ticketId, status);
      expect(result.status).toBe(status);
    }
  });
});

// ---------------------------------------------------------------------------
// getSupportSettings
// ---------------------------------------------------------------------------

describe('getSupportSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns db settings merged with env fallback for support_email', async () => {
    mockGetSettings.mockResolvedValue({ max_open_tickets_per_user: '5' });

    const result = await getSupportSettings();

    expect(result.max_open_tickets_per_user).toBe('5');
    // support_email must be present (either from db or fallback).
    expect(typeof result.support_email).toBe('string');
    expect(result.support_email.length).toBeGreaterThan(0);
  });

  it('uses db support_email when present, ignoring env fallback', async () => {
    mockGetSettings.mockResolvedValue({ support_email: 'custom@example.com' });

    const result = await getSupportSettings();

    expect(result.support_email).toBe('custom@example.com');
  });

  it('falls back to the hardcoded default when db and env are both absent', async () => {
    mockGetSettings.mockResolvedValue({});
    const originalEnv = process.env.SUPPORT_EMAIL;
    delete process.env.SUPPORT_EMAIL;

    const result = await getSupportSettings();

    expect(result.support_email).toBe('support@lavo.ca');
    process.env.SUPPORT_EMAIL = originalEnv;
  });
});

// ---------------------------------------------------------------------------
// updateSupportSettings
// ---------------------------------------------------------------------------

describe('updateSupportSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateSetting.mockResolvedValue(undefined);
  });

  it('calls updateSetting once per key-value pair', async () => {
    await updateSupportSettings({
      support_email: 'help@lavo.ca',
      max_open_tickets_per_user: '3',
    });

    expect(mockUpdateSetting).toHaveBeenCalledTimes(2);
    expect(mockUpdateSetting).toHaveBeenCalledWith('support_email', 'help@lavo.ca');
    expect(mockUpdateSetting).toHaveBeenCalledWith('max_open_tickets_per_user', '3');
  });

  it('calls updateSetting zero times for an empty settings object', async () => {
    await updateSupportSettings({});

    expect(mockUpdateSetting).not.toHaveBeenCalled();
  });

  it('calls updateSetting exactly once for a single key', async () => {
    await updateSupportSettings({ support_email: 'ops@lavo.ca' });

    expect(mockUpdateSetting).toHaveBeenCalledTimes(1);
    expect(mockUpdateSetting).toHaveBeenCalledWith('support_email', 'ops@lavo.ca');
  });
});
