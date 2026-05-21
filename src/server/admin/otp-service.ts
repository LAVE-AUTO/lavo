/**
 * OTP service for admin sensitive operations (email change, password change).
 *
 * Generates a 6-digit code, stores its SHA-256 hash in emailVerificationTokens
 * with type='admin_otp_<purpose>', and verifies submitted codes against the stored hash.
 *
 * Security:
 *   - The raw code is never persisted; only its SHA-256 hash.
 *   - The token type encodes the purpose so a password_change OTP cannot be
 *     replayed against the email_change endpoint (and vice versa).
 *   - Tokens expire after 10 minutes.
 *   - A token is marked used_at on first successful verification (one-time use).
 *   - Hash comparison uses crypto.timingSafeEqual to prevent timing side-channels.
 */
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { emailVerificationTokens } from '@/lib/db/schema';
import { NotFoundError, TokenExpiredError } from '@/lib/errors';
import { sendAdminOtpEmail } from '@/lib/email';
import { OTP_TTL_MS } from '@/helpers/server-constants';

// %%%%% Constants %%%%%

/** Prefix for all admin OTP token types stored in emailVerificationTokens. */
const OTP_TYPE_PREFIX = 'admin_otp_';

// %%%%% END - Constants %%%%%


// %%%%% Helpers %%%%%

/**
 * Computes the SHA-256 hex digest of a 6-digit OTP code.
 *
 * @param code - The raw 6-digit string.
 * @returns The hex-encoded SHA-256 hash.
 */
function hashOtpCode(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

/**
 * Constant-time comparison of two hex strings of equal length.
 * Uses crypto.timingSafeEqual to prevent timing side-channel attacks.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/**
 * Generates a zero-padded 6-digit integer string using crypto.randomInt.
 *
 * @returns A string like "047391".
 */
function generateRawOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

// %%%%% END - Helpers %%%%%


// %%%%% OTP operations %%%%%

export type OtpPurpose = 'email_change' | 'password_change';

/**
 * Returns the token type string for a given OTP purpose.
 * Stored in emailVerificationTokens.type so that verification
 * is scoped to a specific operation and cannot be cross-purposed.
 */
function tokenTypeForPurpose(purpose: OtpPurpose): string {
  return `${OTP_TYPE_PREFIX}${purpose}`;
}

/**
 * Generates a 6-digit OTP, stores its SHA-256 hash in emailVerificationTokens,
 * and dispatches the OTP email to the admin.
 *
 * The token type encodes the purpose (e.g. 'admin_otp_email_change') so that a
 * code issued for one operation cannot be used for another.
 *
 * Any previously unused tokens for the same admin+purpose are superseded by the
 * new insert. The verify step picks the latest non-expired unused token for the
 * same purpose, so re-requesting naturally invalidates the prior code.
 *
 * @param adminId    - UUID of the admin requesting the OTP.
 * @param adminEmail - Email address to send the OTP to.
 * @param adminName  - Display name for the email greeting.
 * @param purpose    - Reason for the OTP; scopes the token type.
 */
export async function generateAndSendAdminOtp(
  adminId: string,
  adminEmail: string,
  adminName: string,
  purpose: OtpPurpose
): Promise<void> {
  const rawCode  = generateRawOtp();
  const hashed   = hashOtpCode(rawCode);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db.insert(emailVerificationTokens).values({
    user_id:    adminId,
    token:      hashed,
    type:       tokenTypeForPurpose(purpose),
    expires_at: expiresAt,
  });

  // Best-effort email send — do not block the insert on email failure.
  await sendAdminOtpEmail(adminEmail, adminName, rawCode, purpose).catch((err) =>
    console.error('[otp-service] Failed to send OTP email', err)
  );
}

/**
 * Verifies a submitted OTP code against the stored hash for a specific purpose.
 *
 * Finds the most recent non-expired, unused token for the admin+purpose pair,
 * then compares the SHA-256 hash of the submitted code using a constant-time
 * comparison. On success, marks the token used_at.
 *
 * @param adminId - UUID of the admin who submitted the OTP.
 * @param code    - The raw 6-digit code submitted by the admin.
 * @param purpose - The operation this OTP was requested for.
 * @throws {NotFoundError}     If no valid (non-expired, unused) token exists for this purpose.
 * @throws {TokenExpiredError} If a token exists but the code hash does not match.
 */
export async function verifyAdminOtp(adminId: string, code: string, purpose: OtpPurpose): Promise<void> {
  const now = new Date();
  const hashed = hashOtpCode(code);

  // Find the most recent unused, non-expired OTP token scoped to this purpose.
  const token = await db.query.emailVerificationTokens.findFirst({
    where: and(
      eq(emailVerificationTokens.user_id, adminId),
      eq(emailVerificationTokens.type, tokenTypeForPurpose(purpose)),
      isNull(emailVerificationTokens.used_at),
      gt(emailVerificationTokens.expires_at, now)
    ),
    orderBy: (t, { desc }) => [desc(t.created_at)],
  });

  if (!token) {
    throw new NotFoundError('No valid OTP found. Please request a new code.');
  }

  if (!safeEqual(token.token, hashed)) {
    throw new TokenExpiredError('Invalid OTP code.');
  }

  // Mark as used (one-time use).
  await db
    .update(emailVerificationTokens)
    .set({ used_at: now })
    .where(eq(emailVerificationTokens.id, token.id));
}

// %%%%% END - OTP operations %%%%%
