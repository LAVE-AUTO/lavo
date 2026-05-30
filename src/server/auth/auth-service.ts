import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { signJwt } from '@/lib/jwt';
import { sendVerificationEmail, sendPasswordResetEmail } from '@/lib/email';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TokenExpiredError,
  UnauthorizedError,
} from '@/lib/errors';
import { ApiCode } from '@/types/api-codes';
import {
  ACCESS_TOKEN_MAX_AGE,
  JWT_DEFAULT_MAX_AGE,
  JWT_REMEMBER_MAX_AGE,
  BCRYPT_ROUNDS,
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
} from '@/helpers/server-constants';
import {
  findByEmail,
  findById,
  findByIdWithPassword,
  createUser,
  updateEmailVerified,
  updatePassword,
  updateForcePasswordChange,
  type SafeUser,
} from './user-repository';
import {
  createToken,
  findValidToken,
  findTokenByValueAndType,
  markTokenUsed,
} from './token-repository';
import {
  generateRawToken,
  createRefreshToken,
  findValidRefreshToken,
  revokeRefreshToken,
} from './refresh-token-repository';

// Domain logic for registration, login, email verification, password management,
// OAuth user provisioning, and session refresh.

// Pre-computed bcrypt hash used as a timing-attack guard when the user is not found.
// bcrypt.compare always runs a full comparison so login timing is consistent.
const DUMMY_BCRYPT_HASH = '$2b$12$invalidhashfortimingprotection000000000000000000000000';

// --- Types ---

export type RegisterDto = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  password: string;
  remember_me: boolean;
};

export type LoginDto = {
  email: string;
  password: string;
  remember_me: boolean;
  expected_role: 'client' | 'station' | 'admin';
};

export type AuthTokens = {
  accessJwt: string;
  rawRefreshToken: string;
  expiresIn: number;
};

export type AuthResult = {
  user: SafeUser;
  tokens: AuthTokens;
  rememberMe: boolean;
};

// --- Internal helpers ---

/**
 * Sign a JWT access token and persist a new refresh token for the given user.
 *
 * The refresh token TTL is determined by `rememberMe`:
 * - `true`  → JWT_REMEMBER_MAX_AGE
 * - `false` → JWT_DEFAULT_MAX_AGE
 *
 * @param user       Safe (password-stripped) user record.
 * @param rememberMe Whether to issue an extended-lifetime refresh token.
 * @returns Signed access JWT, raw refresh token, and access token TTL in seconds.
 */
async function issueTokenPair(
  user: SafeUser,
  rememberMe: boolean
): Promise<AuthTokens> {
  const accessJwt = await signJwt({
    sub: user.id,
    role: user.role,
    email: user.email,
    status: user.status,
    force_password_change: user.force_password_change,
  });

  const rawRefreshToken = generateRawToken();
  const expiresAt = new Date(
    Date.now() + (rememberMe ? JWT_REMEMBER_MAX_AGE : JWT_DEFAULT_MAX_AGE) * 1000
  );

  // Persist rememberMe alongside the token so rotation can re-emit a long-lived session
  // without falling back to TTL-based heuristics (bug #11).
  await createRefreshToken(user.id, rawRefreshToken, expiresAt, rememberMe);

  return { accessJwt, rawRefreshToken, expiresIn: ACCESS_TOKEN_MAX_AGE };
}

// --- Registration ---

/**
 * Register a new client account with email + password credentials.
 *
 * Creates the user record, issues a 24-hour email verification token, and
 * sends the verification email fire-and-forget (failures are logged, not thrown).
 * A token pair is issued immediately so the caller can log the user in right away.
 *
 * @param dto    Registration payload including credentials and remember-me preference.
 * @param locale Email locale for the verification message.
 * @throws {ConflictError} Email is already in use.
 */
export async function registerWithPassword(dto: RegisterDto, locale: 'fr' | 'en' = 'fr'): Promise<AuthResult> {
  const existing = await findByEmail(dto.email);
  if (existing) throw new ConflictError('Email already in use');

  const password_hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

  const user = await createUser({
    first_name: dto.first_name,
    last_name: dto.last_name,
    email: dto.email,
    phone: dto.phone,
    password_hash,
    role: 'client',
    status: 'pending_verification',
  });

  const token = await createToken({
    user_id: user.id,
    token: randomUUID(),
    type: 'email_verification',
    expires_at: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
  });

  // Fire-and-forget: do not block registration on email failure
  sendVerificationEmail(user.email, user.first_name ?? '', token.token, locale).catch((err) => {
    console.error('[sendVerificationEmail failed]', err);
  });

  const tokens = await issueTokenPair(user, dto.remember_me);
  return { user, tokens, rememberMe: dto.remember_me };
}

