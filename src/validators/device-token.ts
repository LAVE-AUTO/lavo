import { z } from 'zod';


// %%%%% Validation schemas %%%%%
// Device token registration validation

/**
 * Validates the request body for POST /me/device-token.
 * Token must be non-empty and within FCM's max length.
 * Platform must be one of the supported push targets.
 */
export const registerDeviceTokenBodySchema = z.object({
  token: z.string().min(1, 'Token is required').max(500, 'Token must not exceed 500 characters'),
  platform: z.enum(['ios', 'android', 'web'], {
    errorMap: () => ({ message: "Platform must be 'ios', 'android', or 'web'" }),
  }),
});

export type RegisterDeviceTokenBody = z.infer<typeof registerDeviceTokenBodySchema>;
