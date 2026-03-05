import { Resend } from 'resend';
import { APP_URL } from '@/helpers/constants';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? 'noreply@lavo.app';

export async function sendVerificationEmail(
  to: string,
  firstName: string,
  token: string
): Promise<void> {
  const link = `${APP_URL}/api/v1/auth/verify-email?token=${token}`;

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
