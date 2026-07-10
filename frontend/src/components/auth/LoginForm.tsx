// ============================================================
// EUROTRIPS — LoginForm Component
// React Hook Form + Zod валідація
// Підключено до POST /api/v1/auth/login
// ============================================================

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Mail, Lock, Eye, EyeOff, AlertCircle, Loader2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

// ─── SCHEMA ───────────────────────────────────────────────────

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email обов\'язковий')
    .email('Введіть коректний email'),
  password: z
    .string()
    .min(1, 'Пароль обов\'язковий')
    .min(6, 'Пароль мінімум 6 символів'),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ─── PROPS ───────────────────────────────────────────────────

interface LoginFormProps {
  /** Викликається після успішного логіну (перед редіректом) */
  onSuccess?: () => void;
}

// ─── COMPONENT ───────────────────────────────────────────────

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const { signIn, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',        // Показуємо помилки після blur
  });

  const onSubmit = async (formData: LoginFormData) => {
    setServerError(null);
    const result = await signIn(formData);
    if (result.success) {
      onSuccess?.();
    } else {
      setServerError(result.error ?? 'Помилка авторизації');
    }
  };

  const disabled = isSubmitting || isLoading;

  return (
    // НЕ використовуємо <form> — тільки <div> + onSubmit через button
    // (відповідно до інструкцій: no <form> tags in React artifacts)
    <div className="w-full max-w-sm mx-auto">
      {/* Logo */}
      <div className="flex items-center gap-2 justify-center mb-8">
        <div className="w-8 h-8 bg-brand-cyan rounded-lg flex items-center justify-center">
          <img
            src="/ET_logo_white.svg"
            alt="Eurotrips"
            className="w-8 h-8 object-contain"
          />
        </div>
        <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Eurotrips
        </span>
      </div>

      <h1 className="text-xl font-semibold text-center text-slate-900 dark:text-slate-100 mb-1">
        Вхід у систему
      </h1>
      <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-8">
        Система бронювання та управління турами
      </p>

      {/* Server error */}
      {serverError && (
        <div className="flex items-start gap-2.5 p-3 mb-5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400">{serverError}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* ── EMAIL ── */}
        <div>
          <label
            htmlFor="login-email"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Email
          </label>
          <div className="relative">
            <Mail
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="login-email"
              {...register('email')}
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="manager@eurotrips.ua"
              disabled={disabled}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className={`
                w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm
                bg-white dark:bg-slate-900
                text-slate-900 dark:text-slate-100
                placeholder:text-slate-400
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-150
                ${errors.email
                  ? 'border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-950/10'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }
              `}
            />
          </div>
          {errors.email && (
            <p id="email-error" role="alert" className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle size={10} aria-hidden="true" />
              {errors.email.message}
            </p>
          )}
        </div>

        {/* ── PASSWORD ── */}
        <div>
          <label
            htmlFor="login-password"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Пароль
          </label>
          <div className="relative">
            <Lock
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="login-password"
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={disabled}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              className={`
                w-full pl-9 pr-10 py-2.5 rounded-lg border text-sm
                bg-white dark:bg-slate-900
                text-slate-900 dark:text-slate-100
                placeholder:text-slate-400
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-150
                ${errors.password
                  ? 'border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-950/10'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }
              `}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Приховати пароль' : 'Показати пароль'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" role="alert" className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle size={10} aria-hidden="true" />
              {errors.password.message}
            </p>
          )}
        </div>

        {/* ── SUBMIT ── */}
        <button
          type="button"
          onClick={handleSubmit(onSubmit)}
          disabled={disabled}
          aria-busy={disabled}
          className="
            w-full mt-2 py-2.5 px-4 rounded-pill font-semibold text-sm
            bg-brand-red text-white
            hover:bg-brand-red-dark
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center justify-center gap-2
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2
          "
        >
          {disabled ? (
            <>
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              Входимо...
            </>
          ) : (
            'Увійти в систему'
          )}
        </button>
      </div>

      {/* Role hint (dev only) */}
      {import.meta.env.DEV && (
        <details className="mt-6">
          <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 text-center">
            Тестові акаунти
          </summary>
          <div className="mt-2 space-y-1 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
            {[
              { role: 'admin',       email: 'admin@eurotrips.ua' },
              { role: 'director',    email: 'director@eurotrips.ua' },
              { role: 'manager',     email: 'a.sych@eurotrips.ua' },
              { role: 'ops',         email: 'ops@eurotrips.ua' },
              { role: 'accountant',  email: 'finance@eurotrips.ua' },
              { role: 'agent',       email: 'agent@agency.ua' },
              { role: 'agent (network)', email: 'agent2@agency.ua' },
              { role: 'tourist',     email: 'tourist@eurotrips.ua' },
            ].map(({ role, email }) => (
              <div key={role} className="flex justify-between font-mono">
                <span className="text-slate-400">{role}</span>
                <span>{email}</span>
              </div>
            ))}
            <div className="text-slate-400 mt-1">Пароль: test1234</div>
          </div>
        </details>
      )}
    </div>
  );
};

export default LoginForm;
