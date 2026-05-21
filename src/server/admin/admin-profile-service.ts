/**
 * Admin profile service.
 *
 * Handles CRUD operations for the authenticated admin's own profile:
 *   - Get profile (safe, no password_hash)
 *   - Update basic info (name, phone)
 *   - OTP-gated email change
 *   - OTP-gated password change
 *
 * All mutations are logged to admin_logs.
 * OTP operations delegate to otp-service.ts.
 */
import bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from '@/helpers/server-constants';
import { NotFoundError, ConflictError, UnauthorizedError } from '@/lib/errors';
import { insertAdminLog } from './admin-log-repository';
import * as repo from './admin-user-repository';
import { generateAndSendAdminOtp, verifyAdminOtp } from './otp-service';
import type { AdminSafeUser } from './admin-user-repository';
import type { AdminProfileUpdateInput } from '@/validators/admin-user';
import type { OtpPurpose } from './otp-service';


// %%%%% Types %%%%%

export type SafeAdminProfile = Omit<AdminSafeUser, 'stripe_customer_id'>;

// %%%%% END - Types %%%%%


// %%%%% Helpers %%%%%

function stripStripe(user: AdminSafeUser): SafeAdminProfile {
  const { stripe_customer_id: _stripe, ...safe } = user;
  return safe;
}

// %%%%% END - Helpers %%%%%


// %%%%% Profile operations %%%%%

/**
 * Returns the admin's profile record without sensitive fields.
 *
 * @param adminId - UUID of the authenticated admin.
 * @returns The admin's safe profile.
 * @throws {NotFoundError} If the admin user is not found.
 */
export async function getAdminProfile(adminId: string): Promise<SafeAdminProfile> {
  const user = await repo.findAdminById(adminId);
  if (!user) throw new NotFoundError('Admin profile not found');
  return stripStripe(user);
}

/**
 * Updates the admin's basic profile fields (name and/or phone).
 * Writes an audit log entry with before/after diff.
 *
 * @param adminId - UUID of the authenticated admin.
 * @param data    - Validated update payload (at least one field required).
 * @returns The updated safe profile.
 * @throws {NotFoundError} If the admin user is not found.
 */
export async function updateAdminProfile(
  adminId: string,
  data: AdminProfileUpdateInput
): Promise<SafeAdminProfile> {
  const before = await repo.findAdminById(adminId);
  if (!before) throw new NotFoundError('Admin profile not found');

  const updateFields: Parameters<typeof repo.updateAdminById>[1] = {};
  if (data.first_name !== undefined) updateFields.first_name = data.first_name;
  if (data.last_name  !== undefined) updateFields.last_name  = data.last_name;
  if (data.phone      !== undefined) updateFields.phone      = data.phone ?? null;

  const after = await repo.updateAdminById(adminId, updateFields);
  if (!after) throw new NotFoundError('Admin profile not found');

  insertAdminLog({
    admin_id:    adminId,
    action:      'UPDATE_OWN_PROFILE',
    target_type: 'user',
    target_id:   adminId,
    details:     {
      before: { first_name: before.first_name, last_name: before.last_name, phone: before.phone },
      after:  { first_name: after.first_name,  last_name: after.last_name,  phone: after.phone  },
    },
  }).catch((err) => console.error('[admin-profile-service] Audit log failed', err));

  return stripStripe(after);
}

/**
 * Generates and sends a 6-digit OTP to the admin's current email address.
 *
 * @param adminId - UUID of the authenticated admin.
 * @param purpose - Reason for the OTP ('email_change' | 'password_change').
 * @throws {NotFoundError} If the admin user is not found.
 */
export async function requestOtp(adminId: string, purpose: OtpPurpose): Promise<void> {
  const user = await repo.findAdminById(adminId);
  if (!user) throw new NotFoundError('Admin profile not found');

  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Admin';
  await generateAndSendAdminOtp(adminId, user.email, name, purpose);
}

/**
 * Changes the admin's email address after OTP verification.
 * Checks for email uniqueness before applying the change.
 * Writes an audit log entry.
 *
 * @param adminId  - UUID of the authenticated admin.
 * @param newEmail - The desired new email address.
 * @param otpCode  - The 6-digit OTP code submitted by the admin.
 * @returns The updated safe profile with the new email.
 * @throws {NotFoundError}   If the admin is not found or OTP is invalid.
 * @throws {TokenExpiredError} If the OTP code is wrong.
 * @throws {ConflictError}   If the new email is already in use.
 */
export async function changeAdminEmail(
  adminId: string,
  newEmail: string,
  otpCode: string
): Promise<SafeAdminProfile> {
  await verifyAdminOtp(adminId, otpCode, 'email_change');

  const before = await repo.findAdminById(adminId);
  if (!before) throw new NotFoundError('Admin profile not found');

  const taken = await repo.findUserByEmail(newEmail);
  if (taken && taken.id !== adminId) throw new ConflictError('Email address is already in use');

  const after = await repo.updateAdminById(adminId, { email: newEmail });
  if (!after) throw new NotFoundError('Admin profile not found');

  insertAdminLog({
    admin_id:    adminId,
    action:      'CHANGE_OWN_EMAIL',
    target_type: 'user',
    target_id:   adminId,
    details:     { before: { email: before.email }, after: { email: after.email } },
  }).catch((err) => console.error('[admin-profile-service] Audit log failed', err));

  return stripStripe(after);
}

/**
 * Changes the admin's password after OTP and current-password verification.
 * Hashes the new password with bcrypt before storing it.
 * Writes an audit log entry.
 *
 * @param adminId         - UUID of the authenticated admin.
 * @param currentPassword - The admin's current plain-text password.
 * @param newPassword     - The new plain-text password to set.
 * @param otpCode         - The 6-digit OTP code submitted by the admin.
 * @throws {NotFoundError}     If the admin is not found or OTP is invalid.
 * @throws {TokenExpiredError} If the OTP code is wrong.
 * @throws {UnauthorizedError} If the current password does not match.
 */
export async function changeAdminPassword(
  adminId: string,
  currentPassword: string,
  newPassword: string,
  otpCode: string
): Promise<void> {
  await verifyAdminOtp(adminId, otpCode, 'password_change');

  const userWithPassword = await repo.findUserWithPasswordById(adminId);
  if (!userWithPassword) throw new NotFoundError('Admin profile not found');
  if (userWithPassword.role !== 'admin') throw new NotFoundError('Admin profile not found');

  const passwordMatch = await bcrypt.compare(currentPassword, userWithPassword.password_hash ?? '');
  if (!passwordMatch) throw new UnauthorizedError('Current password is incorrect');

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await repo.updateAdminById(adminId, { password_hash: newHash });

  insertAdminLog({
    admin_id:    adminId,
    action:      'CHANGE_OWN_PASSWORD',
    target_type: 'user',
    target_id:   adminId,
    details:     { changed: true },
  }).catch((err) => console.error('[admin-profile-service] Audit log failed', err));
}

// %%%%% END - Profile operations %%%%%
