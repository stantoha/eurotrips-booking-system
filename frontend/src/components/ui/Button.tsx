// ============================================================
// EUROTRIPS — ui/Button.tsx
// Pill-кнопка дизайн-системи. Cyan = основна системна дія,
// red = CTA/деструктивна. Кнопки Eurotrips ЗАВЖДИ pill.
// Стилі: .et-btn у styles/globals.css (@layer components).
// ============================================================

import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'cta' | 'danger' | 'ghost';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

// Повні літерали, а НЕ `et-btn--${variant}`: Tailwind сканує сирий текст
// і вирізав би динамічно зібрані класи з @layer components.
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:   'et-btn--primary',
  secondary: 'et-btn--secondary',
  cta:       'et-btn--cta',
  danger:    'et-btn--danger',
  ghost:     'et-btn--ghost',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  xs: 'et-btn--xs',
  sm: 'et-btn--sm',
  md: 'et-btn--md',
  lg: 'et-btn--lg',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = ET Cyan · cta = ET Red uppercase · danger = ET Red · secondary = контурна · ghost = без фону */
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Замінює ліву іконку на спінер і блокує кнопку */
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  iconLeft,
  iconRight,
  children,
  className = '',
  type = 'button',
  disabled,
  ...rest
}) => {
  const cls = ['et-btn', VARIANT_CLASS[variant], SIZE_CLASS[size], block ? 'et-btn--block' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <span className="et-btn__spin" aria-hidden="true" /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  );
};

export default Button;
