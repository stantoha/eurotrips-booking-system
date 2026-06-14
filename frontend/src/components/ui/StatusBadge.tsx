// ============================================================
// EUROTRIPS — StatusBadge Component
// 15 статусів бронювання з кольорами, іконками та анімацією
// ============================================================

import React from 'react';
import * as LucideIcons from 'lucide-react';
import { BookingStatus, TourStatus, LeadStatus, PaymentStatus, CommissionStatus } from '../../types';
import {
  BOOKING_STATUS_CONFIG,
  TOUR_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  LEAD_STATUS_CONFIG,
  COMMISSION_STATUS_CONFIG,
  STATUS_COLOR_CLASSES,
  StatusConfig,
} from '../../constants/statuses';

// ─── TYPES ───────────────────────────────────────────────────

type AnyStatus =
  | BookingStatus
  | TourStatus
  | LeadStatus
  | PaymentStatus
  | CommissionStatus;

type StatusDomain =
  | 'booking'
  | 'tour'
  | 'lead'
  | 'payment'
  | 'commission';

export interface StatusBadgeProps {
  /** Значення статусу — один з 15 статусів бронювання або інших доменів */
  status: AnyStatus;
  /** Домен визначає, який конфіг використовувати. За замовч.: 'booking' */
  domain?: StatusDomain;
  /** Розмір бейджа */
  size?: 'xs' | 'sm' | 'md';
  /** Показувати іконку */
  showIcon?: boolean;
  /** Показувати пульсуючу крапку для активних статусів */
  showPulse?: boolean;
  /** Додаткові CSS класи */
  className?: string;
  /** Tooltip текст (description зі статус-конфігу) */
  showTooltip?: boolean;
}

// ─── CONFIG GETTER ───────────────────────────────────────────

function getStatusConfig(status: AnyStatus, domain: StatusDomain): StatusConfig | undefined {
  switch (domain) {
    case 'booking':    return BOOKING_STATUS_CONFIG[status as BookingStatus];
    case 'tour':       return TOUR_STATUS_CONFIG[status as TourStatus];
    case 'lead':       return LEAD_STATUS_CONFIG[status as LeadStatus];
    case 'payment':    return PAYMENT_STATUS_CONFIG[status as PaymentStatus];
    case 'commission': return COMMISSION_STATUS_CONFIG[status as CommissionStatus];
    default:           return BOOKING_STATUS_CONFIG[status as BookingStatus];
  }
}

// ─── SIZE CLASSES ────────────────────────────────────────────

const SIZE_CLASSES = {
  xs: { badge: 'px-1.5 py-0.5 text-[10px] gap-1',   icon: 11, dot: 'w-1.5 h-1.5' },
  sm: { badge: 'px-2 py-0.5 text-[11px] gap-1',     icon: 12, dot: 'w-2 h-2' },
  md: { badge: 'px-2.5 py-1 text-xs gap-1.5',       icon: 13, dot: 'w-2 h-2' },
};

// ─── COMPONENT ───────────────────────────────────────────────

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  domain = 'booking',
  size = 'md',
  showIcon = true,
  showPulse = true,
  className = '',
  showTooltip = false,
}) => {
  const config = getStatusConfig(status, domain);

  if (!config) {
    // Fallback для невідомого статусу
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 ${className}`}>
        {status}
      </span>
    );
  }

  const colorClasses = STATUS_COLOR_CLASSES[config.colorVariant];
  const sizeClasses = SIZE_CLASSES[size];
  const isPulsing = showPulse && config.isPulsing;

  // Динамічний імпорт іконки з Lucide
  const IconComponent = showIcon
    ? (LucideIcons as Record<string, React.FC<{ size?: number; className?: string }>>)[config.icon]
    : null;

  const badge = (
    <span
      className={`
        inline-flex items-center border rounded-full font-medium whitespace-nowrap
        transition-opacity duration-200
        ${sizeClasses.badge}
        ${colorClasses.badge}
        ${isPulsing ? 'animate-pulse' : ''}
        ${className}
      `}
      title={showTooltip ? config.description : undefined}
    >
      {/* Пульсуюча крапка для активних статусів */}
      {isPulsing && (
        <span className="relative flex shrink-0">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${colorClasses.dot}`} />
          <span className={`relative inline-flex rounded-full ${sizeClasses.dot} ${colorClasses.dot}`} />
        </span>
      )}

      {/* Іконка (без пульсації) */}
      {!isPulsing && IconComponent && (
        <IconComponent size={sizeClasses.icon} className="shrink-0" />
      )}

      {config.label}
    </span>
  );

  return badge;
};

// ─── STATUS DOT (мінімальний варіант) ────────────────────────

export interface StatusDotProps {
  status: AnyStatus;
  domain?: StatusDomain;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusDot: React.FC<StatusDotProps> = ({
  status,
  domain = 'booking',
  size = 'md',
}) => {
  const config = getStatusConfig(status, domain);
  if (!config) return null;

  const colorClasses = STATUS_COLOR_CLASSES[config.colorVariant];
  const sizePx = size === 'sm' ? 'w-2 h-2' : size === 'lg' ? 'w-3 h-3' : 'w-2.5 h-2.5';

  return (
    <span className="relative flex shrink-0">
      {config.isPulsing && (
        <span className={`animate-ping absolute inline-flex rounded-full opacity-75 ${sizePx} ${colorClasses.dot}`} />
      )}
      <span className={`relative inline-flex rounded-full ${sizePx} ${colorClasses.dot}`} />
    </span>
  );
};

// ─── STATUS SELECT (для фільтрів) ────────────────────────────

export interface StatusSelectProps {
  value: BookingStatus | 'all';
  onChange: (status: BookingStatus | 'all') => void;
  className?: string;
}

export const StatusSelect: React.FC<StatusSelectProps> = ({ value, onChange, className = '' }) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as BookingStatus | 'all')}
      className={`text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none ${className}`}
    >
      <option value="all">Всі статуси</option>
      {(Object.keys(BOOKING_STATUS_CONFIG) as BookingStatus[]).map((key) => (
        <option key={key} value={key}>
          {BOOKING_STATUS_CONFIG[key].label}
        </option>
      ))}
    </select>
  );
};

export default StatusBadge;
