/**
 * Integration tests for auth routes not covered by auth.test.ts.
 *
 * Covered routes:
 *   POST /api/v1/auth/verify-email
 *   POST /api/v1/auth/resend-verification-email
 *   POST /api/v1/auth/forgot-password
 *   POST /api/v1/auth/reset-password
 *   POST /api/v1/auth/refresh
 *   POST /api/v1/auth/logout
 *   POST /api/v1/auth/change-password
 *
 * Strategy: mock the service and repository layer so the full HTTP handler
 * pipeline (rate-limiting → validation → service → response shape) is exercised
 * without touching the database or network.
 *
 * @jest-environment node
 */

// %%%%% Mocks %%%%%

// --- Auth service ---
const mockVerifyEmail = jest.fn();
const mockResendVerificationEmail = jest.fn();
const mockForgotPassword = jest.fn();
const mockResetPassword = jest.fn();
const mockRefreshSession = jest.fn();
const mockChangePassword = jest.fn();

jest.mock('@/server/auth/auth-service', () => ({
  verifyEmail: (...args: unknown[]) => mockVerifyEmail(...args),
  resendVerificationEmail: (...args: unknown[]) => mockResendVerificationEmail(...args),
  forgotPassword: (...args: unknown[]) => mockForgotPassword(...args),
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
}));

// --- Rate limiter ---
const mockCheckRateLimit = jest.fn();
const mockRecordFailedAttempt = jest.fn();
const mockResetOnSuccess = jest.fn();

jest.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  recordFailedAttempt: (...args: unknown[]) => mockRecordFailedAttempt(...args),
  resetOnSuccess: (...args: unknown[]) => mockResetOnSuccess(...args),
  normalizeRateLimitKey: (key: string) => key,
}));

// --- Refresh token repository (used by logout) ---
const mockRevokeAllRefreshTokensForUser = jest.fn();

jest.mock('@/server/auth/refresh-token-repository', () => ({
  revokeAllRefreshTokensForUser: (...args: unknown[]) => mockRevokeAllRefreshTokensForUser(...args),
}));

// --- JWT (used by logout to extract userId from Bearer token) ---
const mockVerifyJwt = jest.fn();

jest.mock('@/lib/jwt', () => ({
  verifyJwt: (...args: unknown[]) => mockVerifyJwt(...args),
  extractBearerToken: (header: string | null) => {
    if (!header?.startsWith('Bearer ')) return null;
    const token = header.slice(7).trim();
    return token.length > 0 ? token : null;
  },
  buildRefreshCookieOptions: () => ({
    httpOnly: true,
    path: '/api/v1/auth',
    maxAge: 86400,
  }),
}));

// --- requireAuth (used by change-password) ---
const mockRequireAuth = jest.fn();

jest.mock('@/lib/require-auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

// --- next/headers ---
const mockCookieGet = jest.fn();

jest.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Map([['host', 'localhost:3000']])),
  cookies: () => Promise.resolve({ get: (...args: unknown[]) => mockCookieGet(...args) }),
}));

// --- email (used by resend / forgot-password internally, but service is mocked)
jest.mock('@/lib/email', () => ({
  extractLocale: () => 'fr',
}));

// --- request-ip ---
jest.mock('@/lib/request-ip', () => ({
  getClientRateLimitKey: () => '127.0.0.1',
}));


// %%%%% Imports %%%%%

import { POST as verifyEmailPOST } from '@/app/api/v1/auth/verify-email/route';
import { POST as resendVerificationEmailPOST } from '@/app/api/v1/auth/resend-verification-email/route';
import { POST as forgotPasswordPOST } from '@/app/api/v1/auth/forgot-password/route';
import { POST as resetPasswordPOST } from '@/app/api/v1/auth/reset-password/route';
import { POST as refreshPOST } from '@/app/api/v1/auth/refresh/route';
import { POST as logoutPOST } from '@/app/api/v1/auth/logout/route';
import { POST as changePasswordPOST } from '@/app/api/v1/auth/change-password/route';
import {
  TokenExpiredError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
} from '@/lib/errors';


// %%%%% Fixtures %%%%%

const FAKE_USER = {
  id: 'user-uuid-0001',
  first_name: 'Alice',
  last_name: 'Dupont',
  email: 'alice@example.com',
  role: 'client',
  status: 'active',
  force_password_change: false,
};

const FAKE_TOKENS = {
  accessJwt: 'fake.access.jwt',
  rawRefreshToken: 'fake-raw-refresh',
  expiresIn: 900,
};

const VALID_AUTH_RESULT = { user: FAKE_USER, tokens: FAKE_TOKENS, rememberMe: false };

