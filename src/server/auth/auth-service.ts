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
import { ACCESS_TOKEN_MAX_AGE, JWT_DEFAULT_MAX_AGE, JWT_REMEMBER_MAX_AGE } from '@/helpers/constants';
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

export type RegisterDto = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  remember_me: boolean;
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

  await createRefreshToken(user.id, rawRefreshToken, expiresAt);

  return { accessJwt, rawRefreshToken, expiresIn: ACCESS_TOKEN_MAX_AGE };
}

export async function registerWithPassword(dto: RegisterDto, locale: 'fr' | 'en' = 'fr'): Promise<AuthResult> {
  const existing = await findByEmail(dto.email);
  if (existing) throw new ConflictError('Email already in use');

  const password_hash = await bcrypt.hash(dto.password, 12);

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
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  // Fire-and-forget: do not block registration on email failure
  sendVerificationEmail(user.email, user.first_name ?? '', token.token, locale).catch(
    () => void 0
  );

  const tokens = await issueTokenPair(user, dto.remember_me);
  return { user, tokens, rememberMe: dto.remember_me };
}

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

export async function resendVerificationEmail(email: string, locale: 'fr' | 'en' = 'fr'): Promise<void> {
  const user = await findByEmail(email);
  if (!user) throw new NotFoundError('No account found with this email address');
  if (user.status === 'active') throw new ConflictError('Email is already verified');

  const token = await createToken({
    user_id: user.id,
    token: randomUUID(),
    type: 'email_verification',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  await sendVerificationEmail(user.email, user.first_name ?? '', token.token, locale);
}

export async function findOrCreateOAuthUser(data: {
  email: string;
  firstName: string;
  lastName: string;
}): Promise<AuthResult> {
  let user: SafeUser;

  const existing = await findByEmail(data.email);
  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip password_hash
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

export type LoginDto = {
  email: string;
  password: string;
  remember_me: boolean;
};

export async function login(dto: LoginDto): Promise<AuthResult> {
  const user = await findByEmail(dto.email);

  // Use constant-time comparison to prevent timing attacks even when user not found
  const dummyHash = '$2b$12$invalidhashfortimingprotection000000000000000000000000';
  const passwordMatches = await bcrypt.compare(
    dto.password,
    user?.password_hash ?? dummyHash
  );

  if (!user || !passwordMatches) {
    throw new UnauthorizedError('Invalid credentials');
  }

  if (user.status !== 'active') {
    throw new ForbiddenError('Account is not active');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip password_hash
  const { password_hash: _, ...safeUser } = user;
  const tokens = await issueTokenPair(safeUser, dto.remember_me);
  return { user: safeUser, tokens, rememberMe: dto.remember_me };
}

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

  const newHash = await bcrypt.hash(newPassword, 12);
  await updatePassword(userId, newHash);
  await updateForcePasswordChange(userId, false);
}

export async function forgotPassword(email: string, locale: 'fr' | 'en' = 'fr'): Promise<void> {
  const user = await findByEmail(email);

  // Always return silently to prevent email enumeration
  if (!user || user.status !== 'active') return;

  const token = await createToken({
    user_id: user.id,
    token: randomUUID(),
    type: 'password_reset',
    expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  });

  // Fire-and-forget: do not fail silently in case of email error
  sendPasswordResetEmail(user.email, user.first_name ?? '', token.token, locale).catch(
    () => void 0
  );
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const record = await findValidToken(token, 'password_reset');

  if (!record) {
    const existing = await findTokenByValueAndType(token, 'password_reset');
    if (existing) throw new TokenExpiredError('Reset token has expired or already been used');
    throw new NotFoundError('Reset token not found');
  }

  const password_hash = await bcrypt.hash(newPassword, 12);
  await updatePassword(record.user_id, password_hash);
  await markTokenUsed(record.id);
}

export async function refreshSession(rawRefreshToken: string): Promise<AuthResult> {
  const record = await findValidRefreshToken(rawRefreshToken);
  if (!record) throw new UnauthorizedError('Invalid or expired refresh token');

  const user = await findById(record.user_id);
  if (!user) throw new UnauthorizedError('User not found');

  // Rotate: revoke the used token immediately
  await revokeRefreshToken(record.id);

  // Determine rememberMe from remaining time: if > 1 day remaining → rememberMe
  const remainingMs = record.expires_at.getTime() - Date.now();
  const rememberMe = remainingMs > JWT_DEFAULT_MAX_AGE * 1000;

  const tokens = await issueTokenPair(user, rememberMe);
  return { user, tokens, rememberMe };
}
