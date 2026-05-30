/**
 * Unit tests for auth-service.ts.
 *
 * All external dependencies (repositories, bcrypt, jwt, email, crypto) are mocked
 * so each function is tested in isolation without hitting the database or network.
 *
 * @jest-environment node
 */

// %%%%% Mocks — must be hoisted before any imports %%%%%

const mockFindByEmail = jest.fn();
const mockFindById = jest.fn();
const mockFindByIdWithPassword = jest.fn();
const mockCreateUser = jest.fn();
const mockUpdateEmailVerified = jest.fn();
const mockUpdatePassword = jest.fn();
const mockUpdateForcePasswordChange = jest.fn();

jest.mock('@/server/auth/user-repository', () => ({
  findByEmail: (...args: unknown[]) => mockFindByEmail(...args),
  findById: (...args: unknown[]) => mockFindById(...args),
  findByIdWithPassword: (...args: unknown[]) => mockFindByIdWithPassword(...args),
  createUser: (...args: unknown[]) => mockCreateUser(...args),
  updateEmailVerified: (...args: unknown[]) => mockUpdateEmailVerified(...args),
  updatePassword: (...args: unknown[]) => mockUpdatePassword(...args),
  updateForcePasswordChange: (...args: unknown[]) => mockUpdateForcePasswordChange(...args),
}));

const mockCreateToken = jest.fn();
const mockFindValidToken = jest.fn();
const mockFindTokenByValueAndType = jest.fn();
const mockMarkTokenUsed = jest.fn();

jest.mock('@/server/auth/token-repository', () => ({
  createToken: (...args: unknown[]) => mockCreateToken(...args),
  findValidToken: (...args: unknown[]) => mockFindValidToken(...args),
  findTokenByValueAndType: (...args: unknown[]) => mockFindTokenByValueAndType(...args),
  markTokenUsed: (...args: unknown[]) => mockMarkTokenUsed(...args),
}));

const mockGenerateRawToken = jest.fn();
const mockCreateRefreshToken = jest.fn();
const mockFindValidRefreshToken = jest.fn();
const mockRevokeRefreshToken = jest.fn();

jest.mock('@/server/auth/refresh-token-repository', () => ({
  generateRawToken: () => mockGenerateRawToken(),
  createRefreshToken: (...args: unknown[]) => mockCreateRefreshToken(...args),
  findValidRefreshToken: (...args: unknown[]) => mockFindValidRefreshToken(...args),
  revokeRefreshToken: (...args: unknown[]) => mockRevokeRefreshToken(...args),
}));

const mockSignJwt = jest.fn();
jest.mock('@/lib/jwt', () => ({
  signJwt: (...args: unknown[]) => mockSignJwt(...args),
}));

const mockSendVerificationEmail = jest.fn();
const mockSendPasswordResetEmail = jest.fn();
jest.mock('@/lib/email', () => ({
  sendVerificationEmail: (...args: unknown[]) => mockSendVerificationEmail(...args),
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
}));

const mockBcryptHash = jest.fn();
const mockBcryptCompare = jest.fn();
jest.mock('bcrypt', () => ({
  hash: (...args: unknown[]) => mockBcryptHash(...args),
  compare: (...args: unknown[]) => mockBcryptCompare(...args),
}));


// %%%%% Imports %%%%%

import {
  registerWithPassword,
  verifyEmail,
  resendVerificationEmail,
  findOrCreateOAuthUser,
  login,
  changePassword,
  forgotPassword,
  resetPassword,
  refreshSession,
} from '@/server/auth/auth-service';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TokenExpiredError,
  UnauthorizedError,
} from '@/lib/errors';
import { ApiCode } from '@/types/api-codes';


// %%%%% Fixtures %%%%%

const FAKE_PASSWORD_HASH = '$2b$12$fakehashedpassword00000000000000000000000000000000000000';
const FAKE_ACCESS_JWT = 'fake.access.jwt';
const FAKE_RAW_REFRESH = 'fake-raw-refresh-token';

const FAKE_USER_WITH_HASH = {
  id: 'user-uuid-0001',
  first_name: 'Alice',
  last_name: 'Dupont',
  email: 'alice@example.com',
  phone: '+237600000001',
  role: 'client' as const,
  status: 'active' as const,
  force_password_change: false,
  email_verified_at: new Date('2024-01-01'),
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  password_hash: FAKE_PASSWORD_HASH,
};