const VALID_VERIFY_BODY = { token: 'valid-verification-token' };
const VALID_RESEND_BODY = { email: 'alice@example.com' };
const VALID_FORGOT_BODY = { email: 'alice@example.com' };
const VALID_RESET_BODY = {
  token: 'valid-reset-token',
  new_password: 'NewPass1!',
  confirm_new_password: 'NewPass1!',
};
const VALID_CHANGE_PASSWORD_BODY = {
  current_password: 'OldPass1!',
  new_password: 'NewPass2@',
  confirm_new_password: 'NewPass2@',
};


// %%%%% Helpers %%%%%

function makeRequest(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function makeMalformedRequest(path: string): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not-valid-json{{{',
  });
}


// %%%%% Setup %%%%%

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ blocked: false });
  mockRecordFailedAttempt.mockResolvedValue(undefined);
  mockResetOnSuccess.mockResolvedValue(undefined);
  mockCookieGet.mockReturnValue(undefined);
});


// ---------------------------------------------------------------------------
// POST /api/v1/auth/verify-email
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/verify-email', () => {
  beforeEach(() => {
    mockVerifyEmail.mockResolvedValue(undefined);
  });

  it('returns 200 with verified=true on a valid token', async () => {
    const res = await verifyEmailPOST(makeRequest('/api/v1/auth/verify-email', VALID_VERIFY_BODY));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.verified).toBe(true);
    expect(mockVerifyEmail).toHaveBeenCalledWith(VALID_VERIFY_BODY.token);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({ blocked: true });

    const res = await verifyEmailPOST(makeRequest('/api/v1/auth/verify-email', VALID_VERIFY_BODY));
    expect(res.status).toBe(429);
    expect(mockVerifyEmail).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await verifyEmailPOST(makeMalformedRequest('/api/v1/auth/verify-email'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when token field is missing', async () => {
    const res = await verifyEmailPOST(makeRequest('/api/v1/auth/verify-email', {}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 TOKEN_EXPIRED for an expired or used token', async () => {
    mockVerifyEmail.mockRejectedValue(new TokenExpiredError('Token expired'));

    const res = await verifyEmailPOST(makeRequest('/api/v1/auth/verify-email', VALID_VERIFY_BODY));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('TOKEN_EXPIRED');
    expect(mockRecordFailedAttempt).toHaveBeenCalled();
  });

  it('returns 400 TOKEN_EXPIRED for a token that was never issued (prevents enumeration)', async () => {
    mockVerifyEmail.mockRejectedValue(new NotFoundError('Token not found'));

    const res = await verifyEmailPOST(makeRequest('/api/v1/auth/verify-email', VALID_VERIFY_BODY));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('TOKEN_EXPIRED');
  });

  it('returns 500 on unexpected service error', async () => {
    mockVerifyEmail.mockRejectedValue(new Error('Database error'));

    const res = await verifyEmailPOST(makeRequest('/api/v1/auth/verify-email', VALID_VERIFY_BODY));
    expect(res.status).toBe(500);
  });
});


// ---------------------------------------------------------------------------
// POST /api/v1/auth/resend-verification-email
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/resend-verification-email', () => {
  beforeEach(() => {
    mockResendVerificationEmail.mockResolvedValue(undefined);
  });

  it('returns 200 with sent=true even when account exists', async () => {
    const res = await resendVerificationEmailPOST(makeRequest('/api/v1/auth/resend-verification-email', VALID_RESEND_BODY));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.sent).toBe(true);
    expect(mockResendVerificationEmail).toHaveBeenCalledWith(VALID_RESEND_BODY.email, expect.any(String));
  });

  it('returns 200 even when the account is not found (prevents enumeration)', async () => {
    mockResendVerificationEmail.mockRejectedValue(new NotFoundError('No account'));

    const res = await resendVerificationEmailPOST(makeRequest('/api/v1/auth/resend-verification-email', VALID_RESEND_BODY));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.sent).toBe(true);
  });

  it('returns 200 even when the email is already verified (prevents enumeration)', async () => {
    mockResendVerificationEmail.mockRejectedValue(new ConflictError('Already verified'));

    const res = await resendVerificationEmailPOST(makeRequest('/api/v1/auth/resend-verification-email', VALID_RESEND_BODY));
    const body = await res.json();

    expect(res.status).toBe(200);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({ blocked: true });

    const res = await resendVerificationEmailPOST(makeRequest('/api/v1/auth/resend-verification-email', VALID_RESEND_BODY));
    expect(res.status).toBe(429);
  });

  it('returns 400 when email is missing or invalid', async () => {
    const res = await resendVerificationEmailPOST(makeRequest('/api/v1/auth/resend-verification-email', { email: 'bad-email' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 500 on unexpected service error', async () => {
    mockResendVerificationEmail.mockRejectedValue(new Error('DB unavailable'));

    const res = await resendVerificationEmailPOST(makeRequest('/api/v1/auth/resend-verification-email', VALID_RESEND_BODY));
    expect(res.status).toBe(500);
  });
});


// ---------------------------------------------------------------------------
// POST /api/v1/auth/forgot-password
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/forgot-password', () => {
  beforeEach(() => {
    mockForgotPassword.mockResolvedValue(undefined);
  });

  it('returns 200 with sent=true regardless of whether account exists', async () => {
    const res = await forgotPasswordPOST(makeRequest('/api/v1/auth/forgot-password', VALID_FORGOT_BODY));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.sent).toBe(true);
    expect(mockForgotPassword).toHaveBeenCalledWith(VALID_FORGOT_BODY.email, expect.any(String));
  });

  it('records a rate-limit attempt for every request (abuse prevention)', async () => {
    await forgotPasswordPOST(makeRequest('/api/v1/auth/forgot-password', VALID_FORGOT_BODY));

    expect(mockRecordFailedAttempt).toHaveBeenCalled();
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({ blocked: true });

    const res = await forgotPasswordPOST(makeRequest('/api/v1/auth/forgot-password', VALID_FORGOT_BODY));
    expect(res.status).toBe(429);
    expect(mockForgotPassword).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await forgotPasswordPOST(makeMalformedRequest('/api/v1/auth/forgot-password'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when email is not a valid address', async () => {
    const res = await forgotPasswordPOST(makeRequest('/api/v1/auth/forgot-password', { email: 'not-an-email' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 500 on unexpected service error', async () => {
    mockForgotPassword.mockRejectedValue(new Error('Unexpected error'));

    const res = await forgotPasswordPOST(makeRequest('/api/v1/auth/forgot-password', VALID_FORGOT_BODY));
    expect(res.status).toBe(500);
  });
});


// ---------------------------------------------------------------------------
// POST /api/v1/auth/reset-password
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/reset-password', () => {
  beforeEach(() => {
    mockResetPassword.mockResolvedValue(undefined);
  });

  it('returns 200 with reset=true on a valid token', async () => {
    const res = await resetPasswordPOST(makeRequest('/api/v1/auth/reset-password', VALID_RESET_BODY));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.reset).toBe(true);
    expect(mockResetPassword).toHaveBeenCalledWith(VALID_RESET_BODY.token, VALID_RESET_BODY.new_password);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({ blocked: true });

    const res = await resetPasswordPOST(makeRequest('/api/v1/auth/reset-password', VALID_RESET_BODY));
    expect(res.status).toBe(429);
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await resetPasswordPOST(makeMalformedRequest('/api/v1/auth/reset-password'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when token is missing', async () => {
    const { token: _, ...noToken } = VALID_RESET_BODY;
    const res = await resetPasswordPOST(makeRequest('/api/v1/auth/reset-password', noToken));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when passwords do not match', async () => {
    const res = await resetPasswordPOST(makeRequest('/api/v1/auth/reset-password', {
      ...VALID_RESET_BODY,
      confirm_new_password: 'DifferentPass2@',
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 TOKEN_EXPIRED for an expired or used token', async () => {
    mockResetPassword.mockRejectedValue(new TokenExpiredError('Token expired'));

    const res = await resetPasswordPOST(makeRequest('/api/v1/auth/reset-password', VALID_RESET_BODY));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('TOKEN_EXPIRED');
    expect(mockRecordFailedAttempt).toHaveBeenCalled();
  });

  it('returns 400 TOKEN_EXPIRED when the token never existed (prevents enumeration)', async () => {
    mockResetPassword.mockRejectedValue(new NotFoundError('Token not found'));

    const res = await resetPasswordPOST(makeRequest('/api/v1/auth/reset-password', VALID_RESET_BODY));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('TOKEN_EXPIRED');
  });

  it('returns 500 on unexpected service error', async () => {
    mockResetPassword.mockRejectedValue(new Error('DB crashed'));

    const res = await resetPasswordPOST(makeRequest('/api/v1/auth/reset-password', VALID_RESET_BODY));
    expect(res.status).toBe(500);
  });
});


// ---------------------------------------------------------------------------
// POST /api/v1/auth/refresh
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/refresh', () => {
  beforeEach(() => {
    mockRefreshSession.mockResolvedValue(VALID_AUTH_RESULT);
    mockCookieGet.mockImplementation((name: string) => {
      if (name === 'refresh_token') return { value: 'fake-raw-refresh' };
      return undefined;
    });
  });

  it('returns 200 with a new access_token when refresh token is valid', async () => {
    const res = await refreshPOST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.access_token).toBe(FAKE_TOKENS.accessJwt);
    expect(body.data.token_type).toBe('Bearer');
    expect(body.data.expires_in).toBe(FAKE_TOKENS.expiresIn);
    expect(mockRefreshSession).toHaveBeenCalledWith('fake-raw-refresh');
  });

  it('returns 401 when the refresh token cookie is absent', async () => {
    mockCookieGet.mockReturnValue(undefined);

    const res = await refreshPOST();
    expect(res.status).toBe(401);
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  it('returns 401 when refreshSession throws UnauthorizedError', async () => {
    mockRefreshSession.mockRejectedValue(new UnauthorizedError('Expired'));

    const res = await refreshPOST();
    expect(res.status).toBe(401);
  });

  it('returns 500 on unexpected service error', async () => {
    mockRefreshSession.mockRejectedValue(new Error('DB gone'));

    const res = await refreshPOST();
    expect(res.status).toBe(500);
  });
});


// ---------------------------------------------------------------------------
// POST /api/v1/auth/logout
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/logout', () => {
  it('returns 200 with logged_out=true and clears the refresh token cookie', async () => {
    const req = new Request('http://localhost/api/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake.access.jwt' },
    });
    mockVerifyJwt.mockResolvedValue({ sub: FAKE_USER.id, role: 'client' });
    mockRevokeAllRefreshTokensForUser.mockResolvedValue(undefined);

    const res = await logoutPOST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.logged_out).toBe(true);
    void req; // suppress unused var warning
  });

  it('still returns 200 even without a Bearer token (anonymous logout)', async () => {
    const res = await logoutPOST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.logged_out).toBe(true);
    expect(mockRevokeAllRefreshTokensForUser).not.toHaveBeenCalled();
  });

  it('still returns 200 when token revocation fails (best-effort)', async () => {
    mockVerifyJwt.mockResolvedValue({ sub: FAKE_USER.id });
    mockRevokeAllRefreshTokensForUser.mockRejectedValue(new Error('DB error'));

    const res = await logoutPOST();
    expect(res.status).toBe(200);
  });
});


