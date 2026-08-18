import { z } from 'zod';

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password must contain letters')
  .regex(/[0-9]/, 'Password must contain numbers');

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Full name is required').max(80),
    email: z.string().trim().toLowerCase().email('Valid email is required'),
    phone: z
      .string()
      .trim()
      .regex(/^01[0125]\d{8}$/, 'Phone must be a valid 11-digit Egyptian mobile number (010/011/012/015)')
      .optional(),
    password,
    role: z.enum(['admin', 'customer']).default('customer'),
    adminCode: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.role === 'admin' && !val.adminCode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['adminCode'], message: 'Admin access code is required' });
    }
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Valid email is required'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[0-9]/, 'Password must contain numbers'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: password,
    newPasswordConfirm: z.string().min(1, 'Please confirm the new password'),
  })
  .superRefine((val, ctx) => {
    if (val.newPassword !== val.newPasswordConfirm) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['newPasswordConfirm'], message: 'Passwords do not match' });
    }
  });

export const changeEmailSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Valid email is required'),
    confirmEmail: z.string().trim().toLowerCase().email('Valid email confirmation is required'),
    currentPassword: z.string().min(1, 'Current password is required'),
  })
  .superRefine((val, ctx) => {
    if (val.email !== val.confirmEmail) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmEmail'], message: 'Emails do not match' });
    }
  });

export const verifyEmailChangeSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});
