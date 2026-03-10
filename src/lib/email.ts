import { Resend } from 'resend';
import { APP_URL } from '@/helpers/constants';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? 'noreply@lavo.app';

type Locale = 'fr' | 'en';

/* ------------------------------------------------------------------ */
/*  i18n text maps                                                      */
/* ------------------------------------------------------------------ */

const TEXTS = {
  verification: {
    fr: {
      subject: 'Vérifiez votre compte Slowtime',
      greeting: (name: string) => `Bonjour ${name},`,
      body: 'Merci de vous être inscrit sur Slowtime. Veuillez confirmer votre adresse e-mail en cliquant sur le bouton ci-dessous.',
      cta: 'Vérifier mon compte',
      expiry: 'Ce lien expire dans 24 heures.',
      ignore: "Si vous n'avez pas créé de compte, vous pouvez ignorer cet e-mail.",
    },
    en: {
      subject: 'Verify your Slowtime account',
      greeting: (name: string) => `Hi ${name},`,
      body: 'Thank you for signing up for Slowtime. Please confirm your email address by clicking the button below.',
      cta: 'Verify my account',
      expiry: 'This link expires in 24 hours.',
      ignore: 'If you did not create an account, you can safely ignore this email.',
    },
  },
  passwordReset: {
    fr: {
      subject: 'Réinitialisation de votre mot de passe Slowtime',
      greeting: (name: string) => `Bonjour ${name},`,
      body: 'Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en définir un nouveau.',
      cta: 'Réinitialiser mon mot de passe',
      expiry: 'Ce lien expire dans 1 heure.',
      ignore: "Si vous n'avez pas fait cette demande, vous pouvez ignorer cet e-mail.",
    },
    en: {
      subject: 'Reset your Slowtime password',
      greeting: (name: string) => `Hi ${name},`,
      body: 'You requested a password reset. Click the button below to set a new password.',
      cta: 'Reset my password',
      expiry: 'This link expires in 1 hour.',
      ignore: 'If you did not request a password reset, you can safely ignore this email.',
    },
  },
  stationApproval: {
    fr: {
      subject: (name: string) => `[Slowtime] Votre station ${name} a été approuvée`,
      greeting: 'Bonjour,',
      body: (name: string) =>
        `Nous avons le plaisir de vous informer que votre station <strong>${name}</strong> a été approuvée et est maintenant active sur Slowtime.`,
      extra: 'Vous pouvez dès à présent vous connecter avec votre adresse e-mail et le mot de passe choisi lors de votre inscription.',
      cta: 'Se connecter à Slowtime',
      closing: 'Bienvenue dans la communauté Slowtime !',
    },
    en: {
      subject: (name: string) => `[Slowtime] Your station ${name} has been approved`,
      greeting: 'Hello,',
      body: (name: string) =>
        `We are pleased to inform you that your station <strong>${name}</strong> has been approved and is now active on Slowtime.`,
      extra: 'You can now log in using the email address and password you chose during registration.',
      cta: 'Log in to Slowtime',
      closing: 'Welcome to the Slowtime community!',
    },
  },
  footer: {
    fr: {
      teamLine: "L'équipe Slowtime",
      autoMessage: 'Cet e-mail a été envoyé automatiquement. Merci de ne pas y répondre.',
      copyright: `© ${new Date().getFullYear()} Slowtime. Tous droits réservés.`,
    },
    en: {
      teamLine: 'The Slowtime Team',
      autoMessage: 'This email was sent automatically. Please do not reply.',
      copyright: `© ${new Date().getFullYear()} Slowtime. All rights reserved.`,
    },
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Branded HTML layout                                                 */
/* ------------------------------------------------------------------ */

function brandedEmail(
  locale: Locale,
  opts: {
    greeting: string;
    bodyHtml: string;
    ctaUrl?: string;
    ctaLabel?: string;
    footNote?: string;
  }
): string {
  const f = TEXTS.footer[locale];
  const logoUrl = `${APP_URL}/logo/frame2.png`;

  const ctaBlock = opts.ctaUrl && opts.ctaLabel
    ? `
      <tr>
        <td align="center" style="padding: 28px 0 8px;">
          <a href="${opts.ctaUrl}" target="_blank" rel="noopener" style="
            display: inline-block;
            background-color: #af8408;
            color: #ffffff;
            font-family: 'Rajdhani', 'Segoe UI', Tahoma, sans-serif;
            font-size: 16px;
            font-weight: 700;
            text-decoration: none;
            padding: 14px 40px;
            border-radius: 8px;
            letter-spacing: 0.03em;
          ">${opts.ctaLabel}</a>
        </td>
      </tr>`
    : '';

  const footNoteBlock = opts.footNote
    ? `<tr><td style="padding: 8px 0 0; font-size: 14px; color: #888888; line-height: 1.6;">${opts.footNote}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="${locale}" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Slowtime</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f2ec; font-family: 'Rajdhani', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f2ec; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%;">

          <!-- Logo header -->
          <tr>
            <td align="center" style="padding: 0 0 24px;">
              <img src="${logoUrl}" alt="Slowtime" width="48" height="48" style="display: block; border: 0; width: 48px; height: 48px;" />
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="
              background-color: #ffffff;
              border-radius: 16px;
              padding: 40px 36px;
              box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
            ">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <!-- Greeting -->
                <tr>
                  <td style="
                    font-size: 18px;
                    font-weight: 700;
                    color: #1A1A1A;
                    padding-bottom: 16px;
                    line-height: 1.4;
                  ">${opts.greeting}</td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="
                    font-size: 15px;
                    color: #444444;
                    line-height: 1.7;
                    padding-bottom: 4px;
                  ">${opts.bodyHtml}</td>
                </tr>

                <!-- CTA button -->
                ${ctaBlock}

                <!-- Foot note (expiry, ignore) -->
                ${footNoteBlock}
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 28px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top: 1px solid #e8e4da;"></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 20px 0 0;">
              <p style="margin: 0 0 4px; font-size: 13px; color: #af8408; font-weight: 600; letter-spacing: 0.04em;">${f.teamLine}</p>
              <p style="margin: 0 0 4px; font-size: 12px; color: #aaaaaa;">${f.autoMessage}</p>
              <p style="margin: 0; font-size: 12px; color: #aaaaaa;">${f.copyright}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Public email functions                                              */
/* ------------------------------------------------------------------ */

export async function sendVerificationEmail(
  to: string,
  firstName: string,
  token: string,
  locale: Locale = 'fr'
): Promise<void> {
  const t = TEXTS.verification[locale];
  const link = `${APP_URL}/${locale}/verify-email?token=${token}`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: t.subject,
    html: brandedEmail(locale, {
      greeting: t.greeting(firstName || (locale === 'fr' ? 'cher utilisateur' : 'there')),
      bodyHtml: t.body,
      ctaUrl: link,
      ctaLabel: t.cta,
      footNote: `${t.expiry}<br/>${t.ignore}`,
    }),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  firstName: string,
  token: string,
  locale: Locale = 'fr'
): Promise<void> {
  const t = TEXTS.passwordReset[locale];
  const link = `${APP_URL}/${locale}/reset-password?token=${token}`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: t.subject,
    html: brandedEmail(locale, {
      greeting: t.greeting(firstName || (locale === 'fr' ? 'cher utilisateur' : 'there')),
      bodyHtml: t.body,
      ctaUrl: link,
      ctaLabel: t.cta,
      footNote: `${t.expiry}<br/>${t.ignore}`,
    }),
  });
}

export async function sendStationApprovalEmail(
  to: string,
  stationName: string,
  locale: Locale = 'fr'
): Promise<void> {
  const t = TEXTS.stationApproval[locale];
  const loginUrl = `${APP_URL}/${locale}/login`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: t.subject(stationName),
    html: brandedEmail(locale, {
      greeting: t.greeting,
      bodyHtml: `${t.body(stationName)}<br/><br/>${t.extra}`,
      ctaUrl: loginUrl,
      ctaLabel: t.cta,
      footNote: t.closing,
    }),
  });
}

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
    subject: `[Slowtime] New station application: ${stationName}`,
    html: brandedEmail('en', {
      greeting: 'New station application',
      bodyHtml: `
        <p style="margin: 0 0 8px;"><strong>Station name:</strong> ${stationName}</p>
        <p style="margin: 0;"><strong>Station ID:</strong> ${stationId}</p>
      `,
      footNote: 'Please review the application in the admin panel.',
    }),
  });
}

/* ------------------------------------------------------------------ */
/*  Locale helper for API routes                                        */
/* ------------------------------------------------------------------ */

/**
 * Extract locale from the Accept-Language header.
 * Returns 'fr' or 'en' (defaults to 'fr').
 */
export function extractLocale(headerValue: string | null): Locale {
  if (!headerValue) return 'fr';
  const primary = headerValue.split(',')[0].trim().toLowerCase();
  if (primary.startsWith('en')) return 'en';
  return 'fr';
}