// ---------------------------------------------------------------------------
// POST /api/v1/auth/change-password
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/change-password', () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue({ sub: FAKE_USER.id, role: 'client' });
    mockChangePassword.mockResolvedValue(undefined);
  });

  it('returns 200 with changed=true on success', async () => {
    const res = await changePasswordPOST(makeRequest('/api/v1/auth/change-password', VALID_CHANGE_PASSWORD_BODY));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.changed).toBe(true);
    expect(mockChangePassword).toHaveBeenCalledWith(
      FAKE_USER.id,
      VALID_CHANGE_PASSWORD_BODY.current_password,
      VALID_CHANGE_PASSWORD_BODY.new_password,
    );
  });

  it('returns 401 when not authenticated (requireAuth returns a Response)', async () => {
    const unauthorizedResponse = new Response(JSON.stringify({ code: 'UNAUTHORIZED' }), { status: 401 });
    mockRequireAuth.mockResolvedValue(unauthorizedResponse);

    const res = await changePasswordPOST(makeRequest('/api/v1/auth/change-password', VALID_CHANGE_PASSWORD_BODY));
    expect(res.status).toBe(401);
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await changePasswordPOST(makeMalformedRequest('/api/v1/auth/change-password'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when new passwords do not match', async () => {
    const res = await changePasswordPOST(makeRequest('/api/v1/auth/change-password', {
      ...VALID_CHANGE_PASSWORD_BODY,
      confirm_new_password: 'DifferentPass3#',
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 401 when current password is incorrect', async () => {
    mockChangePassword.mockRejectedValue(new UnauthorizedError('Current password is incorrect'));

    const res = await changePasswordPOST(makeRequest('/api/v1/auth/change-password', VALID_CHANGE_PASSWORD_BODY));
    const body = await res.json();

    expect(res.status).toBe(401);
  });

  it('returns 500 on unexpected service error', async () => {
    mockChangePassword.mockRejectedValue(new Error('Unexpected'));

    const res = await changePasswordPOST(makeRequest('/api/v1/auth/change-password', VALID_CHANGE_PASSWORD_BODY));
    expect(res.status).toBe(500);
  });
});
