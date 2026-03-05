import { z } from 'zod';
import type { ApiErrorBody } from '@/types/api';

export const registerSchema = z.object({
  first_name: z.string().min(2).max(100),
  last_name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().min(8).max(30),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(
      /[^A-Za-z0-9]/,
      'Password must contain at least one special character'
    ),
  remember_me: z.boolean().optional().default(false),
});

export type RegisterDto = z.infer<typeof registerSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const resendEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export function mapZodErrors(
  err: z.ZodError
): NonNullable<ApiErrorBody['errors']> {
  return err.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
}
