import { z } from 'zod';
import { phoneSchema, mapZodErrors, passwordSchema } from './shared';

export { mapZodErrors };

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
    password: passwordSchema,
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

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(320, 'Email must not exceed 320 characters'),
  password: z.string().min(1, 'Password is required').max(128, 'Password must not exceed 128 characters'),
  remember_me: z.boolean().optional().default(false),

  /**
   * The role of the login space the client is connecting from.
   * Enforced server-side: the authenticated user's role must match.
   * Prevents cross-space token issuance (client page → admin token, etc.).
   */
  expected_role: z.enum(['client', 'station', 'admin'], {
    required_error: 'expected_role is required',
    invalid_type_error: 'expected_role must be one of: client, station, admin',
  }),
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
