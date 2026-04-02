/**
 * Integration tests for the legal content API.
 *
 * GET  /api/v1/admin/legal/:key
 * PATCH /api/v1/admin/legal/:key
 *
 * Supported keys: cgu | politique_confidentialite | mentions_legales
 *
 * Tests:
 *   - GET returns { key, content: null } for a key that has never been written
 *   - PATCH updates and returns the sanitized content
 *   - Invalid key in URL param → 400 VALIDATION_FAILED
 *   - Auth guard: 401 for unauthenticated callers
 *
 * @jest-environment node
 */

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const mockRequireRole = jest.fn();
const mockGetLegalContent = jest.fn();
const mockUpdateLegalContent = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/server/admin/legal-content-service', () => ({
  getLegalContent: (...args: unknown[]) => mockGetLegalContent(...args),
  updateLegalContent: (...args: unknown[]) => mockUpdateLegalContent(...args),
}));

// The endpoint rate limiter is in-memory and must not block tests.
jest.mock('@/lib/endpoint-rate-limiter', () => ({
  createEndpointRateLimiter: () => ({
    isRateLimited: () => false,
  }),
}));

import { GET, PATCH } from '@/app/api/v1/admin/legal/[key]/route';
import { AppError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ADMIN_AUTH = { sub: 'admin-uuid-0001', role: 'admin', force_password_change: false };

const CGU_CONTENT = '<h1>Conditions Générales d\'Utilisation</h1><p>Le présent document...</p>';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wraps params in a Promise as the route handler expects:
 *   { params: Promise<{ key: string }> }
 */
function makeParams(key: string): { params: Promise<{ key: string }> } {
  return { params: Promise.resolve({ key }) };
}

function makeGetRequest(key: string): Request {
  return new Request(`http://localhost/api/v1/admin/legal/${key}`, { method: 'GET' });
}

function makePatchRequest(key: string, body: unknown): Request {
  return new Request(`http://localhost/api/v1/admin/legal/${key}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeMalformedPatchRequest(key: string): Request {
  return new Request(`http://localhost/api/v1/admin/legal/${key}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json',
  });
}

// ---------------------------------------------------------------------------
// GET /api/v1/admin/legal/:key
// ---------------------------------------------------------------------------

