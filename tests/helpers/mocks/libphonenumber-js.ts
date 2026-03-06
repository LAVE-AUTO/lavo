/**
 * Stub for libphonenumber-js in tests (avoids loading the real package when only validators are used).
 */
export function isValidPhoneNumber(): boolean {
  return true;
}

export function parsePhoneNumber(): { format: () => string } {
  return { format: () => '+33600000000' };
}
