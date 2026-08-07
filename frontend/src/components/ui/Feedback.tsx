// ============================================================
// EUROTRIPS — ui/Feedback.tsx
// Стани сторінки з дизайн-системи: EmptyState, Skeleton, IconButton.
//
// Правило DS: порожній стан НІКОЛИ не буває просто «немає даних» —
// завжди іконка + пояснення + наступна дія (глухий кут = баг).
// Завантаження — ЗАВЖДИ скелетони, ніколи спінер на весь екран.
// ============================================================

import React from 'react';

// ─── ICON BUTTON ─────────────────────────────────────────────

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'plain' | 'outline' | 'onDark';
  /** Обов'язково: доступна назва (aria-label + title) */
  label: string;
}

// Повні літерали — Tailwind вирізає динамічно зібрані класи (див. Button.tsx)
const ICON_SIZE_CLASS = { sm: 'et-iconbtn--sm', md: 'et-iconbtn--md', lg: 'et-iconbtn--lg' } as const;
const ICON_VARIANT_CLASS = { plain: '', outline: 'et-iconbtn--outline', onDark: 'et-iconbtn--onDark' } as const;

export const IconButton: React.FC<IconButtonProps> = ({
  size = 'md', variant = 'plain', label, children, className = '', type = 'button', ...rest
}) => (
  <button
    type={type}
    className={['et-iconbtn', ICON_SIZE_CLASS[size], ICON_VARIANT_CLASS[variant], className]
      .filter(Boolean).join(' ')}
    aria-label={label}
    title={label}
    {...rest}
  >
    {children}
  </button>
);

// ─── EMPTY STATE ─────────────────────────────────────────────

export interface EmptyStateProps {
  /** Lucide-гліф ~20px у cyan-tint колі */
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** <Button>, що запускає очевидний наступний крок */
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, className = '' }) => (
  <div className={`flex flex-col items-center text-center py-10 px-6 ${className}`.trim()}>
    {icon && (
      <div
        className="flex items-center justify-center w-11 h-11 rounded-pill mb-3"
        style={{ background: 'var(--et-cyan-tint)', color: 'var(--et-cyan-dark)' }}
      >
        {icon}
      </div>
    )}
    <p className="font-heading font-semibold text-h4 text-content-primary">{title}</p>
    {description && <p className="text-sm text-content-tertiary mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// ─── SKELETON ────────────────────────────────────────────────

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  /** 10px pill-смужка для текстових рядків */
  text?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%', height = 10, radius, text = false, className = '', style,
}) => (
  <div
    className={`et-skeleton ${className}`.trim()}
    style={{
      width,
      height: text ? 10 : height,
      borderRadius: radius ?? (text ? 9999 : undefined),
      ...style,
    }}
  />
);

export interface SkeletonRowsProps {
  rows?: number;
  columns?: number[];
}

export const SkeletonRows: React.FC<SkeletonRowsProps> = ({ rows = 4, columns = [140, 90, 200, 70] }) => (
  <div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 py-2.5 border-b border-line last:border-b-0">
        {columns.map((w, j) => <Skeleton key={j} text width={w} />)}
      </div>
    ))}
  </div>
);