const FAKE_SAFE_USER = ((): typeof FAKE_USER_WITH_HASH & { password_hash?: string } => {
  const { password_hash: _, ...safe } = FAKE_USER_WITH_HASH;
  return safe;
})();

const FAKE_TOKEN = {
  id: 'token-uuid-0001',
  user_id: 'user-uuid-0001',
  token: 'mock-verification-token',
  type: 'email_verification',
  expires_at: new Date(Date.now() + 86_400_000),
  used_at: null,
  created_at: new Date(),
};

const FAKE_RESET_TOKEN = {
  ...FAKE_TOKEN,
  id: 'token-uuid-0002',
  token: 'mock-reset-token',
  type: 'password_reset',
};

// A refresh token record with a 1-day TTL (standard session, remember_me=false)
const FAKE_REFRESH_RECORD = {
  id: 'refresh-uuid-0001',
  user_id: 'user-uuid-0001',
  token_hash: 'hashed-raw-token',
  expires_at: new Date(Date.now() + 86_400_000),       // +1 day
  created_at: new Date(),
  revoked_at: null,
  remember_me: false,
};

// A refresh token record with a 30-day TTL (remember-me session)
const FAKE_REFRESH_RECORD_REMEMBER = {
  ...FAKE_REFRESH_RECORD,
  id: 'refresh-uuid-0002',
  expires_at: new Date(Date.now() + 30 * 86_400_000),  // +30 days
  remember_me: true,
};


// %%%%% Setup %%%%%

function setupIssueTokenPair() {
  mockSignJwt.mockResolvedValue(FAKE_ACCESS_JWT);
  mockGenerateRawToken.mockReturnValue(FAKE_RAW_REFRESH);
  mockCreateRefreshToken.mockResolvedValue(undefined);
}

beforeEach(() => {
  jest.clearAllMocks();
});


// ---------------------------------------------------------------------------
// registerWithPassword
// ---------------------------------------------------------------------------

