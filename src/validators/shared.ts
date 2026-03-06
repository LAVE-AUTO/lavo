import { z } from 'zod';
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';

/**
 * Validates and normalizes a phone number to E.164 format (e.g. +14165551234).
 * Expects the frontend to send the country code prefix (e.g. +1 416 555 1234).
 * Falls back to 'CA' as default country if no country code is provided.
 */
export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .refine((val) => isValidPhoneNumber(val, 'CA'), {
    message: 'Invalid phone number',
  })
  .transform((val) => parsePhoneNumber(val, 'CA').format('E.164'));
