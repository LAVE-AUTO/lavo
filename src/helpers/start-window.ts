/**
 * Start/Cancel actions on a station reservation only surface shortly before the
 * scheduled slot start. Shared by the reservations list card, the dashboard
 * agenda timeline, and the slot detail modal so the rule stays consistent.
 */
export const START_WINDOW_MINUTES = 15;

/**
 * True when `now` is within START_WINDOW_MINUTES before the slot start (or
 * beyond it). Entries without a scheduled slot (queue / walk-in) return true —
 * they are not time-gated.
 */
export function isWithinStartWindow(
  slotStartIso: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!slotStartIso) return true;
  const start = new Date(slotStartIso).getTime();
  if (Number.isNaN(start)) return true;
  return now >= start - START_WINDOW_MINUTES * 60_000;
}
