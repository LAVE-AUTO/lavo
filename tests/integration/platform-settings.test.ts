/**
 * Integration tests for PATCH /api/v1/admin/settings.
 *
 * Focus:
 *   - Single platform rate provided → complementary station rate auto-calculated (sync)
 *   - Both rates provided but not summing to 1.00 → 400 validation error
 *   - Happy path: valid settings update returns 200
 *   - Auth guard: 401/403 for non-admin callers
 *
 * @jest-environment node
 */

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

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

// The endpoint rate limiter is in-memory and must not block tests.
jest.mock('@/lib/endpoint-rate-limiter', () => ({
  createEndpointRateLimiter: () => ({
    isRateLimited: () => false,
  }),
}));

import { GET, PATCH } from '@/app/api/v1/admin/settings/route';
import { ValidationError, AppError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ADMIN_AUTH = { sub: 'admin-uuid-0001', role: 'admin', force_password_change: false };

const SETTINGS_ROWS = [
  { key: 'cancellation_free_window_minutes', value: '60', updated_at: new Date().toISOString(), updated_by: ADMIN_AUTH.sub },
  { key: 'cancellation_penalty_percent', value: '20', updated_at: new Date().toISOString(), updated_by: ADMIN_AUTH.sub },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(): Request {
  return new Request('http://localhost/api/v1/admin/settings', { method: 'GET' });
}

function makePatchRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/admin/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeMalformedPatchRequest(): Request {
  return new Request('http://localhost/api/v1/admin/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json',
  });
}

// ---------------------------------------------------------------------------
// GET /api/v1/admin/settings
// ---------------------------------------------------------------------------

describe('GET /api/v1/admin/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(ADMIN_AUTH);
    mockGetAllPlatformSettings.mockResolvedValue(SETTINGS_ROWS);
  });

  it('returns 200 with all configured settings', async () => {
    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual(SETTINGS_ROWS);
    expect(mockGetAllPlatformSettings).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unauthorized', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
    expect(mockGetAllPlatformSettings).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected service failure', async () => {
    mockGetAllPlatformSettings.mockRejectedValue(new Error('DB connection lost'));

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/admin/settings
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/admin/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(ADMIN_AUTH);
    mockUpdatePlatformSettings.mockResolvedValue(undefined);
  });

  // --- Happy path ---

  it('returns 200 with success message on valid update', async () => {
    const res = await PATCH(makePatchRequest({ cancellation_free_window_minutes: '60' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe('Platform settings updated');
    expect(body.data).toEqual({});
    expect(mockUpdatePlatformSettings).toHaveBeenCalledWith(
      expect.objectContaining({ cancellation_free_window_minutes: '60' }),
      ADMIN_AUTH.sub
    );
  });

  // --- Penalty rate auto-sync: single platform rate provided ---

  it('returns 200 when only cancellation_penalty_platform_rate is provided (station rate auto-sync)', async () => {
    const res = await PATCH(makePatchRequest({ cancellation_penalty_platform_rate: '0.70' }));
    const body = await res.json();

    // The schema validates the single rate value is in [0,1] and the service
    // auto-calculates the complementary station rate. We assert on the handler
    // response only — the service mock call receives whatever the handler sends.
    expect(res.status).toBe(200);
    expect(body.message).toBe('Platform settings updated');
    expect(mockUpdatePlatformSettings).toHaveBeenCalledWith(
      expect.objectContaining({ cancellation_penalty_platform_rate: '0.70' }),
      ADMIN_AUTH.sub
    );
  });

  it('returns 200 when only cancellation_penalty_station_rate is provided (platform rate auto-sync)', async () => {
    const res = await PATCH(makePatchRequest({ cancellation_penalty_station_rate: '0.30' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe('Platform settings updated');
    expect(mockUpdatePlatformSettings).toHaveBeenCalledWith(
      expect.objectContaining({ cancellation_penalty_station_rate: '0.30' }),
      ADMIN_AUTH.sub
    );
  });

  // --- Penalty rate validation: both rates not summing to 1.00 ---

  it('returns 400 when both rates are provided but do not sum to 1.00', async () => {
    // Schema-level cross-key constraint: 0.70 + 0.40 = 1.10 != 1.00
    const res = await PATCH(makePatchRequest({
      cancellation_penalty_platform_rate: '0.70',
      cancellation_penalty_station_rate: '0.40',
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpdatePlatformSettings).not.toHaveBeenCalled();
  });

  it('returns 200 when both rates are provided and sum exactly to 1.00', async () => {
    const res = await PATCH(makePatchRequest({
      cancellation_penalty_platform_rate: '0.70',
      cancellation_penalty_station_rate: '0.30',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe('Platform settings updated');
  });

  it('returns 400 when service raises ValidationError for rates not summing to 1.00', async () => {
    // Service-level enforcement in case the validator is bypassed.
    mockUpdatePlatformSettings.mockRejectedValue(
      new ValidationError('cancellation_penalty_platform_rate and cancellation_penalty_station_rate must sum to 1.00')
    );

    const res = await PATCH(makePatchRequest({
      cancellation_penalty_platform_rate: '0.60',
      cancellation_penalty_station_rate: '0.30',
    }));
    const body = await res.json();

    // A ValidationError from the service has statusCode 400 and maps to VALIDATION_FAILED
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  // --- Input validation ---

  it('returns 400 for malformed JSON body', async () => {
    const res = await PATCH(makeMalformedPatchRequest());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpdatePlatformSettings).not.toHaveBeenCalled();
  });

  it('returns 400 when body is an empty object (no keys)', async () => {
    const res = await PATCH(makePatchRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when an unknown setting key is provided', async () => {
    const res = await PATCH(makePatchRequest({ unknown_setting_key: 'value' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when max_advance_booking_days exceeds the Stripe auth limit', async () => {
    // MAX_STRIPE_AUTH_DAYS = 7; value 8 is out of range
    const res = await PATCH(makePatchRequest({ max_advance_booking_days: '8' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when cancellation_penalty_percent is not a valid decimal', async () => {
    const res = await PATCH(makePatchRequest({ cancellation_penalty_percent: 'not-a-number' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  // --- Auth ---

  it('returns 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unauthorized', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await PATCH(makePatchRequest({ cancellation_free_window_minutes: '60' }));
    expect(res.status).toBe(401);
    expect(mockUpdatePlatformSettings).not.toHaveBeenCalled();
  });

  it('returns 403 when caller is not an admin', async () => {
    mockRequireRole.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Forbidden', code: 'FORBIDDEN' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await PATCH(makePatchRequest({ cancellation_free_window_minutes: '60' }));
    expect(res.status).toBe(403);
    expect(mockUpdatePlatformSettings).not.toHaveBeenCalled();
  });

  // --- Service errors ---

  it('returns 500 on unexpected service failure without leaking error details', async () => {
    mockUpdatePlatformSettings.mockRejectedValue(new Error('Unexpected DB failure'));

    const res = await PATCH(makePatchRequest({ cancellation_free_window_minutes: '60' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('Unexpected DB failure');
  });
});
