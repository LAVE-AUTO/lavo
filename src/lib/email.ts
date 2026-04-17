/**
 * Email service: build and send transactional emails via Resend.
 *
 * Features:
 *   - Lazy-loading Resend client (avoids initializing without API key)
 *   - HTML escaping and URL validation (security)
 *   - Bilingual email templates (fr / en)
 *   - QR code generation for station booking links
 *   - Customizable copy via platform settings (admin-configurable)
 *
 * Template types:
 *   - Email verification (sign-up confirmation)
 *   - Password reset
 *   - Station rejection / approval (with QR codes)
 *   - Payment success confirmation
 *   - Weekly escrow transactions report
 */
import { Resend } from 'resend';
import QRCode from 'qrcode';
import { APP_URL } from '@/helpers/constants';
import { getPlatformSetting } from '@/server/admin/platform-settings-service';


// %%%%% Constants %%%%%
// Email configuration

const FROM = process.env.EMAIL_FROM ?? 'noreply@lavo.app';

type Locale = 'fr' | 'en';


// %%%%% Resend client (singleton) %%%%%
// Lazy initialization with warnings

let warnedResendApiKeyMissing = false;
let resendClient: Resend | null | undefined;


// %%%%% MODULE — Resend client %%%%%
// Lazy singleton; never pass undefined to the SDK.


/**
 * Returns a Resend client when `RESEND_API_KEY` is set; otherwise null.
 * Caches the client after first call (singleton pattern).
 */
function getResendClient(): Resend | null {
  if (resendClient !== undefined) return resendClient;
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    resendClient = null;
    return null;
  }
  resendClient = new Resend(key);
  return resendClient;
}

/**
 * Logs a single warning when Resend is not configured.
 * Skipped in test environment to avoid noise in test logs.
 */
function warnResendMissingOnce(context: string): void {
  if (process.env.NODE_ENV === 'test' || warnedResendApiKeyMissing) return;
  warnedResendApiKeyMissing = true;
  console.warn(`${context}: RESEND_API_KEY not set, skipping email`);
}


// %%%%% END - Resend client %%%%%


// %%%%% Security & validation %%%%%
// HTML escaping, URL validation, recipient sanity checks


/**
 * Escapes HTML special characters to prevent injection in email bodies.
 * Converts &, <, >, " to their entity equivalents.
 */
function escapeHtmlPlain(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Sanitizes plain text for email subjects and snippets.
 * Removes newlines to prevent header/log injection.
 */
function safePlainTextSnippet(text: string, maxLen: number): string {
  return text.replace(/\r|\n/g, ' ').trim().slice(0, maxLen);
}

/**
 * Validates and returns a URL safe for email CTAs.
 * Only allows http(s) URLs; blocks javascript:, data:, and other schemes.
 */
function safeHttpUrlForEmailHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const trimmed = href.trim();
  if (!trimmed) return undefined;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
    return u.href;
  } catch {
    return undefined;
  }
}

/**
 * Sanity check for recipient email addresses.
 * Verifies reasonable length and presence of @ symbol.
 */
function isReasonableRecipientEmail(to: string): boolean {
  const t = to.trim();
  if (t.length < 3 || t.length > 320) return false;
  if (!t.includes('@')) return false;
  return true;
}


// %%%%% END - Security & validation %%%%%


