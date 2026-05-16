/**
 * Post-escrow-release side effects: client push, success email, optional station/admin FCM.
 * Callers claim `stripe_payment_succeeded_notified_at` first; most per-channel errors are swallowed here.
 * If the caller needs Stripe webhook retries on total failure, it must rethrow after handling - see webhook route.
 */
import { eq } from "drizzle-orm";
import { sendPaymentSuccessEmail } from "@/lib/email";
import { db } from "@/lib/db";
import { stations, users } from "@/lib/db/schema";
import {
  getPlatformSettingWithFallback,
  isAdminEscrowPushEnabled,
} from "@/server/admin/platform-settings-service";
import { isTruePlatformSetting } from "@/helpers/platform-setting-boolean";
import { sendPushNotification } from "./fcm-service";
import { notifyEntry } from "./notification-service";
import { notifyClientFeed } from "./client-feed-notifications";
import type { Entry } from "@/server/reservations/entry-repository";

/**
 * Sends invitation_to_rate, client success email, and optional station/admin pushes.
 *
 * @param _succeededAt - Stripe / DB succeeded instant (callers pass it for a stable API; reserved for future use).
 */
export async function sendEscrowReleasedNotificationsForEntry(
  entry: Entry,
  _succeededAt: Date,
): Promise<void> {
  try {
    await notifyEntry({
      entryId: entry.id,
      userId: entry.user_id,
      stationId: entry.station_id,
      type: "invitation_to_rate",
    });
    await notifyClientFeed({
      userId: entry.user_id,
      entryId: entry.id,
      stationId: entry.station_id,
      kind: "invitation_to_rate",
      body: "Évaluez votre dernière visite pour nous aider à nous améliorer.",
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[escrow-released] Client notification failed", {
      entryId: entry.id,
      error,
    });
  }

  // Fetch user email, station info, and push-enable flags concurrently - none depend on each other.
  const [userRow, stationRow, stationPushRaw, adminPushEnabled] =
    await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, entry.user_id),
        columns: { email: true },
      }),
      db.query.stations.findFirst({
        where: eq(stations.id, entry.station_id),
        columns: { name: true, user_id: true },
      }),
      getPlatformSettingWithFallback(
        "enable_station_push_on_escrow_released",
        "PLATFORM_ENABLE_STATION_PUSH_ON_ESCROW_RELEASED",
        "false",
      ),
      isAdminEscrowPushEnabled(),
    ]);

  const stationPushEnabled = isTruePlatformSetting(stationPushRaw);

  try {
    const emailTo = userRow?.email?.trim();
    if (emailTo) {
      await sendPaymentSuccessEmail({
        to: emailTo,
        stationName: stationRow?.name,
        entryId: entry.id,
      });
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[escrow-released] Client success email failed", {
      entryId: entry.id,
      error,
    });
  }

  if (stationPushEnabled) {
    try {
      if (stationRow?.user_id) {
        await sendPushNotification(stationRow.user_id, {
          title: "Service completed",
          body: "Payment captured and escrow released successfully.",
          data: {
            entry_id: entry.id,
            station_id: entry.station_id,
            type: "escrow_released",
          },
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("[escrow-released] Station push failed", {
        entryId: entry.id,
        error,
      });
    }
  }

  if (adminPushEnabled) {
    try {
      const adminUsers = await db.query.users.findMany({
        where: eq(users.role, "admin"),
        columns: { id: true },
      });
      // Use allSettled so a single FCM failure does not abort pushes to other admins.
      const results = await Promise.allSettled(
        (adminUsers ?? []).map((adminUser) =>
          sendPushNotification(adminUser.id, {
            title: "Escrow released",
            body: "A reservation escrow has been released successfully.",
            data: {
              entry_id: entry.id,
              station_id: entry.station_id,
              type: "escrow_released_admin",
            },
          }),
        ),
      );
      results.forEach((result, i) => {
        if (result.status === "rejected") {
          const error =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
          console.error("[escrow-released] Admin push failed", {
            entryId: entry.id,
            adminId: adminUsers[i]?.id,
            error,
          });
        }
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("[escrow-released] Admin push failed", {
        entryId: entry.id,
        error,
      });
    }
  }
}