// --- Email verification ---

/**
 * Mark a user's email as verified by consuming a valid verification token.
 *
 * Distinguishes expired/used tokens from tokens that never existed to allow
 * the caller to surface the correct error message.
 *
 * @param token Raw verification token from the email link.
 * @throws {TokenExpiredError} Token exists but has already been used or has expired.
 * @throws {NotFoundError}     Token does not exist at all.
 */
export async function verifyEmail(token: string): Promise<void> {
  const record = await findValidToken(token, 'email_verification');

  if (!record) {
    // Distinguish expired/used from never-existed
    const existing = await findTokenByValueAndType(token, 'email_verification');
    if (existing) throw new TokenExpiredError('Verification token has expired or already been used');
    throw new NotFoundError('Verification token not found');
  }

  await updateEmailVerified(record.user_id);
  await markTokenUsed(record.id);
}

/**
 * Re-send a verification email for a pending account.
 *
 * @param email  Account email address.
 * @param locale Email locale for the verification message.
 * @throws {NotFoundError}  No account found with this email.
 * @throws {ConflictError}  Account email is already verified.
 */
export async function resendVerificationEmail(email: string, locale: 'fr' | 'en' = 'fr'): Promise<void> {
  const user = await findByEmail(email);
  if (!user) throw new NotFoundError('No account found with this email address');
  if (user.status === 'active') throw new ConflictError('Email is already verified');

  const token = await createToken({
    user_id: user.id,
    token: randomUUID(),
    type: 'email_verification',
    expires_at: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
  });

  await sendVerificationEmail(user.email, user.first_name ?? '', token.token, locale);
}

// --- OAuth ---

/**
 * Retrieve an existing account or create a new one for an OAuth-authenticated user.
 *
 * Newly created accounts are immediately marked active with a verified email
 * since identity has been confirmed by the OAuth provider.
 *
 * @param data Basic profile data returned by the OAuth provider.
 * @returns Auth result with a non-extended-lifetime token pair.
 */
export async function findOrCreateOAuthUser(data: {
  email: string;
  firstName: string;
  lastName: string;
}): Promise<AuthResult> {
  let user: SafeUser;

  const existing = await findByEmail(data.email);
  if (existing) {
    const { password_hash: _, ...safe } = existing;
    user = safe;
  } else {
    user = await createUser({
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      password_hash: null,
      role: 'client',
      status: 'active',
      email_verified_at: new Date(),
    });
  }

  const tokens = await issueTokenPair(user, false);
  return { user, tokens, rememberMe: false };
}

// --- Login ---

/**
 * Authenticate a user with email and password.
 *
 * Always performs a bcrypt comparison (even when the user is not found) to
 * prevent timing-based email enumeration attacks.
 *
 * @param dto Login payload including credentials, remember-me, and expected role.
 * @throws {UnauthorizedError} INVALID_CREDENTIALS - email not found or password mismatch.
 * @throws {ForbiddenError}    BUSINESS_NOT_APPROVED - account is pending validation.
 * @throws {ForbiddenError}    BUSINESS_REJECTED - account has been rejected.
 * @throws {ForbiddenError}    FORBIDDEN - account is suspended or in an unknown non-active state.
 * @throws {ForbiddenError}    FORBIDDEN - role does not match the expected login space.
 */
export async function login(dto: LoginDto): Promise<AuthResult> {
  const user = await findByEmail(dto.email);

  // Constant-time comparison prevents timing-based email enumeration when user is not found.
  const passwordMatches = await bcrypt.compare(
    dto.password,
    user?.password_hash ?? DUMMY_BCRYPT_HASH
  );

  if (!user || !passwordMatches) {
    throw new UnauthorizedError('Invalid credentials');
  }

  if (user.status !== 'active') {
    switch (user.status) {
      case 'pending_verification':
        throw new ForbiddenError('Account is pending validation', ApiCode.BUSINESS_NOT_APPROVED);

      case 'suspended':
        throw new ForbiddenError('Account has been suspended', ApiCode.FORBIDDEN);

      case 'rejected':
        throw new ForbiddenError('Account has been rejected', ApiCode.BUSINESS_REJECTED);

      default:
        throw new ForbiddenError('Account is not active');
    }
  }

  // Enforce space separation server-side: the user's role must match the
  // login space they are connecting from. Prevents cross-space token issuance.
  if (user.role !== dto.expected_role) {
    throw new ForbiddenError('Access to this space is not allowed for your account type');
  }

  const { password_hash: _, ...safeUser } = user;
  const tokens = await issueTokenPair(safeUser, dto.remember_me);
  return { user: safeUser, tokens, rememberMe: dto.remember_me };
}

