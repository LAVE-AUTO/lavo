/**
 * Generates the 6-character service code shown to the client on the booking
 * receipt and required by the station to start a service.
 *
 * Alphabet: digits + uppercase letters minus visually ambiguous characters
 * (0/O, 1/I/L) - mirrors the client-side helper used as a fallback before the
 * backend code was wired.
 */
import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateTicketCode(): string {
  const buf = crypto.randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[buf[i] % ALPHABET.length];
  }
  return out;
}

/**
 * Normalises a user-supplied code (uppercase + trim + strip whitespace) so the
 * comparison with the stored value is robust to copy/paste artefacts.
 */
export function normalizeTicketCode(input: string): string {
  return input.replace(/\s+/g, '').trim().toUpperCase();
}
