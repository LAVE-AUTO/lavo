/**
 * Integration tests for auth routes.
 *
 * POST /api/v1/auth/login
 * POST /api/v1/auth/register
 *
 * Strategy: mock the service layer and rate-limiter so that the full HTTP handler
 * validation → service delegation → response-shape pipeline is exercised without
 * touching the database or network.
 *
 * @jest-environment node
 */

// %%%%% Mocks %%%%%

const mockLogin = jest.fn();
const mockRegisterWithPassword = jest.fn();
const mockCheckRateLimit = jest.fn();
const mockRecordFailedAttempt = jest.fn();
const mockResetOnSuccess = jest.fn();

jest.mock('@/server/auth/auth-service', () => ({
  login: (...args: unknown[]) => mockLogin(...args),
  registerWithPassword: (...args: unknown[]) => mockRegisterWithPassword(...args),
}));

jest.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  recordFailedAttempt: (...args: unknown[]) => mockRecordFailedAttempt(...args),
  resetOnSuccess: (...args: unknown[]) => mockResetOnSuccess(...args),
  normalizeRateLimitKey: (key: string) => key,
}));

jest.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Map()),
}));


// %%%%% Imports %%%%%

import { POST as loginPOST } from '@/app/api/v1/auth/login/route';
import { POST as registerPOST } from '@/app/api/v1/auth/register/route';
import { UnauthorizedError, ForbiddenError, ConflictError } from '@/lib/errors';


// %%%%% Fixtures %%%%%

