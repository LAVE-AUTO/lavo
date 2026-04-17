/**
 * Parses boolean-like values from the `settings` table (stored as text).
 * True only when the trimmed, lowercased value is exactly `"true"`.
 */
export function isTruePlatformSetting(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}
