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
  Mail, Lock, Eye, EyeOff, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Input';
import logoWhite from '../../icons/ET_logo_white.png';

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
      {/* Аппмарк — лого в cyan-плитці (DS: brand-appmark) */}
      <div className="flex items-center gap-2 justify-center mb-8">
        <div className="w-8 h-8 bg-brand-cyan rounded-tile flex items-center justify-center">
          <img
            src={logoWhite}
            alt="Eurotrips"
            className="w-8 h-8 object-contain"
          />
        </div>
        <span className="font-mono font-bold text-lg tracking-logo text-content-primary">
          EUROTRIPS
        </span>
      </div>

      <h1 className="font-heading text-h3 font-bold text-center text-content-primary mb-1">
        Вхід у систему
      </h1>
      <p className="text-sm text-center text-content-tertiary mb-8">
        Система бронювання та управління турами
      </p>

      {/* Server error — статусний ramp DS, не бренд-червоний */}
      {serverError && (
        <div className="flex items-start gap-2.5 p-3 mb-5 rounded-tile bg-status-danger-bg border border-status-danger-border">
          <AlertCircle size={15} className="text-status-danger shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-status-danger-fg">{serverError}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* ── EMAIL ── */}
        <Field
          label="Email"
          htmlFor="login-email"
          error={errors.email && (
            <><AlertCircle size={10} aria-hidden="true" />{errors.email.message}</>
          )}
        >
          <Input
            id="login-email"
            {...register('email')}
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="manager@eurotrips.ua"
            disabled={disabled}
            invalid={!!errors.email}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            icon={<Mail size={15} aria-hidden="true" />}
          />
        </Field>

        {/* ── PASSWORD ── */}
        <Field
          label="Пароль"
          htmlFor="login-password"
          error={errors.password && (
            <><AlertCircle size={10} aria-hidden="true" />{errors.password.message}</>
          )}
        >
          <Input
            id="login-password"
            {...register('password')}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            disabled={disabled}
            invalid={!!errors.password}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
            icon={<Lock size={15} aria-hidden="true" />}
            affix={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Приховати пароль' : 'Показати пароль'}
                className="pointer-events-auto text-content-tertiary hover:text-content-secondary transition-colors duration-fast"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            }
          />
        </Field>

        {/* ── SUBMIT ── DS: вхід — це CTA, отже ET Red pill */}
        <Button
          variant="cta"
          size="lg"
          block
          className="mt-2"
          onClick={handleSubmit(onSubmit)}
          loading={disabled}
          aria-busy={disabled}
        >
          {disabled ? 'Входимо…' : 'Увійти в систему'}
        </Button>
      </div>

      {/* Role hint (dev only) */}
      {import.meta.env.DEV && (
        <details className="mt-6">
          <summary className="text-caption text-content-tertiary cursor-pointer hover:text-content-secondary text-center">
            Тестові акаунти
          </summary>
          <div className="mt-2 space-y-1 text-caption text-content-secondary bg-surface-2 rounded-tile p-3">
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
                <span className="text-content-tertiary">{role}</span>
                <span>{email}</span>
              </div>
            ))}
            <div className="text-content-tertiary mt-1">Пароль: test1234</div>
          </div>
        </details>
      )}
    </div>
  );
};

export default LoginForm;