const FAKE_USER = {
  id: 'user-uuid-0001',
  first_name: 'Alice',
  last_name: 'Dupont',
  email: 'alice@example.com',
  phone: '+237600000001',
  role: 'client',
  status: 'active',
  force_password_change: false,
  email_verified_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const FAKE_TOKENS = {
  accessJwt: 'fake.access.token',
  rawRefreshToken: 'fake-raw-refresh',
  expiresIn: 900,
};

const VALID_LOGIN_BODY = {
  email: 'alice@example.com',
  password: 'ValidPass1!',
  expected_role: 'client',
};

const VALID_REGISTER_BODY = {
  first_name: 'Alice',
  last_name: 'Dupont',
  email: 'alice@example.com',
  phone: '+237600000001',
  password: 'ValidPass1!',
  confirm_password: 'ValidPass1!',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(path: string, body: unknown, method = 'POST'): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
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

// ---------------------------------------------------------------------------
// POST /api/v1/auth/login
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ blocked: false });
    mockResetOnSuccess.mockResolvedValue(undefined);
    mockRecordFailedAttempt.mockResolvedValue(undefined);
    mockLogin.mockResolvedValue({ user: FAKE_USER, tokens: FAKE_TOKENS });
  });

  // --- Happy path ---

  it('returns 200 with user and access_token on valid credentials', async () => {
    const req = makeRequest('/api/v1/auth/login', VALID_LOGIN_BODY);
    const res = await loginPOST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.user.id).toBe(FAKE_USER.id);
    expect(body.data.access_token).toBe(FAKE_TOKENS.accessJwt);
    expect(body.data.token_type).toBe('Bearer');
    expect(body.data.expires_in).toBe(FAKE_TOKENS.expiresIn);
    expect(body.message).toBe('Login successful');
    expect(mockLogin).toHaveBeenCalledWith(expect.objectContaining({
      email: VALID_LOGIN_BODY.email,
      expected_role: 'client',
    }));
  });

  // --- Rate limiting ---

  it('returns 429 when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({ blocked: true, retryAfter: 60 });

    const res = await loginPOST(makeRequest('/api/v1/auth/login', VALID_LOGIN_BODY));
    expect(res.status).toBe(429);
    expect(mockLogin).not.toHaveBeenCalled();
  });

  // --- Input validation ---

  it('returns 400 for malformed JSON body', async () => {
    const res = await loginPOST(makeMalformedRequest('/api/v1/auth/login'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('returns 400 when email is missing', async () => {
    const res = await loginPOST(makeRequest('/api/v1/auth/login', {
      password: 'ValidPass1!',
      expected_role: 'client',
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(Array.isArray(body.errors)).toBe(true);
  });

  it('returns 400 when email is not a valid address', async () => {
    const res = await loginPOST(makeRequest('/api/v1/auth/login', {
      ...VALID_LOGIN_BODY,
      email: 'not-an-email',
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when expected_role is missing', async () => {
    const res = await loginPOST(makeRequest('/api/v1/auth/login', {
      email: 'alice@example.com',
      password: 'ValidPass1!',
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when expected_role is not an allowed value', async () => {
    const res = await loginPOST(makeRequest('/api/v1/auth/login', {
      ...VALID_LOGIN_BODY,
      expected_role: 'superuser',
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when password field is empty', async () => {
    const res = await loginPOST(makeRequest('/api/v1/auth/login', {
      email: 'alice@example.com',
      password: '',
      expected_role: 'client',
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  // --- Service errors ---

  it('returns 401 INVALID_CREDENTIALS on wrong credentials', async () => {
    mockLogin.mockRejectedValue(new UnauthorizedError('Invalid credentials'));

    const res = await loginPOST(makeRequest('/api/v1/auth/login', VALID_LOGIN_BODY));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe('INVALID_CREDENTIALS');
    expect(mockRecordFailedAttempt).toHaveBeenCalled();
  });

  it('returns 403 when account is not active', async () => {
    mockLogin.mockRejectedValue(new ForbiddenError('Account is not active'));

    const res = await loginPOST(makeRequest('/api/v1/auth/login', VALID_LOGIN_BODY));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
  });

  it('returns 500 on unexpected service error', async () => {
    mockLogin.mockRejectedValue(new Error('Database connection timeout'));

    const res = await loginPOST(makeRequest('/api/v1/auth/login', VALID_LOGIN_BODY));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/register
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ blocked: false });
    mockResetOnSuccess.mockResolvedValue(undefined);
    mockRecordFailedAttempt.mockResolvedValue(undefined);
    mockRegisterWithPassword.mockResolvedValue({ user: FAKE_USER, tokens: FAKE_TOKENS });
  });

  // --- Happy path ---

  it('returns 201 with user and access_token on successful registration', async () => {
    const res = await registerPOST(makeRequest('/api/v1/auth/register', VALID_REGISTER_BODY));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.user.id).toBe(FAKE_USER.id);
    expect(body.data.access_token).toBe(FAKE_TOKENS.accessJwt);
    expect(body.data.token_type).toBe('Bearer');
    expect(body.data.expires_in).toBe(FAKE_TOKENS.expiresIn);
    expect(body.message).toBe('Registration successful');
    expect(mockRegisterWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({ email: VALID_REGISTER_BODY.email }),
      expect.any(String)
    );
  });

  // --- Rate limiting ---

  it('returns 429 when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({ blocked: true });

    const res = await registerPOST(makeRequest('/api/v1/auth/register', VALID_REGISTER_BODY));
    expect(res.status).toBe(429);
    expect(mockRegisterWithPassword).not.toHaveBeenCalled();
  });

  // --- Input validation ---

  it('returns 400 for malformed JSON body', async () => {
    const res = await registerPOST(makeMalformedRequest('/api/v1/auth/register'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockRegisterWithPassword).not.toHaveBeenCalled();
  });

  it('returns 400 when first_name is missing', async () => {
    const { first_name: _, ...noFirstName } = VALID_REGISTER_BODY;
    const res = await registerPOST(makeRequest('/api/v1/auth/register', noFirstName));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(Array.isArray(body.errors)).toBe(true);
  });

  it('returns 400 when email is invalid', async () => {
    const res = await registerPOST(makeRequest('/api/v1/auth/register', {
      ...VALID_REGISTER_BODY,
      email: 'bad-email',
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when password does not meet complexity rules', async () => {
    const res = await registerPOST(makeRequest('/api/v1/auth/register', {
      ...VALID_REGISTER_BODY,
      password: 'weakpassword',
      confirm_password: 'weakpassword',
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when passwords do not match', async () => {
    const res = await registerPOST(makeRequest('/api/v1/auth/register', {
      ...VALID_REGISTER_BODY,
      confirm_password: 'DifferentPass1!',
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  // --- Service errors ---

  it('returns 409 EMAIL_ALREADY_EXISTS when email is taken', async () => {
    mockRegisterWithPassword.mockRejectedValue(new ConflictError('Email already in use'));

    const res = await registerPOST(makeRequest('/api/v1/auth/register', VALID_REGISTER_BODY));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('returns 500 on unexpected service error', async () => {
    mockRegisterWithPassword.mockRejectedValue(new Error('Unexpected failure'));

    const res = await registerPOST(makeRequest('/api/v1/auth/register', VALID_REGISTER_BODY));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});
