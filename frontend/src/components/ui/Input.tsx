// ============================================================
// EUROTRIPS — ui/Input.tsx + Textarea + Select + Field
// Форм-примітиви дизайн-системи: 13px текст, 8px радіус,
// cyan focus-ring. Раніше застосунок стилізував це інлайн на
// кожній сторінці — тепер один контракт.
// ============================================================

import React from 'react';

// ─── FIELD (обгортка з label / hint / error) ─────────────────

export interface FieldProps {
  label?: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

export const Field: React.FC<FieldProps> = ({ label, required, hint, error, htmlFor, children, className = '' }) => (
  <div className={`et-field ${className}`.trim()}>
    {label && (
      <label className="et-field__label" htmlFor={htmlFor}>
        {label}
        {required && <span className="et-field__req" aria-hidden="true">*</span>}
      </label>
    )}
    {children}
    {/* id = `${htmlFor}-error` — щоб aria-describedby контрола знаходив текст помилки */}
    {error ? (
      <span className="et-field__error" id={htmlFor ? `${htmlFor}-error` : undefined} role="alert">
        {error}
      </span>
    ) : hint ? (
      <span className="et-field__hint" id={htmlFor ? `${htmlFor}-hint` : undefined}>{hint}</span>
    ) : null}
  </div>
);

// ─── INPUT ───────────────────────────────────────────────────

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Провідна Lucide-іконка ~15px */
  icon?: React.ReactNode;
  /** Трейлінг-елемент — око пароля, одиниця виміру, кнопка очищення */
  affix?: React.ReactNode;
  /** IBM Plex Mono — коди бронювань, ID турів, суми EUR */
  mono?: boolean;
  invalid?: boolean;
}

// forwardRef ОБОВ'ЯЗКОВИЙ: react-hook-form передає ref через register().
// Без нього ref не доїжджає до <input>, RHF читає значення як undefined
// і форма падає на «Required» навіть із заповненими полями.
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ icon, affix, mono, invalid, className = '', ...rest }, ref) => {
    const cls = ['et-input', mono ? 'et-input--mono' : '', invalid ? 'et-input--invalid' : '',
      icon ? 'et-input--hasIcon' : '', affix ? 'et-input--hasAffix' : '', className]
      .filter(Boolean).join(' ');

    const field = <input ref={ref} className={cls} aria-invalid={invalid || undefined} {...rest} />;
    if (!icon && !affix) return field;

    return (
      <span className="et-input-wrap">
        {icon && <span className="et-input-wrap__icon">{icon}</span>}
        {field}
        {affix && <span className="et-input-wrap__affix">{affix}</span>}
      </span>
    );
  },
);
Input.displayName = 'Input';

// ─── TEXTAREA ────────────────────────────────────────────────

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ invalid, className = '', ...rest }, ref) => (
    <textarea
      ref={ref}
      className={['et-textarea', invalid ? 'et-textarea--invalid' : '', className].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  ),
);
Textarea.displayName = 'Textarea';

// ─── SELECT ──────────────────────────────────────────────────

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ invalid, className = '', children, ...rest }, ref) => (
    <span className="et-select-wrap">
      <select
        ref={ref}
        className={['et-select', invalid ? 'et-select--invalid' : '', className].filter(Boolean).join(' ')}
        aria-invalid={invalid || undefined}
        {...rest}
      >
        {children}
      </select>
      <span className="et-select-wrap__arrow" aria-hidden="true">▼</span>
    </span>
  ),
);
Select.displayName = 'Select';

// ─── CHECKBOX / RADIO ────────────────────────────────────────

export interface CheckProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  description?: React.ReactNode;
}

// Повні літерали класів — Tailwind вирізає динамічно зібрані (див. Button.tsx).
// forwardRef — щоб register() з react-hook-form працював (див. Input вище).
const makeCheck = (kindClass: string, inputType: 'checkbox' | 'radio') =>
  React.forwardRef<HTMLInputElement, CheckProps>(function Check(
    { label, description, className = '', ...rest }, ref,
  ) {
    return (
      <label className={`et-check ${kindClass} ${className}`.trim()}>
        <input ref={ref} type={inputType} {...rest} />
        {(label || description) && (
          <span className="et-check__body">
            {label}
            {description && <span className="et-check__desc">{description}</span>}
          </span>
        )}
      </label>
    );
  });

export const Checkbox = makeCheck('et-check--box', 'checkbox');
Checkbox.displayName = 'Checkbox';
export const Radio = makeCheck('et-check--radio', 'radio');
Radio.displayName = 'Radio';
