/**
 * Station timezone helpers.
 *
 * All station opening hours are stored as naive local times in the station's
 * timezone (America/Toronto — the platform operates in the Montréal area).
 * These helpers convert between that wall-clock coordinate system and real
 * UTC instants so that availability computation (server) and slot display
 * (browser) agree regardless of the server's or visitor's own timezone.
 *
 * Shared by the backend availability service and the booking UI.
 */

export const STATION_TIMEZONE = 'America/Toronto';

/** Offset (ms) between UTC and the station timezone at a given instant. */
function tzOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: STATION_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return asUtc - at.getTime();
}

/**
 * Converts a station-local wall time (calendar date + minutes since midnight)
 * to the real UTC instant. Two-pass offset lookup keeps DST edges correct.
 */
export function stationWallTimeToUtc(dateKey: string, minutesSinceMidnight: number): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  const naiveUtc = Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, minutesSinceMidnight);
  let offset = tzOffsetMs(new Date(naiveUtc));
  let ts = naiveUtc - offset;
  offset = tzOffsetMs(new Date(ts));
  ts = naiveUtc - offset;
  return new Date(ts);
}

/** Minutes since midnight, station-local, for a UTC instant. */
export function utcToStationMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: STATION_TIMEZONE,
    hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(at);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  return (get('hour') % 24) * 60 + get('minute');
}

/** Station-local calendar date ("YYYY-MM-DD") for a UTC instant. */
export function stationDateKey(at: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: STATION_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Current station-local minutes since midnight. */
export function stationNowMinutes(): number {
  return utcToStationMinutes(new Date());
}

/** Today's station-local calendar date ("YYYY-MM-DD"). */
export function stationTodayKey(): string {
  return stationDateKey(new Date());
}

/** "HH:MM" wall time in the station timezone for an ISO datetime. */
export function formatStationTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const minutes = utcToStationMinutes(d);
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
