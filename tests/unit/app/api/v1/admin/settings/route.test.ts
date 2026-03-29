/**
 * Unit tests for GET /api/v1/admin/settings and PATCH /api/v1/admin/settings.
 *
 * Test coverage:
 *   - GET: happy path (returns all settings), empty result, security headers, auth
 *   - PATCH: valid updates, validation errors, cross-key constraints, auth, error handling
 *
 * @jest-environment node
 */

// %%%%% Mocks %%%%%
// Service and auth module mocks

const mockRequireRole = jest.fn();
const mockGetAllPlatformSettings = jest.fn();
const mockUpdatePlatformSettings = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/server/admin/platform-settings-service', () => ({
  getAllPlatformSettings: (...args: unknown[]) => mockGetAllPlatformSettings(...args),
  updatePlatformSettings: (...args: unknown[]) => mockUpdatePlatformSettings(...args),
}));

import { GET, PATCH } from '@/app/api/v1/admin/settings/route';
import { AppError } from '@/lib/errors';


// %%%%% Fixtures %%%%%
// Mock data and test utilities

/** Mock admin authentication token. */
const adminAuth = { sub: 'admin-uuid-0001', role: 'admin' };

/** Sample platform setting rows returned by the service. */
const settingsFixture = [
  {
    key: 'cancellation_penalty_percent',
    value: '20.00',
    updated_at: new Date('2026-03-28T10:00:00.000Z'),
    updated_by: { id: 'admin-uuid-0001', first_name: 'Jean', last_name: 'Admin' },
  },
  {
    key: 'max_tip_amount_xaf',
    value: '500',
    updated_at: new Date('2026-03-28T10:00:00.000Z'),
    updated_by: null,
  },
];


// %%%%% Test utilities %%%%%
// Request builders

function makeGetRequest(): Request {
  return new Request('http://localhost/api/v1/admin/settings');
}

function makePatchRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/admin/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makePatchRequestRaw(body: string): Request {
  return new Request('http://localhost/api/v1/admin/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}


// %%%%% Test suite: GET /api/v1/admin/settings %%%%%
// Retrieve all configured settings with audit metadata

describe('GET /api/v1/admin/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(adminAuth);
    mockGetAllPlatformSettings.mockResolvedValue(settingsFixture);
  });

  // ---- Happy path ----

  it('returns 200 with an array of setting rows', async () => {
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].key).toBe('cancellation_penalty_percent');
    expect(body.data[0].value).toBe('20.00');
    expect(body.data[0].updated_by).not.toBeNull();
    expect(body.data[1].updated_by).toBeNull();
    expect(mockGetAllPlatformSettings).toHaveBeenCalledTimes(1);
  });

  it('returns 200 with an empty array when no settings are configured yet', async () => {
    mockGetAllPlatformSettings.mockResolvedValueOnce([]);

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  // ---- Security headers ----

  it('sets Cache-Control: private, no-store on a 200 response', async () => {
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const cc = res.headers.get('Cache-Control');
    expect(cc).toContain('private');
    expect(cc).toContain('no-store');
    expect(cc).not.toContain('max-age');
  });

  it('includes X-Content-Type-Options, X-Frame-Options, Referrer-Policy on 200', async () => {
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
  });

  // --- Authentication / authorization ---

  it('returns 401 when requireRole returns a 401 Response', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
    );

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(401);
    expect(mockGetAllPlatformSettings).not.toHaveBeenCalled();
  });

  it('returns 403 when requireRole returns a 403 Response', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 })
    );

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(403);
    expect(mockGetAllPlatformSettings).not.toHaveBeenCalled();
  });

  // --- Error handling ---

  it('maps AppError from service to a controlled response', async () => {
    mockGetAllPlatformSettings.mockRejectedValueOnce(new AppError('DB unavailable', 503));

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.message).toBe('DB unavailable');
  });

  it('returns 500 on unexpected non-AppError exception', async () => {
    mockGetAllPlatformSettings.mockRejectedValueOnce(new Error('Connection timeout'));

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});

