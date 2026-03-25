/**
 * API tests for GET + PATCH /api/v1/admin/support/settings.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockGetSupportSettings = jest.fn();
const mockUpdateSupportSettings = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/server/support/support-ticket-service', () => ({
  getSupportSettings: (...args: unknown[]) => mockGetSupportSettings(...args),
  updateSupportSettings: (...args: unknown[]) => mockUpdateSupportSettings(...args),
}));

import { GET, PATCH } from '@/app/api/v1/admin/support/settings/route';
import { AppError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const adminAuth = { sub: 'admin-uuid-0001', role: 'admin' };

const settingsFixture = {
  support_email: 'support@lavo.ca',
  max_open_tickets_per_user: '3',
};

function makeGetRequest(): Request {
  return new Request('http://localhost/api/v1/admin/support/settings');
}

function makePatchRequest(body?: unknown): Request {
  return new Request('http://localhost/api/v1/admin/support/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ---------------------------------------------------------------------------
// GET /api/v1/admin/support/settings
// ---------------------------------------------------------------------------

describe('GET /api/v1/admin/support/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(adminAuth);
    mockGetSupportSettings.mockResolvedValue(settingsFixture);
  });

  // --- Happy path ---

  it('returns 200 with all support settings', async () => {
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.support_email).toBe('support@lavo.ca');
    expect(body.data.max_open_tickets_per_user).toBe('3');
    expect(mockGetSupportSettings).toHaveBeenCalledTimes(1);
  });

  it('always includes support_email in the response (fallback enforced)', async () => {
    mockGetSupportSettings.mockResolvedValueOnce({ support_email: 'ops@lavo.ca' });

    const res = await GET(makeGetRequest());

    const body = await res.json();
    expect(body.data.support_email).toBeDefined();
    expect(typeof body.data.support_email).toBe('string');
  });

  // --- Auth: only admin ---

  it('returns 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
    );

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(401);
    expect(mockGetSupportSettings).not.toHaveBeenCalled();
  });

  it('returns 403 when role is not admin', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 })
    );

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(403);
    expect(mockGetSupportSettings).not.toHaveBeenCalled();
  });

  // --- Service errors ---

  it('maps AppError from service to a controlled response', async () => {
    mockGetSupportSettings.mockRejectedValueOnce(new AppError('Settings unavailable', 503));

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.message).toBe('Settings unavailable');
  });

  it('returns 500 on unexpected non-AppError exception', async () => {
    mockGetSupportSettings.mockRejectedValueOnce(new Error('DB read failure'));

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/admin/support/settings
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/admin/support/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(adminAuth);
    mockUpdateSupportSettings.mockResolvedValue(undefined);
  });

  // --- Happy path ---

  it('returns 200 on valid settings update with string values', async () => {
    const res = await PATCH(
      makePatchRequest({ support_email: 'help@lavo.ca', max_open_tickets_per_user: '5' })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({});
    expect(mockUpdateSupportSettings).toHaveBeenCalledWith({
      support_email: 'help@lavo.ca',
      max_open_tickets_per_user: '5',
    });
  });

  it('returns 200 on a single key update', async () => {
    const res = await PATCH(makePatchRequest({ support_email: 'new@lavo.ca' }));

    expect(res.status).toBe(200);
    expect(mockUpdateSupportSettings).toHaveBeenCalledWith({ support_email: 'new@lavo.ca' });
  });

  it('returns 200 on an empty settings object (no-op is valid)', async () => {
    const res = await PATCH(makePatchRequest({}));

    expect(res.status).toBe(200);
    expect(mockUpdateSupportSettings).toHaveBeenCalledWith({});
  });

  it('accepts the maximum allowed value length (500 chars) on a free-form key', async () => {
    // welcome_message has no semantic constraint beyond max length.
    const maxValue = 'A'.repeat(500);
    const res = await PATCH(makePatchRequest({ welcome_message: maxValue }));

    expect(res.status).toBe(200);
    expect(mockUpdateSupportSettings).toHaveBeenCalledWith({ welcome_message: maxValue });
  });

  // --- Per-key semantic validation ---

  it('returns 400 when support_email is not a valid email address', async () => {
    const res = await PATCH(makePatchRequest({ support_email: 'not-an-email' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpdateSupportSettings).not.toHaveBeenCalled();
  });

  it('returns 400 when support_email is an empty string (not a valid email)', async () => {
    const res = await PATCH(makePatchRequest({ support_email: '' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpdateSupportSettings).not.toHaveBeenCalled();
  });

  it('accepts a valid support_email value', async () => {
    const res = await PATCH(makePatchRequest({ support_email: 'ops@lavo.ca' }));

    expect(res.status).toBe(200);
    expect(mockUpdateSupportSettings).toHaveBeenCalledWith({ support_email: 'ops@lavo.ca' });
  });

  it('returns 400 when max_open_tickets_per_user is a negative integer string', async () => {
    const res = await PATCH(makePatchRequest({ max_open_tickets_per_user: '-1' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpdateSupportSettings).not.toHaveBeenCalled();
  });

  it('returns 400 when max_open_tickets_per_user is a decimal string', async () => {
    const res = await PATCH(makePatchRequest({ max_open_tickets_per_user: '3.5' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpdateSupportSettings).not.toHaveBeenCalled();
  });

  it('returns 400 when max_open_tickets_per_user is a non-numeric string', async () => {
    const res = await PATCH(makePatchRequest({ max_open_tickets_per_user: 'unlimited' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpdateSupportSettings).not.toHaveBeenCalled();
  });

  it('accepts max_open_tickets_per_user = "0" (hard block — no open tickets allowed)', async () => {
    const res = await PATCH(makePatchRequest({ max_open_tickets_per_user: '0' }));

    expect(res.status).toBe(200);
    expect(mockUpdateSupportSettings).toHaveBeenCalledWith({ max_open_tickets_per_user: '0' });
  });

  it('accepts a valid positive integer for max_open_tickets_per_user', async () => {
    const res = await PATCH(makePatchRequest({ max_open_tickets_per_user: '5' }));

    expect(res.status).toBe(200);
    expect(mockUpdateSupportSettings).toHaveBeenCalledWith({ max_open_tickets_per_user: '5' });
  });

  it('returns 400 when auto_close_days is zero (must be a positive integer)', async () => {
    const res = await PATCH(makePatchRequest({ auto_close_days: '0' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpdateSupportSettings).not.toHaveBeenCalled();
  });

  it('returns 400 when auto_close_days is a negative integer string', async () => {
    const res = await PATCH(makePatchRequest({ auto_close_days: '-5' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpdateSupportSettings).not.toHaveBeenCalled();
  });

  it('accepts a valid positive integer for auto_close_days', async () => {
    const res = await PATCH(makePatchRequest({ auto_close_days: '30' }));

    expect(res.status).toBe(200);
    expect(mockUpdateSupportSettings).toHaveBeenCalledWith({ auto_close_days: '30' });
  });

  // --- Validation: value constraints ---

  it('returns 400 when a value exceeds 500 characters', async () => {
    const tooLong = 'X'.repeat(501);
    const res = await PATCH(makePatchRequest({ support_email: tooLong }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpdateSupportSettings).not.toHaveBeenCalled();
  });

  it('returns 400 when a value is a number instead of a string', async () => {
    const res = await PATCH(makePatchRequest({ max_open_tickets_per_user: 5 }));

    expect(res.status).toBe(400);
    expect(mockUpdateSupportSettings).not.toHaveBeenCalled();
  });

  it('returns 400 when a value is null', async () => {
    const res = await PATCH(makePatchRequest({ support_email: null }));

    expect(res.status).toBe(400);
    expect(mockUpdateSupportSettings).not.toHaveBeenCalled();
  });

  it('returns 400 when a value is a boolean instead of a string', async () => {
    const res = await PATCH(makePatchRequest({ enabled: true }));

    expect(res.status).toBe(400);
    expect(mockUpdateSupportSettings).not.toHaveBeenCalled();
  });

  it('returns 400 when the body itself is an array instead of an object', async () => {
    const res = await PATCH(makePatchRequest(['key', 'value']));

    expect(res.status).toBe(400);
    expect(mockUpdateSupportSettings).not.toHaveBeenCalled();
  });

  // --- Hostile: malformed body ---

  it('returns 500 on malformed (non-JSON) body', async () => {
    const req = new Request('http://localhost/api/v1/admin/support/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json-at-all',
    });

    const res = await PATCH(req);

    expect(res.status).toBe(500);
    expect(mockUpdateSupportSettings).not.toHaveBeenCalled();
  });

  // --- Auth: only admin ---

  it('returns 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
    );

    const res = await PATCH(makePatchRequest({ support_email: 'hack@evil.com' }));

    expect(res.status).toBe(401);
    expect(mockUpdateSupportSettings).not.toHaveBeenCalled();
  });

  it('returns 403 when role is not admin', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 })
    );

    const res = await PATCH(makePatchRequest({ support_email: 'hack@evil.com' }));

    expect(res.status).toBe(403);
    expect(mockUpdateSupportSettings).not.toHaveBeenCalled();
  });

  // --- Service errors ---

  it('maps AppError from service to a controlled response', async () => {
    mockUpdateSupportSettings.mockRejectedValueOnce(new AppError('Write conflict', 409));

    const res = await PATCH(makePatchRequest({ support_email: 'ops@lavo.ca' }));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toBe('Write conflict');
  });

  it('returns 500 on unexpected non-AppError exception from service', async () => {
    mockUpdateSupportSettings.mockRejectedValueOnce(new Error('Unexpected DB failure'));

    const res = await PATCH(makePatchRequest({ support_email: 'ops@lavo.ca' }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});
