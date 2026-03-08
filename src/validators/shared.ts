import { z } from 'zod';
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';

/**
 * Validates and normalizes a phone number to E.164 format (e.g. +14165551234).
 * Expects the frontend to send the full international number with country code prefix.
 */
export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .refine((val) => isValidPhoneNumber(val), {
    message: 'Invalid phone number',
  })
  .transform((val) => parsePhoneNumber(val).format('E.164'));
