/**
 * Post-escrow-release side effects: client push, success email, optional station/admin FCM.
 * Callers claim `stripe_payment_succeeded_notified_at` first; most per-channel errors are swallowed here.
 * If the caller needs Stripe webhook retries on total failure, it must rethrow after handling — see webhook route.
 */
import { eq } from 'drizzle-orm';
import { sendPaymentSuccessEmail } from '@/lib/email';
import { db } from '@/lib/db';
import { stations, users } from '@/lib/db/schema';
import {
  getPlatformSetting,
  isAdminEscrowPushEnabled,
} from '@/server/admin/platform-settings-service';
import { isTruePlatformSetting } from '@/helpers/platform-setting-boolean';
import { sendPushNotification } from './fcm-service';
import { notifyEntry } from './notification-service';
import type { Entry } from '@/server/reservations/entry-repository';

/**
 * Sends invitation_to_rate, client success email, and optional station/admin pushes.
 *
 * @param _succeededAt - Stripe / DB succeeded instant (callers pass it for a stable API; reserved for future use).
 */
export async function sendEscrowReleasedNotificationsForEntry(
  entry: Entry,
  _succeededAt: Date
): Promise<void> {
  try {
    await notifyEntry({
      entryId: entry.id,
      userId: entry.user_id,
      stationId: entry.station_id,
      type: 'invitation_to_rate',
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[escrow-released] Client notification failed', { entryId: entry.id, error });
  }

  try {
    const userRow = await db.query.users.findFirst({
      where: eq(users.id, entry.user_id),
      columns: { email: true },
    });
    const emailTo = userRow?.email?.trim();
    if (emailTo) {
      const stationRow = await db.query.stations.findFirst({
        where: eq(stations.id, entry.station_id),
        columns: { name: true },
      });
      await sendPaymentSuccessEmail({
        to: emailTo,
        stationName: stationRow?.name,
        entryId: entry.id,
      });
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[escrow-released] Client success email failed', { entryId: entry.id, error });
  }

  const stationPushEnabled = isTruePlatformSetting(
    await getPlatformSetting('enable_station_push_on_escrow_released')
  );
  const adminPushEnabled = await isAdminEscrowPushEnabled();

  if (stationPushEnabled) {
    try {
      const station = await db.query.stations.findFirst({
        where: eq(stations.id, entry.station_id),
        columns: { user_id: true },
      });
      if (station?.user_id) {
        await sendPushNotification(station.user_id, {
          title: 'Service completed',
          body: 'Payment captured and escrow released successfully.',
          data: { entry_id: entry.id, station_id: entry.station_id, type: 'escrow_released' },
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error('[escrow-released] Station push failed', { entryId: entry.id, error });
    }
  }

  if (adminPushEnabled) {
    try {
      const adminUsers = await db.query.users.findMany({
        where: eq(users.role, 'admin'),
        columns: { id: true },
      });
      await Promise.all(
        (adminUsers ?? []).map((adminUser) =>
          sendPushNotification(adminUser.id, {
            title: 'Escrow released',
            body: 'A reservation escrow has been released successfully.',
            data: {
              entry_id: entry.id,
              station_id: entry.station_id,
              type: 'escrow_released_admin',
            },
          })
        )
      );
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error('[escrow-released] Admin push failed', { entryId: entry.id, error });
    }
  }
}
