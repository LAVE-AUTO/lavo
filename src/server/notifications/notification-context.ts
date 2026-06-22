/**
 * Shared context enrichment for notification bodies.
 *
 * Fetches station name, reserved time slot and amount from an entry ID
 * in a single JOIN query, then appends a formatted detail line to a body string.
 *
 * Returns gracefully (all fields null) when the entryId does not correspond
 * to a reservation row — e.g. for support-ticket or tip notifications whose
 * entryId is not a reservations.id.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { reservations, stations, timeSlots } from '@/lib/db/schema';

export interface NotificationContext {
  stationName: string | null;
  slotTime: string | null;
  amount: string | null;
}

const APP_TZ = 'America/Toronto';

function formatSlotDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: APP_TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace(',', ' à');
}

/**
 * Returns enrichment data for a reservation entry in one DB round-trip.
 * All fields are null when the entry is not found or has no time slot.
 */
export async function fetchNotificationContext(entryId: string): Promise<NotificationContext> {
  try {
    const [row] = await db
      .select({
        stationName: stations.name,
        slotStart: timeSlots.start_time,
        amount: reservations.amount_paid,
      })
      .from(reservations)
      .leftJoin(stations, eq(stations.id, reservations.station_id))
      .leftJoin(timeSlots, eq(timeSlots.id, reservations.time_slot_id))
      .where(eq(reservations.id, entryId))
      .limit(1);

    if (!row) {
      console.warn('[NOTIF_CTX] No reservation row found for entryId:', entryId);
      return { stationName: null, slotTime: null, amount: null };
    }

    console.log('[NOTIF_CTX] row:', { stationName: row.stationName, slotStart: row.slotStart, amount: row.amount });

    return {
      stationName: row.stationName ?? null,
      slotTime: row.slotStart ? formatSlotDate(row.slotStart) : null,
      amount: row.amount != null ? `${parseFloat(row.amount).toFixed(2)} $` : null,
    };
  } catch (err) {
    console.error('[NOTIF_CTX] fetchNotificationContext failed for entryId:', entryId, err instanceof Error ? err.message : String(err));
    return { stationName: null, slotTime: null, amount: null };
  }
}

/**
 * Appends a compact detail line to a notification body string.
 *
 * Only includes fields that are non-null. Returns the original body unchanged
 * if no context is available.
 *
 * Example output:
 *   "Votre réservation est confirmée. À bientôt !\n
 *    Station : Maple Shine Car Wash · Créneau : 22 juin 2026 à 09:30 · Montant : 20.00 $"
 */
export function appendContextToBody(body: string, ctx: NotificationContext): string {
  const parts: string[] = [];
  if (ctx.stationName) parts.push(`Station : ${ctx.stationName}`);
  if (ctx.slotTime) parts.push(`Créneau : ${ctx.slotTime}`);
  if (ctx.amount) parts.push(`Montant : ${ctx.amount}`);
  if (!parts.length) return body;
  return `${body}\n${parts.join(' · ')}`;
}