// %%%%% Bilingual email templates %%%%%
// Subjects, bodies, and footer text per locale (fr / en)

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
  stationRejection: {
    fr: {
      subject: (name: string) => `[Slowtime] Votre demande pour la station ${name} n'a pas été approuvée`,
      greeting: 'Bonjour,',
      body: (name: string) =>
        `Nous vous informons que votre demande d'adhésion pour la station <strong>${name}</strong> n'a malheureusement pas été approuvée par notre équipe.`,
      reasonLabel: 'Motif du refus :',
      extra: 'Vous pouvez corriger les informations et resoumettre votre dossier depuis votre espace. Pour toute question, n\'hésitez pas à contacter notre support.',
      cta: 'Resoumettre mon dossier',
      closing: 'L\'équipe Slowtime',
    },
    en: {
      subject: (name: string) => `[Slowtime] Your application for station ${name} was not approved`,
      greeting: 'Hello,',
      body: (name: string) =>
        `We regret to inform you that your membership application for station <strong>${name}</strong> has not been approved by our team.`,
      reasonLabel: 'Reason for rejection:',
      extra: 'You may correct the information and resubmit your application from your account. If you have any questions, please contact our support team.',
      cta: 'Resubmit my application',
      closing: 'The Slowtime team',
    },
  },
  stationApproval: {
    fr: {
      subject: (name: string) => `[Slowtime] Votre station ${name} a été approuvée`,
      greeting: 'Bonjour,',
      body: (name: string) =>
        `Nous avons le plaisir de vous informer que votre station <strong>${name}</strong> a été approuvée et est maintenant active sur Slowtime.`,
      extra: 'Vous pouvez dès à présent vous connecter avec votre adresse e-mail et le mot de passe choisi lors de votre inscription.',
      stripePrompt: 'Pour recevoir vos paiements, veuillez compléter la configuration de votre compte Stripe en cliquant sur le bouton ci-dessous.',
      stripeCta: 'Configurer mon compte Stripe',
      cta: 'Se connecter à Slowtime',
      closing: 'Bienvenue dans la communauté Slowtime !',
      qrLabel: 'QR réservation :',
      qrAlt: 'QR de réservation station',
      qrLinkLabel: 'Lien de réservation QR :',
    },
    en: {
      subject: (name: string) => `[Slowtime] Your station ${name} has been approved`,
      greeting: 'Hello,',
      body: (name: string) =>
        `We are pleased to inform you that your station <strong>${name}</strong> has been approved and is now active on Slowtime.`,
      extra: 'You can now log in using the email address and password you chose during registration.',
      stripePrompt: 'To receive payments, please complete your Stripe account setup by clicking the button below.',
      stripeCta: 'Set up my Stripe account',
      cta: 'Log in to Slowtime',
      closing: 'Welcome to the Slowtime community!',
      qrLabel: 'Booking QR:',
      qrAlt: 'Station booking QR',
      qrLinkLabel: 'Booking QR link:',
    },
  },
  paymentSuccess: {
    fr: {
      subject: 'Paiement confirmé — Slowtime',
      greeting: 'Bonjour,',
      lead: 'Votre paiement a bien été prélevé et votre prestation est terminée.',
      stationPrefix: 'Station :',
      refPrefix: 'Référence réservation :',
      closing: "Merci d'avoir choisi Slowtime.",
      cta: 'Ouvrir Slowtime',
    },
    en: {
      subject: 'Payment confirmed — Slowtime',
      greeting: 'Hello,',
      lead: 'Your payment has been captured and your service is complete.',
      stationPrefix: 'Station:',
      refPrefix: 'Reservation reference:',
      closing: 'Thank you for choosing Slowtime.',
      cta: 'Open Slowtime',
    },
  },
  paymentFailed: {
    fr: {
      subject: 'Paiement non abouti — Slowtime',
      greeting: 'Bonjour,',
      body: "Nous n'avons pas pu finaliser votre paiement. Votre réservation a été annulée. Vous pouvez réessayer depuis l'application lorsque vous le souhaitez.",
      reasonLabel: 'Motif indiqué :',
      cta: 'Réessayer sur Slowtime',
    },
    en: {
      subject: 'Payment could not be completed — Slowtime',
      greeting: 'Hello,',
      body: 'We could not complete your payment. Your reservation has been cancelled. You can try again from the app whenever you are ready.',
      reasonLabel: 'Details:',
      cta: 'Try again on Slowtime',
    },
  },
  footer: {
    fr: {
      teamLine: "L'équipe Slowtime",
      autoMessage: 'Cet e-mail a été envoyé automatiquement. Merci de ne pas y répondre.',
    },
    en: {
      teamLine: 'The Slowtime Team',
      autoMessage: 'This email was sent automatically. Please do not reply.',
    },
  },
} as const;


