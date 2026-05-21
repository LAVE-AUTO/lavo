/**
 * Cron job: send KYC document expiry reminders to station owners and all active admins.
 *
 * Reminder windows (configurable via platform settings):
 *   - First reminder  (default 30 days before expiry): early warning to station owner
 *   - Second reminder (default  7 days before expiry): urgent follow-up
 *
 * Anti-duplicate: reminder_first_sent_at / reminder_second_sent_at flags on the document
 * row prevent re-sending if the cron runs multiple times in the same window.
 * Each document is processed independently; one failure does not stop the batch.
 *
 * Invocation: GET /api/cron/send-kyc-expiry-reminders with CRON_SECRET header
 * Response:   summary counts (processed, succeeded, failed) per reminder window
 */


import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getPlatformSettingWithFallback } from '@/server/admin/platform-settings-service';
import {
  findDocumentsNeedingReminder,
  setReminderSent,
} from '@/server/station/document-repository';
import { sendPushNotification } from '@/server/notifications/fcm-service';
import { notifyAdminEvent } from '@/server/notifications/admin-notification-service';
import { sendKycExpiryReminderEmail } from '@/lib/email';
import { runWithConcurrencyLimit } from '@/helpers/concurrency';


// %%%%% Types %%%%%

export type SendKycRemindersResult = {
  first_reminder:  { processed: number; succeeded: number; failed: number };
  second_reminder: { processed: number; succeeded: number; failed: number };
};

type ActiveAdmin = { id: string; email: string };

// %%%%% END - Types %%%%%


// %%%%% Constants %%%%%

const LOG_PREFIX = '[send-kyc-expiry-reminders]';

// %%%%% END - Constants %%%%%


// %%%%% Helpers %%%%%

// ooooo getActiveAdmins ooooo

/**
 * Returns id and email for all active admin users.
 * Queried once per job run and reused across all documents to avoid repeated DB round-trips.
 */
async function getActiveAdmins(): Promise<ActiveAdmin[]> {
  return db.query.users.findMany({
    where: and(eq(users.role, 'admin'), eq(users.status, 'active')),
    columns: { id: true, email: true },
  });
}

// ooooo END - getActiveAdmins ooooo


// ooooo parseThresholdDays ooooo

/**
 * Parses a raw string setting into a positive integer threshold, falling back to `defaultDays`
 * when the value is missing, non-numeric, or less than 1.
 */
function parseThresholdDays(raw: string, defaultDays: number): number {
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : defaultDays;
}

// ooooo END - parseThresholdDays ooooo


// ooooo logRejected ooooo

/**
 * Logs a rejected `Promise.allSettled` result for a given recipient and document.
 * Centralises the repeated pattern of extracting the error message from a rejection reason.
 */
function logRejected(
  label: string,
  recipientId: string,
  documentId: string,
  reason: unknown
): void {
  console.error(
    `${LOG_PREFIX} ${label} ${recipientId} failed for document ${documentId}:`,
    reason instanceof Error ? reason.message : String(reason)
  );
}

// ooooo END - logRejected ooooo


// ooooo swallowError ooooo

/**
 * Awaits `promise`, catching and logging any rejection without re-throwing.
 * Used for fire-and-forget notifications where a transient failure must not
 * prevent the anti-duplicate flag from being stamped.
 */
async function swallowError(label: string, documentId: string, promise: Promise<unknown>): Promise<void> {
  await promise.catch((err) => {
    console.error(
      `${LOG_PREFIX} ${label} failed for document ${documentId}:`,
      err instanceof Error ? err.message : String(err)
    );
  });
}

// ooooo END - swallowError ooooo


// ooooo fanOut ooooo

/**
 * Fan-out: calls `task` for every admin via `Promise.allSettled` so one failing token
 * does not abort the rest of the fan-out.  Rejections are logged via `logRejected`.
 *
 * @param label      - Human-readable label used in rejection log messages
 * @param admins     - Active admin users to iterate over
 * @param documentId - Document ID used in rejection log messages
 * @param task       - Async function to call for each admin
 */