describe('registerWithPassword', () => {
  const dto = {
    first_name: 'Alice',
    last_name: 'Dupont',
    email: 'alice@example.com',
    phone: '+237600000001',
    password: 'ValidPass1!',
    remember_me: false,
  };

  beforeEach(() => {
    mockFindByEmail.mockResolvedValue(null);
    mockBcryptHash.mockResolvedValue(FAKE_PASSWORD_HASH);
    mockCreateUser.mockResolvedValue(FAKE_SAFE_USER);
    mockCreateToken.mockResolvedValue(FAKE_TOKEN);
    mockSendVerificationEmail.mockResolvedValue(undefined);
    setupIssueTokenPair();
  });

  it('creates the user, sends verification email, and returns tokens', async () => {
    const result = await registerWithPassword(dto);

    expect(mockFindByEmail).toHaveBeenCalledWith(dto.email);
    expect(mockBcryptHash).toHaveBeenCalledWith(dto.password, expect.any(Number));
    expect(mockCreateUser).toHaveBeenCalledWith(expect.objectContaining({
      email: dto.email,
      role: 'client',
      status: 'pending_verification',
      password_hash: FAKE_PASSWORD_HASH,
    }));
    expect(mockCreateToken).toHaveBeenCalledWith(expect.objectContaining({
      user_id: FAKE_SAFE_USER.id,
      type: 'email_verification',
    }));
    expect(result.user).toMatchObject({ id: FAKE_SAFE_USER.id, email: dto.email });
    expect(result.tokens.accessJwt).toBe(FAKE_ACCESS_JWT);
    expect(result.tokens.rawRefreshToken).toBe(FAKE_RAW_REFRESH);
    expect(result.rememberMe).toBe(false);
  });

  it('throws ConflictError when email already exists', async () => {
    mockFindByEmail.mockResolvedValue(FAKE_USER_WITH_HASH);

    await expect(registerWithPassword(dto)).rejects.toBeInstanceOf(ConflictError);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('still succeeds when verification email send fails (fire-and-forget)', async () => {
    mockSendVerificationEmail.mockRejectedValue(new Error('SMTP timeout'));

    const result = await registerWithPassword(dto);
    expect(result.tokens.accessJwt).toBe(FAKE_ACCESS_JWT);
  });

  it('passes remember_me to the token pair and returns it in the result', async () => {
    const result = await registerWithPassword({ ...dto, remember_me: true });

    expect(result.rememberMe).toBe(true);
    expect(mockCreateRefreshToken).toHaveBeenCalledWith(
      FAKE_SAFE_USER.id,
      FAKE_RAW_REFRESH,
      expect.any(Date),
      true,
    );
  });
});


// ---------------------------------------------------------------------------
// verifyEmail
// ---------------------------------------------------------------------------

describe('verifyEmail', () => {
  it('marks email verified and token used on a valid token', async () => {
    mockFindValidToken.mockResolvedValue(FAKE_TOKEN);
    mockUpdateEmailVerified.mockResolvedValue(undefined);
    mockMarkTokenUsed.mockResolvedValue(undefined);

    await verifyEmail(FAKE_TOKEN.token);

    expect(mockFindValidToken).toHaveBeenCalledWith(FAKE_TOKEN.token, 'email_verification');
    expect(mockUpdateEmailVerified).toHaveBeenCalledWith(FAKE_TOKEN.user_id);
    expect(mockMarkTokenUsed).toHaveBeenCalledWith(FAKE_TOKEN.id);
  });

  it('throws TokenExpiredError when token exists but is expired/used', async () => {
    mockFindValidToken.mockResolvedValue(null);
    mockFindTokenByValueAndType.mockResolvedValue({ ...FAKE_TOKEN, used_at: new Date() });

    await expect(verifyEmail('expired-token')).rejects.toBeInstanceOf(TokenExpiredError);
    expect(mockUpdateEmailVerified).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when token has never existed', async () => {
    mockFindValidToken.mockResolvedValue(null);
    mockFindTokenByValueAndType.mockResolvedValue(null);

    await expect(verifyEmail('ghost-token')).rejects.toBeInstanceOf(NotFoundError);
    expect(mockUpdateEmailVerified).not.toHaveBeenCalled();
  });
});


// ---------------------------------------------------------------------------
// resendVerificationEmail
// ---------------------------------------------------------------------------

describe('resendVerificationEmail', () => {
  beforeEach(() => {
    mockCreateToken.mockResolvedValue(FAKE_TOKEN);
    mockSendVerificationEmail.mockResolvedValue(undefined);
  });

  it('creates a new token and sends the email for a pending account', async () => {
    const pendingUser = { ...FAKE_USER_WITH_HASH, status: 'pending_verification' as const };
    mockFindByEmail.mockResolvedValue(pendingUser);

    await resendVerificationEmail('alice@example.com');

    expect(mockCreateToken).toHaveBeenCalledWith(expect.objectContaining({
      user_id: pendingUser.id,
      type: 'email_verification',
    }));
    expect(mockSendVerificationEmail).toHaveBeenCalledWith(
      pendingUser.email,
      pendingUser.first_name,
      FAKE_TOKEN.token,
      expect.any(String),
    );
  });

  it('throws NotFoundError when no account exists for that email', async () => {
    mockFindByEmail.mockResolvedValue(null);

    await expect(resendVerificationEmail('unknown@example.com')).rejects.toBeInstanceOf(NotFoundError);
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();
  });

  it('throws ConflictError when the email is already verified (status active)', async () => {
    mockFindByEmail.mockResolvedValue(FAKE_USER_WITH_HASH); // status: 'active'

    await expect(resendVerificationEmail('alice@example.com')).rejects.toBeInstanceOf(ConflictError);
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();
  });
});


// ---------------------------------------------------------------------------
// findOrCreateOAuthUser
// ---------------------------------------------------------------------------

describe('findOrCreateOAuthUser', () => {
  const oauthData = { email: 'alice@example.com', firstName: 'Alice', lastName: 'Dupont' };

  beforeEach(() => {
    setupIssueTokenPair();
  });

  it('returns existing user (strips password_hash) when email is found', async () => {
    mockFindByEmail.mockResolvedValue(FAKE_USER_WITH_HASH);

    const result = await findOrCreateOAuthUser(oauthData);

    expect(result.user).not.toHaveProperty('password_hash');
    expect(result.user.id).toBe(FAKE_USER_WITH_HASH.id);
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(result.rememberMe).toBe(false);
  });

  it('creates a new active user when email is not found', async () => {
    mockFindByEmail.mockResolvedValue(null);
    mockCreateUser.mockResolvedValue({ ...FAKE_SAFE_USER, status: 'active' });

    const result = await findOrCreateOAuthUser(oauthData);

    expect(mockCreateUser).toHaveBeenCalledWith(expect.objectContaining({
      email: oauthData.email,
      status: 'active',
      role: 'client',
      password_hash: null,
    }));
    expect(result.tokens.accessJwt).toBe(FAKE_ACCESS_JWT);
  });
});


// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

describe('login', () => {
  const dto = {
    email: 'alice@example.com',
    password: 'ValidPass1!',
    remember_me: false,
    expected_role: 'client' as const,
  };

  beforeEach(() => {
    setupIssueTokenPair();
  });

  it('returns AuthResult for valid credentials', async () => {
    mockFindByEmail.mockResolvedValue(FAKE_USER_WITH_HASH);
    mockBcryptCompare.mockResolvedValue(true);

    const result = await login(dto);

    expect(mockBcryptCompare).toHaveBeenCalledWith(dto.password, FAKE_USER_WITH_HASH.password_hash);
    expect(result.user).not.toHaveProperty('password_hash');
    expect(result.tokens.accessJwt).toBe(FAKE_ACCESS_JWT);
    expect(result.rememberMe).toBe(false);
  });

  it('throws UnauthorizedError INVALID_CREDENTIALS when password is wrong', async () => {
    mockFindByEmail.mockResolvedValue(FAKE_USER_WITH_HASH);
    mockBcryptCompare.mockResolvedValue(false);

    await expect(login(dto)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('throws UnauthorizedError INVALID_CREDENTIALS when email is unknown (timing-safe)', async () => {
    mockFindByEmail.mockResolvedValue(null);
    // bcrypt.compare should still be called (against DUMMY_BCRYPT_HASH) to prevent timing attacks
    mockBcryptCompare.mockResolvedValue(false);

    await expect(login(dto)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(mockBcryptCompare).toHaveBeenCalled();
  });

  it('throws ForbiddenError BUSINESS_NOT_APPROVED when account is pending_verification', async () => {
    mockFindByEmail.mockResolvedValue({ ...FAKE_USER_WITH_HASH, status: 'pending_verification' });
    mockBcryptCompare.mockResolvedValue(true);

    const err = await login(dto).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(err.code).toBe(ApiCode.BUSINESS_NOT_APPROVED);
  });

  it('throws ForbiddenError BUSINESS_REJECTED when account is rejected', async () => {
    mockFindByEmail.mockResolvedValue({ ...FAKE_USER_WITH_HASH, status: 'rejected' });
    mockBcryptCompare.mockResolvedValue(true);

    const err = await login(dto).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(err.code).toBe(ApiCode.BUSINESS_REJECTED);
  });

  it('throws ForbiddenError FORBIDDEN when account is suspended', async () => {
    mockFindByEmail.mockResolvedValue({ ...FAKE_USER_WITH_HASH, status: 'suspended' });
    mockBcryptCompare.mockResolvedValue(true);

    const err = await login(dto).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(err.code).toBe(ApiCode.FORBIDDEN);
  });

  it('throws ForbiddenError when role does not match expected_role', async () => {
    const stationUser = { ...FAKE_USER_WITH_HASH, role: 'station' as const };
    mockFindByEmail.mockResolvedValue(stationUser);
    mockBcryptCompare.mockResolvedValue(true);

    await expect(login({ ...dto, expected_role: 'client' })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('propagates remember_me=true to the refresh token', async () => {
    mockFindByEmail.mockResolvedValue(FAKE_USER_WITH_HASH);
    mockBcryptCompare.mockResolvedValue(true);

    const result = await login({ ...dto, remember_me: true });

    expect(result.rememberMe).toBe(true);
    expect(mockCreateRefreshToken).toHaveBeenCalledWith(
      FAKE_USER_WITH_HASH.id,
      FAKE_RAW_REFRESH,
      expect.any(Date),
      true,
    );
  });
});


// ---------------------------------------------------------------------------
// changePassword
// ---------------------------------------------------------------------------

describe('changePassword', () => {
  const userId = 'user-uuid-0001';
  const currentPassword = 'OldPass1!';
  const newPassword = 'NewPass2@';

  beforeEach(() => {
    mockUpdatePassword.mockResolvedValue(undefined);
    mockUpdateForcePasswordChange.mockResolvedValue(undefined);
  });

  it('updates password successfully when current password matches', async () => {
    mockFindByIdWithPassword.mockResolvedValue(FAKE_USER_WITH_HASH);
    mockBcryptCompare.mockResolvedValue(true);
    mockBcryptHash.mockResolvedValue('new-hashed-password');

    await changePassword(userId, currentPassword, newPassword);

    expect(mockBcryptCompare).toHaveBeenCalledWith(currentPassword, FAKE_USER_WITH_HASH.password_hash);
    expect(mockBcryptHash).toHaveBeenCalledWith(newPassword, expect.any(Number));
    expect(mockUpdatePassword).toHaveBeenCalledWith(userId, 'new-hashed-password');
    expect(mockUpdateForcePasswordChange).toHaveBeenCalledWith(userId, false);
  });

  it('throws NotFoundError when user is not found', async () => {
    mockFindByIdWithPassword.mockResolvedValue(null);

    await expect(changePassword(userId, currentPassword, newPassword)).rejects.toBeInstanceOf(NotFoundError);
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedError when current password is wrong', async () => {
    mockFindByIdWithPassword.mockResolvedValue(FAKE_USER_WITH_HASH);
    mockBcryptCompare.mockResolvedValue(false);

    await expect(changePassword(userId, 'wrong-password', newPassword)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('skips current password check for admin-created account (password_hash is null)', async () => {
    mockFindByIdWithPassword.mockResolvedValue({ ...FAKE_USER_WITH_HASH, password_hash: null });
    mockBcryptHash.mockResolvedValue('new-hashed-password');

    await changePassword(userId, '', newPassword);

    expect(mockBcryptCompare).not.toHaveBeenCalled();
    expect(mockUpdatePassword).toHaveBeenCalledWith(userId, 'new-hashed-password');
  });
});


// ---------------------------------------------------------------------------
// forgotPassword
// ---------------------------------------------------------------------------

describe('forgotPassword', () => {
  beforeEach(() => {
    mockCreateToken.mockResolvedValue(FAKE_RESET_TOKEN);
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
  });

  it('creates a reset token and sends the email for an active account', async () => {
    mockFindByEmail.mockResolvedValue(FAKE_USER_WITH_HASH); // status: 'active'

    await forgotPassword('alice@example.com');

    expect(mockCreateToken).toHaveBeenCalledWith(expect.objectContaining({
      user_id: FAKE_USER_WITH_HASH.id,
      type: 'password_reset',
    }));
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      FAKE_USER_WITH_HASH.email,
      FAKE_USER_WITH_HASH.first_name,
      FAKE_RESET_TOKEN.token,
      expect.any(String),
    );
  });

  it('creates a reset token for a pending_verification account', async () => {
    const pendingUser = { ...FAKE_USER_WITH_HASH, status: 'pending_verification' as const };
    mockFindByEmail.mockResolvedValue(pendingUser);

    await forgotPassword('alice@example.com');

    expect(mockCreateToken).toHaveBeenCalled();
  });

  it('silently returns without sending email when email is unknown (enumeration protection)', async () => {
    mockFindByEmail.mockResolvedValue(null);

    await expect(forgotPassword('unknown@example.com')).resolves.toBeUndefined();
    expect(mockCreateToken).not.toHaveBeenCalled();
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('silently returns for suspended or deleted accounts (enumeration protection)', async () => {
    mockFindByEmail.mockResolvedValue({ ...FAKE_USER_WITH_HASH, status: 'suspended' });

    await expect(forgotPassword('alice@example.com')).resolves.toBeUndefined();
    expect(mockCreateToken).not.toHaveBeenCalled();
  });
});


// ---------------------------------------------------------------------------
// resetPassword
// ---------------------------------------------------------------------------

describe('resetPassword', () => {
  const newPassword = 'NewPass2@';

  beforeEach(() => {
    mockBcryptHash.mockResolvedValue('hashed-new-password');
    mockUpdatePassword.mockResolvedValue(undefined);
    mockMarkTokenUsed.mockResolvedValue(undefined);
  });

  it('updates the password and marks the token used', async () => {
    mockFindValidToken.mockResolvedValue(FAKE_RESET_TOKEN);
    mockFindByIdWithPassword.mockResolvedValue(FAKE_USER_WITH_HASH); // status: 'active'

    await resetPassword(FAKE_RESET_TOKEN.token, newPassword);

    expect(mockBcryptHash).toHaveBeenCalledWith(newPassword, expect.any(Number));
    expect(mockUpdatePassword).toHaveBeenCalledWith(FAKE_RESET_TOKEN.user_id, 'hashed-new-password');
    expect(mockMarkTokenUsed).toHaveBeenCalledWith(FAKE_RESET_TOKEN.id);
    expect(mockUpdateEmailVerified).not.toHaveBeenCalled();
  });

  it('also verifies email when the account is still pending_verification', async () => {
    mockFindValidToken.mockResolvedValue(FAKE_RESET_TOKEN);
    const pendingUser = { ...FAKE_USER_WITH_HASH, status: 'pending_verification' as const };
    mockFindByIdWithPassword.mockResolvedValue(pendingUser);
    mockUpdateEmailVerified.mockResolvedValue(undefined);

    await resetPassword(FAKE_RESET_TOKEN.token, newPassword);

    expect(mockUpdateEmailVerified).toHaveBeenCalledWith(FAKE_RESET_TOKEN.user_id);
  });

  it('throws TokenExpiredError when token exists but is expired/used', async () => {
    mockFindValidToken.mockResolvedValue(null);
    mockFindTokenByValueAndType.mockResolvedValue({ ...FAKE_RESET_TOKEN, used_at: new Date() });

    await expect(resetPassword('expired-token', newPassword)).rejects.toBeInstanceOf(TokenExpiredError);
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when token has never existed', async () => {
    mockFindValidToken.mockResolvedValue(null);
    mockFindTokenByValueAndType.mockResolvedValue(null);

    await expect(resetPassword('ghost-token', newPassword)).rejects.toBeInstanceOf(NotFoundError);
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });
});


// ---------------------------------------------------------------------------
// refreshSession
// ---------------------------------------------------------------------------

describe('refreshSession', () => {
  beforeEach(() => {
    mockFindById.mockResolvedValue(FAKE_SAFE_USER);
    mockRevokeRefreshToken.mockResolvedValue(undefined);
    setupIssueTokenPair();
  });

  it('rotates the refresh token and returns a new token pair', async () => {
    mockFindValidRefreshToken.mockResolvedValue(FAKE_REFRESH_RECORD);

    const result = await refreshSession('raw-token');

    expect(mockFindValidRefreshToken).toHaveBeenCalledWith('raw-token');
    expect(mockRevokeRefreshToken).toHaveBeenCalledWith(FAKE_REFRESH_RECORD.id);
    expect(mockCreateRefreshToken).toHaveBeenCalled();
    expect(result.tokens.accessJwt).toBe(FAKE_ACCESS_JWT);
  });

  it('throws UnauthorizedError when refresh token is invalid or expired', async () => {
    mockFindValidRefreshToken.mockResolvedValue(null);

    await expect(refreshSession('invalid-token')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(mockRevokeRefreshToken).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedError when the associated user no longer exists', async () => {
    mockFindValidRefreshToken.mockResolvedValue(FAKE_REFRESH_RECORD);
    mockFindById.mockResolvedValue(null);

    await expect(refreshSession('raw-token')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(mockCreateRefreshToken).not.toHaveBeenCalled();
  });

  it('preserves remember_me=true from the token record', async () => {
    mockFindValidRefreshToken.mockResolvedValue(FAKE_REFRESH_RECORD_REMEMBER);

    const result = await refreshSession('raw-token');

    expect(result.rememberMe).toBe(true);
    expect(mockCreateRefreshToken).toHaveBeenCalledWith(
      FAKE_SAFE_USER.id,
      FAKE_RAW_REFRESH,
      expect.any(Date),
      true,
    );
  });

  it('uses TTL heuristic to detect legacy remember-me sessions (remember_me=false but long TTL)', async () => {
    // Legacy row: remember_me column defaults to false, but the TTL is 30 days (remember-me sized)
    const legacyRecord = {
      ...FAKE_REFRESH_RECORD,
      remember_me: false,
      created_at: new Date(Date.now() - 1000), // 1s ago
      expires_at: new Date(Date.now() + 30 * 86_400_000), // +30 days
    };
    mockFindValidRefreshToken.mockResolvedValue(legacyRecord);

    const result = await refreshSession('raw-token');

    // The heuristic should detect the long TTL and treat it as remember-me
    expect(result.rememberMe).toBe(true);
  });

  it('standard session (remember_me=false, 1-day TTL) stays non-remember-me', async () => {
    mockFindValidRefreshToken.mockResolvedValue(FAKE_REFRESH_RECORD); // remember_me: false, 1-day TTL

    const result = await refreshSession('raw-token');

    expect(result.rememberMe).toBe(false);
  });
});