describe('GET /api/v1/admin/legal/:key', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(ADMIN_AUTH);
  });

  // --- Happy path: configured key ---

  it('returns 200 with key and content when the document is configured', async () => {
    mockGetLegalContent.mockResolvedValue(CGU_CONTENT);

    const res = await GET(makeGetRequest('cgu'), makeParams('cgu'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.key).toBe('cgu');
    expect(body.data.content).toBe(CGU_CONTENT);
    expect(mockGetLegalContent).toHaveBeenCalledWith('cgu');
  });

  // --- Unconfigured key: content must be null ---

  it('returns 200 with content=null when the key has never been written', async () => {
    mockGetLegalContent.mockResolvedValue(null);

    const res = await GET(makeGetRequest('politique_confidentialite'), makeParams('politique_confidentialite'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.key).toBe('politique_confidentialite');
    expect(body.data.content).toBeNull();
  });

  it('returns 200 with content=null for mentions_legales when not yet set', async () => {
    mockGetLegalContent.mockResolvedValue(null);

    const res = await GET(makeGetRequest('mentions_legales'), makeParams('mentions_legales'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.content).toBeNull();
  });

  // --- Invalid key in URL ---

  it('returns 400 VALIDATION_FAILED when key is not a supported legal content key', async () => {
    const res = await GET(makeGetRequest('invalid_key'), makeParams('invalid_key'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockGetLegalContent).not.toHaveBeenCalled();
  });

  it('returns 400 for an arbitrary string that is not in the allowed key set', async () => {
    const res = await GET(makeGetRequest('terms_and_conditions'), makeParams('terms_and_conditions'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  // --- Auth ---

  it('returns 401 when the request is unauthenticated', async () => {
    mockRequireRole.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unauthorized', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await GET(makeGetRequest('cgu'), makeParams('cgu'));
    expect(res.status).toBe(401);
    expect(mockGetLegalContent).not.toHaveBeenCalled();
  });

  // --- Service errors ---

  it('returns 500 on unexpected service failure', async () => {
    mockGetLegalContent.mockRejectedValue(new Error('DB query failed'));

    const res = await GET(makeGetRequest('cgu'), makeParams('cgu'));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/admin/legal/:key
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/admin/legal/:key', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(ADMIN_AUTH);
    mockUpdateLegalContent.mockResolvedValue(undefined);
    // Re-read returns the stored (sanitized) content
    mockGetLegalContent.mockResolvedValue(CGU_CONTENT);
  });

  // --- Happy path: update returns sanitized content ---

  it('returns 200 with sanitized content after a successful update', async () => {
    const res = await PATCH(
      makePatchRequest('cgu', { content: CGU_CONTENT }),
      makeParams('cgu')
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.key).toBe('cgu');
    // The stored (sanitized) value is returned via a subsequent getLegalContent call.
    expect(body.data.content).toBe(CGU_CONTENT);
    expect(mockUpdateLegalContent).toHaveBeenCalledWith('cgu', CGU_CONTENT, ADMIN_AUTH.sub);
  });

  it('calls updateLegalContent with the authenticated admin id', async () => {
    await PATCH(
      makePatchRequest('politique_confidentialite', { content: 'Privacy policy content' }),
      makeParams('politique_confidentialite')
    );

    const [key, , adminId] = mockUpdateLegalContent.mock.calls[0] as [string, string, string];
    expect(key).toBe('politique_confidentialite');
    expect(adminId).toBe(ADMIN_AUTH.sub);
  });

  it('returns content from the re-read (post-sanitization) call', async () => {
    const sanitized = '<p>Sanitized CGU</p>';
    mockGetLegalContent.mockResolvedValue(sanitized);

    const res = await PATCH(
      makePatchRequest('cgu', { content: '<script>alert(1)</script><p>CGU</p>' }),
      makeParams('cgu')
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.content).toBe(sanitized);
  });

  // --- Invalid key in URL ---

  it('returns 400 VALIDATION_FAILED when URL key is not supported', async () => {
    const res = await PATCH(
      makePatchRequest('unknown_key', { content: 'Some content' }),
      makeParams('unknown_key')
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpdateLegalContent).not.toHaveBeenCalled();
  });

  // --- Input validation ---

  it('returns 400 for malformed JSON body', async () => {
    const res = await PATCH(makeMalformedPatchRequest('cgu'), makeParams('cgu'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpdateLegalContent).not.toHaveBeenCalled();
  });

  it('returns 400 when content field is missing', async () => {
    const res = await PATCH(makePatchRequest('cgu', {}), makeParams('cgu'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpdateLegalContent).not.toHaveBeenCalled();
  });

  it('returns 400 when content is an empty string', async () => {
    const res = await PATCH(makePatchRequest('cgu', { content: '' }), makeParams('cgu'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpdateLegalContent).not.toHaveBeenCalled();
  });

  it('returns 400 when body contains unknown fields (strict mode)', async () => {
    const res = await PATCH(
      makePatchRequest('cgu', { content: 'Valid content', extra_field: 'should be rejected' }),
      makeParams('cgu')
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  // --- Auth ---

  it('returns 401 when the request is unauthenticated', async () => {
    mockRequireRole.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unauthorized', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await PATCH(
      makePatchRequest('cgu', { content: 'Some content' }),
      makeParams('cgu')
    );
    expect(res.status).toBe(401);
    expect(mockUpdateLegalContent).not.toHaveBeenCalled();
  });

  it('returns 403 when caller is not an admin', async () => {
    mockRequireRole.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Forbidden', code: 'FORBIDDEN' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await PATCH(
      makePatchRequest('cgu', { content: 'Some content' }),
      makeParams('cgu')
    );
    expect(res.status).toBe(403);
    expect(mockUpdateLegalContent).not.toHaveBeenCalled();
  });

  // --- Service errors ---

  it('returns 500 on unexpected service failure without leaking error details', async () => {
    mockUpdateLegalContent.mockRejectedValue(new Error('Unexpected persistence failure'));

    const res = await PATCH(
      makePatchRequest('cgu', { content: 'Some content' }),
      makeParams('cgu')
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('Unexpected persistence failure');
  });
});
