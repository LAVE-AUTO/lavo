import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { signJwt } from '@/lib/jwt';
import { sendVerificationEmail } from '@/lib/email';
import { ConflictError, NotFoundError } from '@/lib/errors';
import {
  findByEmail,
  createUser,
  updateEmailVerified,
  type SafeUser,
} from './user-repository';
import { createToken, findValidToken, markTokenUsed } from './token-repository';

export type RegisterDto = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  remember_me: boolean;
};

export type RegisterResult = {
  user: SafeUser;
  jwt: string;
};

export async function registerWithPassword(
  dto: RegisterDto
): Promise<RegisterResult> {
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
  sendVerificationEmail(user.email, user.first_name, token.token).catch(
    () => void 0
  );

  const jwt = await signJwt(
    { sub: user.id, role: user.role, email: user.email, status: user.status },
    dto.remember_me
  );

  return { user, jwt };
}

export async function verifyEmail(token: string): Promise<void> {
  const record = await findValidToken(token, 'email_verification');
  if (!record) throw new NotFoundError('Invalid or expired verification token');

  await updateEmailVerified(record.user_id);
  await markTokenUsed(record.id);
}

export async function findOrCreateOAuthUser(data: {
  email: string;
  firstName: string;
  lastName: string;
}): Promise<SafeUser> {
  const existing = await findByEmail(data.email);
  if (existing) {
    // Return safe version without password_hash
    const { password_hash: _, ...safe } = existing;
    return safe;
  }

  return createUser({
    first_name: data.firstName,
    last_name: data.lastName,
    email: data.email,
    password_hash: null,
    role: 'client',
    status: 'active',
    email_verified_at: new Date(),
  });
}