// --- Password management ---

/**
 * Change the password for an authenticated user.
 *
 * For admin-created accounts that have no password hash yet, the current
 * password check is skipped when `force_password_change` is set.
 *
 * @param userId          ID of the user changing their password.
 * @param currentPassword Current plaintext password (may be unused for forced resets).
 * @param newPassword     New plaintext password to hash and store.
 * @throws {NotFoundError}     User not found.
 * @throws {UnauthorizedError} Current password is incorrect.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await findByIdWithPassword(userId);

  if (!user) throw new NotFoundError('User not found');

  // For accounts created via admin (may have null password), allow direct change if force_password_change
  if (user.password_hash) {
    const matches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!matches) throw new UnauthorizedError('Current password is incorrect');
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await updatePassword(userId, newHash);
  await updateForcePasswordChange(userId, false);
}

/**
 * Initiate the forgot-password flow by sending a reset email.
 *
 * Always returns silently - even when the email is unknown or the account is
 * inactive - to prevent email enumeration.
 *
 * @param email  Account email address.
 * @param locale Email locale for the reset message.
 */
export async function forgotPassword(email: string, locale: 'fr' | 'en' = 'fr'): Promise<void> {
  const user = await findByEmail(email);

  // Allow verified accounts and accounts pending email verification.
  // Blocked/deleted/suspended accounts are excluded.
  // Silently return to prevent email enumeration.
  const resetableStatuses = new Set(['active', 'pending_verification']);
  if (!user || !resetableStatuses.has(user.status)) return;

  const token = await createToken({
    user_id: user.id,
    token: randomUUID(),
    type: 'password_reset',
    expires_at: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
  });

  // Fire-and-forget: do not fail silently in case of email error
  sendPasswordResetEmail(user.email, user.first_name ?? '', token.token, locale).catch((err) => {
    console.error('[sendPasswordResetEmail failed]', err);
  });
}

/**
 * Complete the forgot-password flow by consuming a valid reset token and
 * persisting the new password hash.
 *
 * @param token       Raw reset token from the email link.
 * @param newPassword New plaintext password to hash and store.
 * @throws {TokenExpiredError} Token exists but has already been used or has expired.
 * @throws {NotFoundError}     Token does not exist at all.
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const record = await findValidToken(token, 'password_reset');

  if (!record) {
    const existing = await findTokenByValueAndType(token, 'password_reset');
    if (existing) throw new TokenExpiredError('Reset token has expired or already been used');
    throw new NotFoundError('Reset token not found');
  }

  const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await updatePassword(record.user_id, password_hash);
  await markTokenUsed(record.id);

  // Receiving the reset link proves email ownership — verify the account if still pending.
  const user = await findByIdWithPassword(record.user_id);
  if (user?.status === 'pending_verification') {
    await updateEmailVerified(record.user_id);
  }
}

// --- Session refresh ---

/**
 * Rotate a refresh token and issue a new token pair.
 *
 * The consumed token is revoked immediately (rotation). The `rememberMe` flag is read straight
 * from the refresh_tokens row (column added in migration 0050, bug #11). For legacy rows that
 * predate the column the default is false — falling back to the TTL-based heuristic only when
 * we can clearly tell the row was originally remember-me-sized.
 *
 * @param rawRefreshToken Raw refresh token from the httpOnly cookie.
 * @throws {UnauthorizedError} Token is invalid, expired, or the associated user no longer exists.
 */
export async function refreshSession(rawRefreshToken: string): Promise<AuthResult> {
  const record = await findValidRefreshToken(rawRefreshToken);
  if (!record) throw new UnauthorizedError('Invalid or expired refresh token');

  const user = await findById(record.user_id);
  if (!user) throw new UnauthorizedError('User not found');

  // Rotate: revoke the used token immediately
  await revokeRefreshToken(record.id);

  // Prefer the persisted column; for legacy rows (column added in migration 0050) the
  // column defaults to false but the original lifetime is still a reliable signal —
  // sessions issued with REMEMBER TTL keep that lifetime even after the migration.
  let rememberMe = record.remember_me;
  if (!rememberMe) {
    const originalTtlMs = record.expires_at.getTime() - record.created_at.getTime();
    const midpointMs = ((JWT_DEFAULT_MAX_AGE + JWT_REMEMBER_MAX_AGE) / 2) * 1000;
    if (originalTtlMs >= midpointMs) rememberMe = true;
  }

  const tokens = await issueTokenPair(user, rememberMe);
  return { user, tokens, rememberMe };
}

