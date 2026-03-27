import { z } from 'zod';
import { mapZodErrors } from './auth';

export { mapZodErrors };

/**
 * Hard upper-bound as a sanity cap for Zod input validation.
 * The real platform limit is enforced by the service via getPlatformSetting('tip_max_amount').
 */
const TIP_AMOUNT_SANITY_CAP = 10_000;

export const createTipSchema = z.object({
  /**
   * Tip amount in the major currency unit (e.g. 10.50 for €10.50).
   * Must be positive. The effective maximum is read from platform settings at runtime.
   * Rounded to 2 decimal places.
   */
  amount: z
    .number({ invalid_type_error: 'amount must be a number' })
    .positive('Tip amount must be greater than 0')
    .min(0.01, 'Tip amount must be at least 0.01')
    .max(TIP_AMOUNT_SANITY_CAP, `Tip amount must not exceed ${TIP_AMOUNT_SANITY_CAP}`)
    .transform((v) => Math.round(v * 100) / 100),
});

export type CreateTipInput = z.infer<typeof createTipSchema>;

/** Route param validator for reservation UUID. */
export const reservationIdParamSchema = z.string().uuid('Invalid reservation ID format');