// %%%%% END - MODULE — i18n copy (TEXTS) %%%%%


// %%%%% MODULE — Branded HTML layout %%%%%
// Table-based template; optional CTA and footnote.

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

  const safeCtaHref = safeHttpUrlForEmailHref(opts.ctaUrl);
  const ctaBlock =
    safeCtaHref && opts.ctaLabel
      ? `
      <tr>
        <td align="center" style="padding: 28px 0 8px;">
          <a href="${safeCtaHref}" target="_blank" rel="noopener noreferrer" style="
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
          ">${escapeHtmlPlain(opts.ctaLabel)}</a>
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
                  ">${escapeHtmlPlain(opts.greeting)}</td>
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
              <p style="margin: 0; font-size: 12px; color: #aaaaaa;">© ${new Date().getFullYear()} Slowtime. ${locale === 'fr' ? 'Tous droits réservés.' : 'All rights reserved.'}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}


// %%%%% END - MODULE — Branded HTML layout %%%%%


// %%%%% MODULE — Transactional sends %%%%%
// Verification, password reset, station lifecycle, payment notices.

export async function sendVerificationEmail(
  to: string,
  firstName: string,
  token: string,
  locale: Locale = 'fr'
): Promise<void> {
  const client = getResendClient();
  if (!client) {
    warnResendMissingOnce('sendVerificationEmail');
    return;
  }
  if (!isReasonableRecipientEmail(to)) return;

  const t = TEXTS.verification[locale];
  const link =
    safeHttpUrlForEmailHref(
      `${APP_URL}/${locale}/verify-email?token=${encodeURIComponent(token)}`
    ) ?? '';

  await client.emails.send({
    from: FROM,
    to,
    subject: t.subject,
    html: brandedEmail(locale, {
      greeting: t.greeting(firstName || (locale === 'fr' ? 'cher utilisateur' : 'there')),
      bodyHtml: t.body,
      ctaUrl: link || undefined,
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
  const client = getResendClient();
  if (!client) {
    warnResendMissingOnce('sendPasswordResetEmail');
    return;
  }
  if (!isReasonableRecipientEmail(to)) return;

  const t = TEXTS.passwordReset[locale];
  const link =
    safeHttpUrlForEmailHref(
      `${APP_URL}/${locale}/reset-password?token=${encodeURIComponent(token)}`
    ) ?? '';

  await client.emails.send({
    from: FROM,
    to,
    subject: t.subject,
    html: brandedEmail(locale, {
      greeting: t.greeting(firstName || (locale === 'fr' ? 'cher utilisateur' : 'there')),
      bodyHtml: t.body,
      ctaUrl: link || undefined,
      ctaLabel: t.cta,
      footNote: `${t.expiry}<br/>${t.ignore}`,
    }),
  });
}


export async function sendStationApprovalEmail(
  to: string,
  stationName: string,
  locale: Locale = 'fr',
  opts?: { qrPublicUrl?: string }
): Promise<void> {
  const client = getResendClient();
  if (!client) {
    warnResendMissingOnce('sendStationApprovalEmail');
    return;
  }
  if (!isReasonableRecipientEmail(to)) return;

  const t = TEXTS.stationApproval[locale];
  const loginUrl = safeHttpUrlForEmailHref(`${APP_URL}/${locale}/login`) ?? '';
  const safeQrUrl = safeHttpUrlForEmailHref(opts?.qrPublicUrl);
  const subjectName = safePlainTextSnippet(stationName, 200);
  const escapedName = escapeHtmlPlain(safePlainTextSnippet(stationName, 500));
  let qrImageDataUrl: string | null = null;

  if (safeQrUrl) {
    try {
      qrImageDataUrl = await QRCode.toDataURL(safeQrUrl, { width: 220, margin: 1 });
    } catch (error) {
      console.warn('[STATION_APPROVAL_QR_IMAGE_FALLBACK_LINK_ONLY]', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const qrBlock = safeQrUrl
    ? (
        qrImageDataUrl
          ? `<br/><br/><p><strong>${t.qrLabel}</strong></p>
             <p style="margin: 10px 0;"><img src="${qrImageDataUrl}" alt="${t.qrAlt}" width="220" height="220" style="display:block;border:1px solid #e8e4da;border-radius:8px;padding:6px;background:#ffffff;" /></p>
             <p><a href="${safeQrUrl}" target="_blank" rel="noopener noreferrer">${safeQrUrl}</a></p>`
          : `<br/><br/><p><strong>${t.qrLinkLabel}</strong> <a href="${safeQrUrl}" target="_blank" rel="noopener noreferrer">${safeQrUrl}</a></p>`
      )
    : '';

  await client.emails.send({
    from: FROM,
    to,
    subject: t.subject(subjectName),
    html: brandedEmail(locale, {
      greeting: t.greeting,
      bodyHtml: `${t.body(escapedName)}<br/><br/>${t.extra}${qrBlock}`,
      ctaUrl: loginUrl || undefined,
      ctaLabel: t.cta,
      footNote: t.closing,
    }),
  });
}


export async function sendStationRejectionEmail(
  to: string,
  stationName: string,
  rejectionReason: string,
  locale: Locale = 'fr'
): Promise<void> {
  const client = getResendClient();
  if (!client) {
    warnResendMissingOnce('sendStationRejectionEmail');
    return;
  }
  if (!isReasonableRecipientEmail(to)) return;

  const t = TEXTS.stationRejection[locale];
  const resubmitUrl = safeHttpUrlForEmailHref(`${APP_URL}/${locale}/station/resubmit`) ?? '';
  const subjectName = safePlainTextSnippet(stationName, 200);
  const escapedName = escapeHtmlPlain(safePlainTextSnippet(stationName, 500));
  const escapedReason = escapeHtmlPlain(safePlainTextSnippet(rejectionReason, 1000));

  await client.emails.send({
    from: FROM,
    to,
    subject: t.subject(subjectName),
    html: brandedEmail(locale, {
      greeting: t.greeting,
      bodyHtml: `${t.body(escapedName)}<br/><br/><p style="margin:0 0 6px;font-weight:bold;">${t.reasonLabel}</p><p style="margin:0;padding:12px 16px;background:#F7F6F0;border-left:3px solid #C49A1E;border-radius:4px;line-height:1.5;">${escapedReason}</p><br/>${t.extra}`,
      ctaUrl: resubmitUrl || undefined,
      ctaLabel: t.cta,
      footNote: t.closing,
    }),
  });
}


export async function sendStationApplicationAdminNotification(
  stationName: string,
  stationId: string,
  opts?: { context?: 'application' | 'approval'; qrPublicUrl?: string }
): Promise<void> {
  const dbAdminEmail = await getPlatformSetting('admin_notification_email');
  const adminEmail = (dbAdminEmail?.trim() || process.env.ADMIN_NOTIFICATION_EMAIL?.trim()) ?? '';
  if (!adminEmail) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        'sendStationApplicationAdminNotification: admin_notification_email not configured (DB or env), skipping'
      );
    }
    return;
  }

  const client = getResendClient();
  if (!client) {
    warnResendMissingOnce('sendStationApplicationAdminNotification');
    return;
  }
  if (!isReasonableRecipientEmail(adminEmail)) return;

  const safeName = escapeHtmlPlain(safePlainTextSnippet(stationName, 500));
  const safeId = escapeHtmlPlain(safePlainTextSnippet(stationId, 128));
  const context = opts?.context ?? 'application';
  const safeQrUrl = safeHttpUrlForEmailHref(opts?.qrPublicUrl);
  let qrImageDataUrl: string | null = null;

  if (context === 'approval' && safeQrUrl) {
    try {
      qrImageDataUrl = await QRCode.toDataURL(safeQrUrl, { width: 220, margin: 1 });
    } catch (error) {
      console.warn('[ADMIN_APPROVAL_QR_IMAGE_FALLBACK_LINK_ONLY]', {
        stationId: safeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const subject =
    context === 'approval'
      ? `[Slowtime] Station approved with QR: ${safePlainTextSnippet(stationName, 120)}`
      : `[Slowtime] New station application: ${safePlainTextSnippet(stationName, 120)}`;
  const bodyHtml = context === 'approval'
    ? `
      <p style="margin: 0 0 8px;"><strong>Station approved:</strong> ${safeName}</p>
      <p style="margin: 0 0 8px;"><strong>Station ID:</strong> ${safeId}</p>
      ${
        safeQrUrl
          ? (
              qrImageDataUrl
                ? `<p style="margin: 12px 0 8px;"><strong>Booking QR:</strong></p>
                   <p style="margin: 0 0 10px;"><img src="${qrImageDataUrl}" alt="Station booking QR" width="220" height="220" style="display:block;border:1px solid #e8e4da;border-radius:8px;padding:6px;background:#ffffff;" /></p>
                   <p style="margin: 0;"><a href="${safeQrUrl}" target="_blank" rel="noopener noreferrer">${safeQrUrl}</a></p>`
                : `<p style="margin: 12px 0 0;"><strong>Booking QR link:</strong> <a href="${safeQrUrl}" target="_blank" rel="noopener noreferrer">${safeQrUrl}</a></p>`
            )
          : ''
      }
    `
    : `
      <p style="margin: 0 0 8px;"><strong>Station name:</strong> ${safeName}</p>
      <p style="margin: 0;"><strong>Station ID:</strong> ${safeId}</p>
    `;

  await client.emails.send({
    from: FROM,
    to: adminEmail,
    subject,
    html: brandedEmail('en', {
      greeting: context === 'approval' ? 'Station approval completed' : 'New station application',
      bodyHtml,
      footNote:
        context === 'approval'
          ? 'QR image fallback to link-only is monitored and should remain rare.'
          : 'Please review the application in the admin panel.',
    }),
  });
}


/** Payment captured / service complete (Stripe path). No-op without Resend; send errors logged only. */
export async function sendPaymentSuccessEmail(params: {
  to: string;
  locale?: Locale;
  stationName?: string;
  entryId?: string;
}): Promise<void> {
  const { to, locale = 'fr', stationName, entryId } = params;
  const client = getResendClient();
  if (!client) {
    warnResendMissingOnce('sendPaymentSuccessEmail');
    return;
  }
  if (!isReasonableRecipientEmail(to)) return;

  const t = TEXTS.paymentSuccess[locale];
  const stationLine =
    stationName?.trim()
      ? `<br/><br/><strong>${t.stationPrefix}</strong> ${escapeHtmlPlain(stationName.trim())}`
      : '';
  const refLine = entryId?.trim()
    ? `<br/><br/><span style="font-size:14px;color:#666;">${t.refPrefix} <code style="font-size:13px;">${escapeHtmlPlain(entryId.trim())}</code></span>`
    : '';
  const bodyHtml = `${t.lead}${stationLine}${refLine}<br/><br/>${t.closing}`;
  const homeUrl = safeHttpUrlForEmailHref(`${APP_URL}/${locale}`) ?? '';

  try {
    await client.emails.send({
      from: FROM,
      to,
      subject: t.subject,
      html: brandedEmail(locale, {
        greeting: t.greeting,
        bodyHtml,
        ctaUrl: homeUrl || undefined,
        ctaLabel: t.cta,
      }),
    });
  } catch {
    console.error('sendPaymentSuccessEmail: Resend send failed');
  }
}


/** Payment failed or cancelled; reservation voided. No-op without Resend; send errors logged only. */
export async function sendPaymentFailedEmail(params: {
  to: string;
  locale?: Locale;
  reason?: string;
}): Promise<void> {
  const { to, locale = 'fr', reason } = params;
  const client = getResendClient();
  if (!client) {
    warnResendMissingOnce('sendPaymentFailedEmail');
    return;
  }
  if (!isReasonableRecipientEmail(to)) return;

  const t = TEXTS.paymentFailed[locale];
  const reasonTrim = reason?.trim();
  const reasonBlock = reasonTrim
    ? `<br/><br/><span style="font-size:14px;color:#666;">${t.reasonLabel} ${escapeHtmlPlain(reasonTrim.slice(0, 500))}</span>`
    : '';
  const bodyHtml = `${t.body}${reasonBlock}`;
  const homeUrl = safeHttpUrlForEmailHref(`${APP_URL}/${locale}`) ?? '';

  try {
    await client.emails.send({
      from: FROM,
      to,
      subject: t.subject,
      html: brandedEmail(locale, {
        greeting: t.greeting,
        bodyHtml,
        ctaUrl: homeUrl || undefined,
        ctaLabel: t.cta,
      }),
    });
  } catch {
    console.error('sendPaymentFailedEmail: Resend send failed');
  }
}


// %%%%% END - MODULE — Transactional sends %%%%%


// %%%%% MODULE — Weekly escrow report & locale %%%%%
// Admin table email and Accept-Language parsing.

/** Parses `Accept-Language`; returns `fr` or `en` (default `fr`). */
export function extractLocale(headerValue: string | null): Locale {
  if (!headerValue) return 'fr';
  const primary = headerValue.split(',')[0].trim().toLowerCase();
  if (primary.startsWith('en')) return 'en';
  return 'fr';
}


export type WeeklyEscrowTransactionRow = {
  reservationId: string;
  reservationStatus: string;
  succeededAt: Date;
  clientEmail: string;
  stationName: string;
  amountPaid: string; // decimal as string from DB
  commissionAmount: string | null;
  stationPayout: string | null;
  stripePaymentId: string | null;
  stripeTransferId: string | null;
};


function formatMoneyEUR(amount: string | number | null | undefined): string {
  const n = amount == null ? 0 : typeof amount === 'string' ? parseFloat(amount) : amount;
  const safe = Number.isFinite(n) ? n : 0;
  return `${safe.toFixed(2)} EUR`;
}


export async function sendWeeklyEscrowTransactionsReportEmail(
  to: string,
  params: {
    locale: Locale;
    weekStart: Date;
    weekEnd: Date;
    rows: WeeklyEscrowTransactionRow[];
  }
): Promise<void> {
  const { locale, weekStart, weekEnd, rows } = params;

  const subjectFr = `Rapport hebdomadaire — Transactions escrow (${weekStart.toLocaleDateString('fr-FR')} → ${weekEnd.toLocaleDateString('fr-FR')})`;
  const subjectEn = `Weekly escrow transactions report (${weekStart.toLocaleDateString('en-GB')} → ${weekEnd.toLocaleDateString('en-GB')})`;
  const subject = locale === 'en' ? subjectEn : subjectFr;

  const totalAmount = rows.reduce((acc, r) => acc + (parseFloat(r.amountPaid) || 0), 0);
  const totalCommission = rows.reduce((acc, r) => acc + (parseFloat(r.commissionAmount ?? '0') || 0), 0);
  const totalPayout = rows.reduce((acc, r) => acc + (parseFloat(r.stationPayout ?? '0') || 0), 0);

  const emptyRowMessage =
    locale === 'en' ? 'No transactions in this period.' : 'Aucune transaction sur la période.';
  const tableRowsHtml =
    rows.length === 0
      ? `<tr><td colspan="9" style="padding: 10px 8px; color: #888;">${emptyRowMessage}</td></tr>`
      : rows
          .map((r) => {
            const at = escapeHtmlPlain(
              r.succeededAt.toLocaleString(locale === 'en' ? 'en-GB' : 'fr-FR')
            );
            const stName = escapeHtmlPlain(safePlainTextSnippet(r.stationName, 500));
            const cEmail = escapeHtmlPlain(safePlainTextSnippet(r.clientEmail, 320));
            const resId = escapeHtmlPlain(safePlainTextSnippet(r.reservationId, 128));
            const resStat = escapeHtmlPlain(safePlainTextSnippet(r.reservationStatus, 64));
            const xfer = escapeHtmlPlain(safePlainTextSnippet(r.stripeTransferId ?? '', 128));
            return `<tr>
              <td style="padding: 8px 8px; border-bottom: 1px solid #eee;">${at}</td>
              <td style="padding: 8px 8px; border-bottom: 1px solid #eee;"><strong>${stName}</strong></td>
              <td style="padding: 8px 8px; border-bottom: 1px solid #eee;">${cEmail}</td>
              <td style="padding: 8px 8px; border-bottom: 1px solid #eee;">${resId}</td>
              <td style="padding: 8px 8px; border-bottom: 1px solid #eee;">${resStat}</td>
              <td style="padding: 8px 8px; border-bottom: 1px solid #eee; text-align:right;">${formatMoneyEUR(r.amountPaid)}</td>
              <td style="padding: 8px 8px; border-bottom: 1px solid #eee; text-align:right;">${formatMoneyEUR(r.commissionAmount)}</td>
              <td style="padding: 8px 8px; border-bottom: 1px solid #eee; text-align:right;">${formatMoneyEUR(r.stationPayout)}</td>
              <td style="padding: 8px 8px; border-bottom: 1px solid #eee;">${xfer}</td>
            </tr>`;
          })
          .join('');

  const bodyHtml = `
    <p style="margin: 0 0 12px;">${locale === 'en' ? 'Here is the weekly summary of escrow transactions captured through Stripe.' : 'Voici le récapitulatif hebdomadaire des transactions escrow capturées via Stripe.'}</p>
    <div style="margin: 0 0 12px; color: #444;">
      <div><strong>${locale === 'en' ? 'Transactions:' : 'Transactions :'} </strong>${rows.length}</div>
      <div><strong>${locale === 'en' ? 'Total paid:' : 'Total payé :'} </strong>${formatMoneyEUR(totalAmount)}</div>
      <div><strong>${locale === 'en' ? 'Total commission:' : 'Total commission :'} </strong>${formatMoneyEUR(totalCommission)}</div>
      <div><strong>${locale === 'en' ? 'Total station payout:' : 'Total payout station :'} </strong>${formatMoneyEUR(totalPayout)}</div>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr>
          <th align="left" style="padding: 8px 8px; border-bottom: 1px solid #e8e4da;">${locale === 'en' ? 'Succeeded at' : 'Date réussite'}</th>
          <th align="left" style="padding: 8px 8px; border-bottom: 1px solid #e8e4da;">${locale === 'en' ? 'Station' : 'Station'}</th>
          <th align="left" style="padding: 8px 8px; border-bottom: 1px solid #e8e4da;">${locale === 'en' ? 'Client' : 'Client'}</th>
          <th align="left" style="padding: 8px 8px; border-bottom: 1px solid #e8e4da;">${locale === 'en' ? 'Reservation ID' : 'ID réservation'}</th>
          <th align="left" style="padding: 8px 8px; border-bottom: 1px solid #e8e4da;">${locale === 'en' ? 'Status' : 'Statut'}</th>
          <th align="right" style="padding: 8px 8px; border-bottom: 1px solid #e8e4da;">${locale === 'en' ? 'Paid' : 'Payé'}</th>
          <th align="right" style="padding: 8px 8px; border-bottom: 1px solid #e8e4da;">${locale === 'en' ? 'Commission' : 'Commission'}</th>
          <th align="right" style="padding: 8px 8px; border-bottom: 1px solid #e8e4da;">${locale === 'en' ? 'Payout' : 'Payout'}</th>
          <th align="left" style="padding: 8px 8px; border-bottom: 1px solid #e8e4da;">${locale === 'en' ? 'Transfer ID' : 'Transfer ID'}</th>
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>
  `;

  const client = getResendClient();
  if (!client) {
    warnResendMissingOnce('sendWeeklyEscrowTransactionsReportEmail');
    return;
  }
  if (!isReasonableRecipientEmail(to)) return;

  await client.emails.send({
    from: FROM,
    to,
    subject,
    html: brandedEmail(locale, {
      greeting: locale === 'en' ? 'Weekly escrow report' : 'Rapport hebdomadaire escrow',
      bodyHtml,
    }),
  });
}


// %%%%% END - MODULE — Weekly escrow report & locale %%%%%
