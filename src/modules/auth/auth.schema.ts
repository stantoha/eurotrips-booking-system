// =============================================================================
// EUROTRIPS — Auth Schemas (Zod)
// Валідація вхідних даних для всіх auth-ендпоінтів
// =============================================================================

import { z } from 'zod';

export const LoginSchema = z.object({
  email: z
    .string({ required_error: "Email обов'язковий" })
    .email('Некоректний формат email')
    .toLowerCase(),
  password: z
    .string({ required_error: "Пароль обов'язковий" })
    .min(6, 'Пароль має бути не менше 6 символів'),
});

export const RegisterSchema = z.object({
  email: z
    .string({ required_error: "Email обов'язковий" })
    .email('Некоректний формат email')
    .toLowerCase(),
  password: z
    .string({ required_error: "Пароль обов'язковий" })
    .min(8, 'Пароль має бути не менше 8 символів')
    .regex(/[A-Z]/, 'Пароль має містити хоча б одну велику літеру')
    .regex(/[0-9]/, 'Пароль має містити хоча б одну цифру'),
  firstName: z
    .string({ required_error: "Ім'я обов'язкове" })
    .min(2, "Ім'я занадто коротке")
    .max(100),
  lastName: z
    .string({ required_error: "Прізвище обов'язкове" })
    .min(2, 'Прізвище занадто коротке')
    .max(100),
  phone: z.string().optional(),
  role: z.enum(['manager', 'ops', 'accountant', 'agent', 'tourist']).optional(),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Поточний пароль обов'язковий"),
    newPassword: z
      .string()
      .min(8, 'Новий пароль має бути не менше 8 символів')
      .regex(/[A-Z]/, 'Пароль має містити хоча б одну велику літеру')
      .regex(/[0-9]/, 'Пароль має містити хоча б одну цифру'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Паролі не збігаються',
    path: ['confirmPassword'],
  });

export type LoginDto = z.infer<typeof LoginSchema>;
export type RegisterDto = z.infer<typeof RegisterSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