describe('PATCH /api/v1/admin/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(adminAuth);
    mockUpdatePlatformSettings.mockResolvedValue(undefined);
  });

  // --- Happy path ---

  it('returns 200 with success message on valid partial update', async () => {
    const res = await PATCH(makePatchRequest({ cancellation_penalty_percent: '25.50' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('Platform settings updated');
    expect(body.data).toEqual({});
    expect(mockUpdatePlatformSettings).toHaveBeenCalledWith(
      { cancellation_penalty_percent: '25.50' },
      'admin-uuid-0001'
    );
  });

  it('accepts multiple valid keys in one request', async () => {
    const payload = {
      cancellation_penalty_percent: '15.00',
      max_tip_amount_xaf: '1000',
      rating_window_days: '14',
    };

    const res = await PATCH(makePatchRequest(payload));

    expect(res.status).toBe(200);
    expect(mockUpdatePlatformSettings).toHaveBeenCalledWith(payload, 'admin-uuid-0001');
  });

  it('accepts valid platform and station rates that sum to 1.00', async () => {
    const payload = {
      cancellation_penalty_platform_rate: '0.60',
      cancellation_penalty_station_rate: '0.40',
    };

    const res = await PATCH(makePatchRequest(payload));

    expect(res.status).toBe(200);
  });

  it('accepts valid email settings', async () => {
    const payload = {
      admin_notification_email: 'admin@example.com',
      weekly_report_email: 'weekly@example.com',
    };

    const res = await PATCH(makePatchRequest(payload));

    expect(res.status).toBe(200);
  });

  // --- Security headers ---

  it('sets no-store cache headers on a 200 PATCH response', async () => {
    const res = await PATCH(makePatchRequest({ max_tip_amount_xaf: '500' }));

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  // --- Authentication / authorization ---

  it('returns 403 when requireRole returns a 403 Response', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 })
    );

    const res = await PATCH(makePatchRequest({ max_tip_amount_xaf: '500' }));

    expect(res.status).toBe(403);
    expect(mockUpdatePlatformSettings).not.toHaveBeenCalled();
  });

  it('returns 401 when requireRole returns a 401 Response', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
    );

    const res = await PATCH(makePatchRequest({ max_tip_amount_xaf: '500' }));

    expect(res.status).toBe(401);
    expect(mockUpdatePlatformSettings).not.toHaveBeenCalled();
  });

  // --- 400: malformed JSON ---

  it('returns 400 on malformed JSON body', async () => {
    const res = await PATCH(makePatchRequestRaw('{invalid json'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpdatePlatformSettings).not.toHaveBeenCalled();
  });

  // --- 400: empty body / missing keys ---

  it('returns 400 when body is an empty object (no keys)', async () => {
    const res = await PATCH(makePatchRequest({}));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpdatePlatformSettings).not.toHaveBeenCalled();
  });

  // --- 400: unknown key ---

  it('returns 400 when an unknown key is included', async () => {
    const res = await PATCH(makePatchRequest({ unknown_key_xyz: '123' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpdatePlatformSettings).not.toHaveBeenCalled();
  });

  // --- 400: per-key semantic validation ---

  it('returns 400 when cancellation_penalty_percent is out of range (> 100)', async () => {
    const res = await PATCH(makePatchRequest({ cancellation_penalty_percent: '101' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toContainEqual(
      expect.objectContaining({ field: 'cancellation_penalty_percent' })
    );
  });

  it('returns 400 when cancellation_penalty_percent has more than 2 decimal places', async () => {
    const res = await PATCH(makePatchRequest({ cancellation_penalty_percent: '20.123' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toContainEqual(
      expect.objectContaining({ field: 'cancellation_penalty_percent' })
    );
  });

  it('returns 400 when cancellation_penalty_platform_rate is greater than 1', async () => {
    const res = await PATCH(makePatchRequest({ cancellation_penalty_platform_rate: '1.5' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toContainEqual(
      expect.objectContaining({ field: 'cancellation_penalty_platform_rate' })
    );
  });

  it('returns 400 when max_advance_booking_days is 0 (below minimum 1)', async () => {
    const res = await PATCH(makePatchRequest({ max_advance_booking_days: '0' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toContainEqual(
      expect.objectContaining({ field: 'max_advance_booking_days' })
    );
  });

  it('returns 400 when max_advance_booking_days is 8 (above maximum 7)', async () => {
    const res = await PATCH(makePatchRequest({ max_advance_booking_days: '8' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toContainEqual(
      expect.objectContaining({ field: 'max_advance_booking_days' })
    );
  });

  it('returns 400 when rating_window_days is 0 (below minimum 1)', async () => {
    const res = await PATCH(makePatchRequest({ rating_window_days: '0' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toContainEqual(
      expect.objectContaining({ field: 'rating_window_days' })
    );
  });

  it('returns 400 when default_late_tolerance_minutes is a negative integer', async () => {
    const res = await PATCH(makePatchRequest({ default_late_tolerance_minutes: '-1' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toContainEqual(
      expect.objectContaining({ field: 'default_late_tolerance_minutes' })
    );
  });

  it('returns 400 when max_tip_amount_xaf is negative', async () => {
    const res = await PATCH(makePatchRequest({ max_tip_amount_xaf: '-5' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toContainEqual(
      expect.objectContaining({ field: 'max_tip_amount_xaf' })
    );
  });

  it('returns 400 when reminder_first_window_hours is 0 (below minimum 1)', async () => {
    const res = await PATCH(makePatchRequest({ reminder_first_window_hours: '0' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toContainEqual(
      expect.objectContaining({ field: 'reminder_first_window_hours' })
    );
  });

  it('returns 400 when reminder_second_window_minutes is 4 (below minimum 5)', async () => {
    const res = await PATCH(makePatchRequest({ reminder_second_window_minutes: '4' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toContainEqual(
      expect.objectContaining({ field: 'reminder_second_window_minutes' })
    );
  });

  it('returns 400 when admin_notification_email is not a valid email', async () => {
    const res = await PATCH(makePatchRequest({ admin_notification_email: 'not-an-email' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toContainEqual(
      expect.objectContaining({ field: 'admin_notification_email' })
    );
  });

  it('returns 400 when weekly_report_email is not a valid email', async () => {
    const res = await PATCH(makePatchRequest({ weekly_report_email: 'bad@@email' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toContainEqual(
      expect.objectContaining({ field: 'weekly_report_email' })
    );
  });

  it('returns 400 when max_rating_comment_length is below 50', async () => {
    const res = await PATCH(makePatchRequest({ max_rating_comment_length: '10' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toContainEqual(
      expect.objectContaining({ field: 'max_rating_comment_length' })
    );
  });

  it('returns 400 when max_rating_comment_length is above 5000', async () => {
    const res = await PATCH(makePatchRequest({ max_rating_comment_length: '5001' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toContainEqual(
      expect.objectContaining({ field: 'max_rating_comment_length' })
    );
  });

  it('returns 400 when max_support_message_length is below 100', async () => {
    const res = await PATCH(makePatchRequest({ max_support_message_length: '50' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toContainEqual(
      expect.objectContaining({ field: 'max_support_message_length' })
    );
  });

  it('returns 400 when max_support_message_length is above 10000', async () => {
    const res = await PATCH(makePatchRequest({ max_support_message_length: '10001' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toContainEqual(
      expect.objectContaining({ field: 'max_support_message_length' })
    );
  });

  // --- 400: cross-key constraint ---

  it('returns 400 when platform_rate + station_rate do not sum to 1.00', async () => {
    const res = await PATCH(
      makePatchRequest({
        cancellation_penalty_platform_rate: '0.60',
        cancellation_penalty_station_rate: '0.60',
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.errors).toContainEqual(
      expect.objectContaining({ field: 'cancellation_penalty_platform_rate' })
    );
    expect(mockUpdatePlatformSettings).not.toHaveBeenCalled();
  });

  it('returns 400 when platform_rate = 0.30 and station_rate = 0.30 (sum = 0.60)', async () => {
    const res = await PATCH(
      makePatchRequest({
        cancellation_penalty_platform_rate: '0.30',
        cancellation_penalty_station_rate: '0.30',
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toContainEqual(
      expect.objectContaining({ field: 'cancellation_penalty_platform_rate' })
    );
  });

  // --- Error handling ---

  it('maps AppError from service to a controlled response', async () => {
    mockUpdatePlatformSettings.mockRejectedValueOnce(new AppError('DB write failed', 503));

    const res = await PATCH(makePatchRequest({ max_tip_amount_xaf: '500' }));

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.message).toBe('DB write failed');
  });

  it('returns 500 on unexpected non-AppError exception from service', async () => {
    mockUpdatePlatformSettings.mockRejectedValueOnce(new Error('Disk full'));

    const res = await PATCH(makePatchRequest({ max_tip_amount_xaf: '500' }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});
