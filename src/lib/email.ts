import { Resend } from 'resend';
import { APP_URL } from '@/helpers/constants';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? 'noreply@lavo.app';

export async function sendPasswordResetEmail(
  to: string,
  firstName: string,
  token: string
): Promise<void> {
  const link = `${APP_URL}/fr/reset-password?token=${token}`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Reset your LAVO password',
    html: `
      <p>Hi ${firstName},</p>
      <p>You requested a password reset. Click the link below to set a new password:</p>
      <p><a href="${link}">Reset my password</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you did not request a password reset, you can safely ignore this email.</p>
    `,
  });
}

export async function sendVerificationEmail(
  to: string,
  firstName: string,
  token: string
): Promise<void> {
  const link = `${APP_URL}/fr/verify-email?token=${token}`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Verify your LAVO account',
    html: `
      <p>Hi ${firstName},</p>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${link}">Verify my account</a></p>
      <p>This link expires in 24 hours.</p>
      <p>If you did not create an account, you can ignore this email.</p>
    `,
  });
}

/**
 * Sends an email to the admin when a new station application is submitted.
 * No-op if ADMIN_NOTIFICATION_EMAIL is not set (logs and skips).
 */
export async function sendStationApplicationAdminNotification(
  stationName: string,
  stationId: string
): Promise<void> {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  if (!adminEmail) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        'sendStationApplicationAdminNotification: ADMIN_NOTIFICATION_EMAIL not set, skipping'
      );
    }
    return;
  }

  await resend.emails.send({
    from: FROM,
    to: adminEmail,
    subject: `[LAVO] New station application: ${stationName}`,
    html: `
      <p>A new station application has been submitted.</p>
      <p><strong>Station name:</strong> ${stationName}</p>
      <p><strong>Station ID:</strong> ${stationId}</p>
      <p>Please review the application in the admin panel.</p>
    `,
  });
}