async function fanOut(
  label: string,
  admins: ActiveAdmin[],
  documentId: string,
  task: (admin: ActiveAdmin) => Promise<unknown>
): Promise<void> {
  const results = await Promise.allSettled(admins.map(task));

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      logRejected(label, admins[i].id, documentId, r.reason);
    }
  });
}

// ooooo END - fanOut ooooo


// ooooo notifyStationOwner ooooo

/**
 * Sends a push notification to the station owner.
 * Errors are caught and logged without re-throwing so that a missing FCM token or
 * transient failure cannot prevent the anti-duplicate flag from being stamped.
 */
async function notifyStationOwner(
  stationUserId: string,
  documentId: string,
  documentType: string,
  thresholdDays: number
): Promise<void> {
  await swallowError(
    'Push to station owner',
    documentId,
    sendPushNotification(stationUserId, {
      title: 'Document KYC expirant bientot',
      body: `Votre document ${documentType} expire dans ${thresholdDays} jours.`,
      data: { type: 'kyc_expiry_reminder', document_id: documentId },
    })
  );
}

// ooooo END - notifyStationOwner ooooo


// ooooo notifyAdminsPush ooooo

/**
 * Fan-out: sends a push notification to every active admin.
 * Uses `allSettled` so one failing token does not abort the rest of the fan-out.
 */
async function notifyAdminsPush(
  admins: ActiveAdmin[],
  documentId: string,
  documentType: string,
  stationName: string,
  thresholdDays: number
): Promise<void> {
  await fanOut('Push to admin', admins, documentId, (admin) =>
    sendPushNotification(admin.id, {
      title: 'KYC document expiring soon',
      body: `Station "${stationName}" - document ${documentType} expires in ${thresholdDays} days.`,
      data: { type: 'kyc_expiry_reminder_admin', document_id: documentId },
    })
  );
}

// ooooo END - notifyAdminsPush ooooo


// ooooo emailStationOwner ooooo

/**
 * Sends a KYC expiry reminder email to the station owner.
 * Errors are caught and logged without re-throwing so that a transient SMTP failure
 * cannot prevent the anti-duplicate flag from being stamped.
 */
async function emailStationOwner(
  stationOwnerEmail: string,
  documentId: string,
  documentType: string,
  expiryDate: Date,
  stationName: string,
  thresholdDays: number
): Promise<void> {
  await swallowError(
    'Email to station owner',
    documentId,
    sendKycExpiryReminderEmail({
      toEmail: stationOwnerEmail,
      documentType,
      expiryDate,
      thresholdDays,
      stationName,
      isAdmin: false,
    })
  );
}

// ooooo END - emailStationOwner ooooo


// ooooo emailAdmins ooooo

/**
 * Fan-out: sends a KYC expiry reminder email to every active admin.
 * Uses `allSettled` so one failing send does not abort the rest of the fan-out.
 */
async function emailAdmins(
  admins: ActiveAdmin[],
  documentId: string,
  documentType: string,
  expiryDate: Date,
  stationName: string,
  thresholdDays: number
): Promise<void> {
  await fanOut('Email to admin', admins, documentId, (admin) =>
    sendKycExpiryReminderEmail({
      toEmail: admin.email,
      documentType,
      expiryDate,
      thresholdDays,
      stationName,
      isAdmin: true,
    })
  );
}

// ooooo END - emailAdmins ooooo

// %%%%% END - Helpers %%%%%


// %%%%% Job execution %%%%%

// ooooo sendRemindersForThreshold ooooo

