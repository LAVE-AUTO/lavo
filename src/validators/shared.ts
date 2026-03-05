import { z } from 'zod';
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';

/**
 * Validates and normalizes a phone number to E.164 format (+33612345678).
 * Accepts local and international formats with or without spaces/dashes.
 * Uses 'FR' as default country for numbers without a country code.
 */
export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .refine((val) => isValidPhoneNumber(val, 'FR'), {
    message: 'Invalid phone number',
  })
  .transform((val) => parsePhoneNumber(val, 'FR').format('E.164'));
