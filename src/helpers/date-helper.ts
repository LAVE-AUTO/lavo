/**
 * Returns true when the string is a real calendar date in YYYY-MM-DD format.
 * Rejects phantom dates such as 2024-02-30.
 */
export function isValidCalendarDate(s: string): boolean {
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Combines a YYYY-MM-DD date string and an HH:mm / HH:mm:ss time string into a UTC Date.
 * Accepts +00 suffix as a synonym for Z to handle DB-stored time values.
 */
export function parseTimeForDate(dateStr: string, timeStr: string): Date {
  let t = timeStr.trim();
  if (t.length === 5) t += ':00';
  if (t.endsWith('+00')) t = t.slice(0, -3) + 'Z';
  if (!t.endsWith('Z') && !t.includes('+')) t += 'Z';
  return new Date(`${dateStr}T${t}`);
}
