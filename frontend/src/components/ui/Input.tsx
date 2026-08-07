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

export const Input: React.FC<InputProps> = ({ icon, affix, mono, invalid, className = '', ...rest }) => {
  const cls = ['et-input', mono ? 'et-input--mono' : '', invalid ? 'et-input--invalid' : '',
    icon ? 'et-input--hasIcon' : '', affix ? 'et-input--hasAffix' : '', className]
    .filter(Boolean).join(' ');

  const field = <input className={cls} aria-invalid={invalid || undefined} {...rest} />;
  if (!icon && !affix) return field;

  return (
    <span className="et-input-wrap">
      {icon && <span className="et-input-wrap__icon">{icon}</span>}
      {field}
      {affix && <span className="et-input-wrap__affix">{affix}</span>}
    </span>
  );
};

// ─── TEXTAREA ────────────────────────────────────────────────

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea: React.FC<TextareaProps> = ({ invalid, className = '', ...rest }) => (
  <textarea
    className={['et-textarea', invalid ? 'et-textarea--invalid' : '', className].filter(Boolean).join(' ')}
    aria-invalid={invalid || undefined}
    {...rest}
  />
);

// ─── SELECT ──────────────────────────────────────────────────

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select: React.FC<SelectProps> = ({ invalid, className = '', children, ...rest }) => (
  <span className="et-select-wrap">
    <select
      className={['et-select', invalid ? 'et-select--invalid' : '', className].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
    <span className="et-select-wrap__arrow" aria-hidden="true">▼</span>
  </span>
);

// ─── CHECKBOX / RADIO ────────────────────────────────────────

export interface CheckProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  description?: React.ReactNode;
}

// Повні літерали класів — Tailwind вирізає динамічно зібрані (див. Button.tsx)
const makeCheck = (kindClass: string, inputType: 'checkbox' | 'radio'): React.FC<CheckProps> =>
  function Check({ label, description, className = '', ...rest }) {
    return (
      <label className={`et-check ${kindClass} ${className}`.trim()}>
        <input type={inputType} {...rest} />
        {(label || description) && (
          <span className="et-check__body">
            {label}
            {description && <span className="et-check__desc">{description}</span>}
          </span>
        )}
      </label>
    );
  };

export const Checkbox = makeCheck('et-check--box', 'checkbox');
export const Radio = makeCheck('et-check--radio', 'radio');
