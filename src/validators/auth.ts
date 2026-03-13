import { z } from 'zod';
import type { ApiErrorBody } from '@/types/api';
import { phoneSchema } from './shared';

export const registerSchema = z
  .object({
    first_name: z.string().min(2).max(100),
    last_name: z.string().min(2).max(100),
    email: z
      .string()
      .email()
      .max(320, 'Email must not exceed 320 characters')
      .refine((s) => !s.includes('..'), { message: 'Email cannot contain consecutive dots' }),
    phone: phoneSchema,
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must not exceed 128 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[@$!%*#?&_\-+=]/, 'Password must contain at least one special character. Allowed: @ $ ! % * # ? & _ - + =')
      .regex(/^[A-Za-z0-9@$!%*#?&_\-+=]+$/, 'Password contains invalid characters. Only letters, numbers, and these special characters are allowed: @ $ ! % * # ? & _ - + ='),
    confirm_password: z.string().min(1, 'Password confirmation is required'),
    remember_me: z.boolean().optional().default(false),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

export type RegisterDto = z.infer<typeof registerSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const resendEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[@$!%*#?&_\-+=]/, 'Password must contain at least one special character. Allowed: @ $ ! % * # ? & _ - + =')
  .regex(/^[A-Za-z0-9@$!%*#?&_\-+=]+$/, 'Password contains invalid characters. Only letters, numbers, and these special characters are allowed: @ $ ! % * # ? & _ - + =');

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(320, 'Email must not exceed 320 characters'),
  password: z.string().min(1, 'Password is required').max(128, 'Password must not exceed 128 characters'),
  remember_me: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    new_password: passwordSchema,
    confirm_new_password: z.string().min(1, 'Password confirmation is required'),
  })
  .refine((data) => data.new_password === data.confirm_new_password, {
    message: 'Passwords do not match',
    path: ['confirm_new_password'],
  });

export function mapZodErrors(
  err: z.ZodError
): NonNullable<ApiErrorBody['errors']> {
  return err.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
}
