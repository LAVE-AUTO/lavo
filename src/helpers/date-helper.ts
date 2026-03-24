/**
 * Returns true when the string is a real calendar date in YYYY-MM-DD format.
 * Rejects phantom dates such as 2024-02-30.
 *
 * @param s - Date string to validate
 * @returns True when the date is a valid calendar date
 */
export function isValidCalendarDate(s: string): boolean {
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
