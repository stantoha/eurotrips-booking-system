// ============================================================
// EUROTRIPS — RegisterForm Component
// Публічна реєстрація туриста. React Hook Form + Zod валідація.
// Підключено до POST /api/v1/auth/register (завжди role='tourist')
// ============================================================

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import {
  Mail, Lock, User, Phone, Eye, EyeOff, AlertCircle, Loader2, MapPin,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

// ─── SCHEMA (дзеркалить auth.schema.ts RegisterSchema на бекенді) ──

const registerSchema = z.object({
  firstName: z.string().min(2, "Ім'я занадто коротке").max(100),
  lastName:  z.string().min(2, 'Прізвище занадто коротке').max(100),
  email:     z.string().min(1, "Email обов'язковий").email('Введіть коректний email'),
  phone:     z.string().optional(),
  password:  z
    .string()
    .min(8, 'Пароль мінімум 8 символів')
    .regex(/[A-Z]/, 'Пароль має містити хоча б одну велику літеру')
    .regex(/[0-9]/, 'Пароль має містити хоча б одну цифру'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  onSuccess?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess }) => {
  const { signUp, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register: registerField,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
  });

  const onSubmit = async (formData: RegisterFormData) => {
    setServerError(null);
    const result = await signUp(formData);
    if (result.success) {
      onSuccess?.();
    } else {
      setServerError(result.error ?? 'Помилка реєстрації');
    }
  };

  const disabled = isSubmitting || isLoading;
  const inputClass = (hasError: boolean) => `
    w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm
    bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100
    placeholder:text-slate-400
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
    disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150
    ${hasError
      ? 'border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-950/10'
      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
    }
  `;

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="flex items-center gap-2 justify-center mb-8">
        <div className="w-8 h-8 bg-brand-cyan rounded-lg flex items-center justify-center">
          <MapPin size={16} className="text-white" aria-hidden="true" />
        </div>
        <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">Eurotrips</span>
      </div>

      <h1 className="text-xl font-semibold text-center text-slate-900 dark:text-slate-100 mb-1">
        Реєстрація туриста
      </h1>
      <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-8">
        Створіть акаунт, щоб бачити свої бронювання та тури
      </p>

      {serverError && (
        <div className="flex items-start gap-2.5 p-3 mb-5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400">{serverError}</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="reg-firstName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Ім'я</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
              <input id="reg-firstName" {...registerField('firstName')} type="text" autoComplete="given-name" disabled={disabled}
                aria-invalid={!!errors.firstName} className={inputClass(!!errors.firstName)} />
            </div>
            {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>}
          </div>
          <div>
            <label htmlFor="reg-lastName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Прізвище</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
              <input id="reg-lastName" {...registerField('lastName')} type="text" autoComplete="family-name" disabled={disabled}
                aria-invalid={!!errors.lastName} className={inputClass(!!errors.lastName)} />
            </div>
            {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
            <input id="reg-email" {...registerField('email')} type="email" autoComplete="email" autoFocus disabled={disabled}
              placeholder="you@example.com" aria-invalid={!!errors.email} className={inputClass(!!errors.email)} />
          </div>
          {errors.email && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={10} />{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="reg-phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Телефон (необов'язково)</label>
          <div className="relative">
            <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
            <input id="reg-phone" {...registerField('phone')} type="tel" autoComplete="tel" disabled={disabled}
              placeholder="+380..." className={inputClass(false)} />
          </div>
        </div>

        <div>
          <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Пароль</label>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
            <input id="reg-password" {...registerField('password')} type={showPassword ? 'text' : 'password'} autoComplete="new-password"
              disabled={disabled} placeholder="Мінімум 8 символів" aria-invalid={!!errors.password} className={`${inputClass(!!errors.password)} pr-10`} />
            <button type="button" onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Приховати пароль' : 'Показати пароль'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" tabIndex={-1}>
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={10} />{errors.password.message}</p>}
        </div>

        <button
          type="button"
          onClick={handleSubmit(onSubmit)}
          disabled={disabled}
          aria-busy={disabled}
          className="w-full mt-2 py-2.5 px-4 rounded-pill font-semibold text-sm bg-brand-red text-white hover:bg-brand-red-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2"
        >
          {disabled ? (<><Loader2 size={15} className="animate-spin" aria-hidden="true" />Реєструємо...</>) : 'Зареєструватися'}
        </button>
      </div>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
        Вже маєте акаунт?{' '}
        <Link to="/login" className="text-brand-cyan hover:underline font-medium">Увійти</Link>
      </p>
    </div>
  );
};

export default RegisterForm;