/**
 * Sends KYC expiry reminders for one threshold window (first or second).
 *
 * For each document approaching expiry:
 *   1. Sends a push notification to the station owner
 *   2. Sends push notifications to all active admins
 *   3. Sends an email to the station owner (email pre-joined from the repository query)
 *   4. Sends emails to all active admins
 *   5. Marks the reminder as sent (anti-duplicate flag)
 *
 * Failures per document are caught individually; the batch continues on error.
 *
 * @param thresholdDays - Days before expiry for this window
 * @param reminderField - Which flag to check and set: 'first' | 'second'
 * @param admins        - Pre-fetched active admin users (id + email)
 */
async function sendRemindersForThreshold(
  thresholdDays: number,
  reminderField: 'first' | 'second',
  admins: ActiveAdmin[]
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const documents = await findDocumentsNeedingReminder(thresholdDays, reminderField);
  let succeeded = 0;
  let failed = 0;

  const results = await runWithConcurrencyLimit(documents, 5, async ({ document, stationUserId, stationOwnerEmail, stationName }) => {
    // Guard: repository filters for non-null expiry_date, but enforce the invariant explicitly.
    if (!document.expiry_date) {
      throw new Error(`Document ${document.id} has null expiry_date`);
    }

    const { id: documentId, document_type: documentType, expiry_date: expiryDate } = document;

    // Run all four fan-outs concurrently. Each helper absorbs its own errors internally,
    // so allSettled is used defensively in case that contract ever changes.
    await Promise.allSettled([
      notifyStationOwner(stationUserId, documentId, documentType, thresholdDays),
      notifyAdminsPush(admins, documentId, documentType, stationName, thresholdDays),
      emailStationOwner(stationOwnerEmail, documentId, documentType, expiryDate, stationName, thresholdDays),
      emailAdmins(admins, documentId, documentType, expiryDate, stationName, thresholdDays),
      notifyAdminEvent({
        type: 'kyc_expiry_reminder',
      }),
    ]);

    // Stamp the anti-duplicate flag only after all notifications have been dispatched.
    await setReminderSent(documentId, reminderField);
  });

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      succeeded += 1;
    } else {
      failed += 1;
      const { reason } = result as PromiseRejectedResult;
      console.error(
        `${LOG_PREFIX} Failed to process document ${documents[i].document.id}:`,
        reason instanceof Error ? reason.message : String(reason)
      );
    }
  }

  return { processed: documents.length, succeeded, failed };
}

// ooooo END - sendRemindersForThreshold ooooo


// ooooo runSendKycExpiryReminders ooooo

/**
 * Main job entry point: send KYC expiry reminders for both configured windows.
 *
 * Reads threshold configuration from platform settings (or env/defaults),
 * pre-fetches admins once, then processes both windows sequentially.
 *
 * @returns SendKycRemindersResult with processed/succeeded/failed counts per window
 */
export async function runSendKycExpiryReminders(): Promise<SendKycRemindersResult> {
  // Read threshold days from platform settings, falling back to env vars and hardcoded defaults.
  const [firstDaysRaw, secondDaysRaw] = await Promise.all([
    getPlatformSettingWithFallback(
      'kyc_reminder_first_threshold_days',
      'PLATFORM_KYC_REMINDER_FIRST_THRESHOLD_DAYS',
      '30'
    ),
    getPlatformSettingWithFallback(
      'kyc_reminder_second_threshold_days',
      'PLATFORM_KYC_REMINDER_SECOND_THRESHOLD_DAYS',
      '7'
    ),
  ]);

  const firstThresholdDays  = parseThresholdDays(firstDaysRaw, 30);
  const secondThresholdDays = parseThresholdDays(secondDaysRaw, 7);

  // Pre-fetch admins once; id and email reused across all documents in both windows.
  const admins = await getActiveAdmins();

  const first_reminder  = await sendRemindersForThreshold(firstThresholdDays,  'first',  admins);
  const second_reminder = await sendRemindersForThreshold(secondThresholdDays, 'second', admins);

  return { first_reminder, second_reminder };
}

// ooooo END - runSendKycExpiryReminders ooooo

// %%%%% END - Job execution %%%%%
