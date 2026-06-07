// ============================================================
// EUROTRIPS — Status Configuration
// 15 статусів бронювання згідно ТЗ-скелету розділ 5.1
// ============================================================

import { BookingStatus, TourStatus, LeadStatus, PaymentStatus } from '../types';

// Кольорові групи для Tailwind CSS (light + dark mode)
export type StatusColorVariant =
  | 'info'       // blue  — нові / в роботі
  | 'warning'    // amber — потребує уваги / очікує оплату
  | 'success'    // green — підтверджено / завершено-позитивно
  | 'danger'     // red   — скасовано / no-show / refund
  | 'secondary'; // gray  — завершено / нейтральні

export interface StatusConfig {
  label: string;
  icon: string;                  // Назва іконки Lucide React
  colorVariant: StatusColorVariant;
  isPulsing?: boolean;           // true для активних/очікуючих статусів
  description?: string;          // Підказка для UI
}

// ─── BOOKING STATUSES ────────────────────────────────────────

export const BOOKING_STATUS_CONFIG: Record<BookingStatus, StatusConfig> = {
  new: {
    label: 'Нова заявка',
    icon: 'CirclePlus',
    colorVariant: 'info',
    isPulsing: true,
    description: 'Заявка щойно надійшла, ще не взята в роботу',
  },
  in_work: {
    label: 'У роботі',
    icon: 'Loader2',
    colorVariant: 'info',
    description: 'Менеджер веде клієнта',
  },
  needs_clarification: {
    label: 'Потребує уточнення',
    icon: 'AlertCircle',
    colorVariant: 'warning',
    description: 'Потрібна додаткова інформація від клієнта або агента',
  },
  pre_booked: {
    label: 'Попередньо заброньовано',
    icon: 'Bookmark',
    colorVariant: 'secondary',
    description: 'Місце зарезервовано, оплата ще не надійшла',
  },
  awaiting_payment: {
    label: 'Очікує оплату',
    icon: 'CreditCard',
    colorVariant: 'warning',
    isPulsing: true,
    description: 'Виставлено рахунок, очікуємо депозит від клієнта',
  },
  partially_paid: {
    label: 'Частково оплачено',
    icon: 'Coins',
    colorVariant: 'info',
    description: 'Депозит сплачено, залишок ще не надійшов',
  },
  confirmed: {
    label: 'Підтверджено',
    icon: 'CheckCircle2',
    colorVariant: 'success',
    description: 'Повна оплата отримана, місце гарантоване',
  },
  docs_collected: {
    label: 'Документи зібрані',
    icon: 'Files',
    colorVariant: 'success',
    description: 'Всі документи туриста перевірено та сформовано',
  },
  ready_to_depart: {
    label: 'Готово до виїзду',
    icon: 'Luggage',
    colorVariant: 'success',
    description: 'Тур готовий — всі перевірки пройдені',
  },
  on_trip: {
    label: 'У поїздці',
    icon: 'Route',
    colorVariant: 'success',
    isPulsing: true,
    description: 'Турист зараз у подорожі',
  },
  completed: {
    label: 'Завершено',
    icon: 'Archive',
    colorVariant: 'secondary',
    description: 'Тур завершено успішно. Комісія агента: до виплати (BR-03)',
  },
  cancelled_client: {
    label: 'Скасовано клієнтом',
    icon: 'XCircle',
    colorVariant: 'danger',
    description: 'Клієнт відмовився від туру. Штраф застосовано відповідно до умов',
  },
  cancelled_operator: {
    label: 'Скасовано оператором',
    icon: 'Ban',
    colorVariant: 'danger',
    description: 'Оператор скасував тур. Повне повернення клієнту (BR-08)',
  },
  no_show: {
    label: 'No-show',
    icon: 'UserX',
    colorVariant: 'danger',
    description: 'Клієнт не з\'явився. Штраф 100%. Комісія не виплачується',
  },
  refund: {
    label: 'Refund',
    icon: 'RotateCcw',
    colorVariant: 'danger',
    description: 'Повернення коштів обробляється',
  },
};

// ─── COLOR CLASSES MAP ───────────────────────────────────────

export const STATUS_COLOR_CLASSES: Record<StatusColorVariant, {
  badge: string;
  dot: string;
  text: string;
}> = {
  info: {
    badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    dot: 'bg-blue-500',
    text: 'text-blue-700 dark:text-blue-300',
  },
  success: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  warning: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
  },
  danger: {
    badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-300',
  },
  secondary: {
    badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    dot: 'bg-slate-400',
    text: 'text-slate-600 dark:text-slate-400',
  },
};

// ─── TOUR STATUSES ───────────────────────────────────────────

export const TOUR_STATUS_CONFIG: Record<TourStatus, StatusConfig> = {
  draft:       { label: 'Чернетка',                icon: 'FileEdit',      colorVariant: 'secondary' },
  open:        { label: 'Відкрито для продажу',    icon: 'DoorOpen',      colorVariant: 'info' },
  active:      { label: 'Активно продається',      icon: 'TrendingUp',    colorVariant: 'success', isPulsing: true },
  almost_full: { label: 'Майже заповнений',        icon: 'AlertTriangle', colorVariant: 'warning', isPulsing: true },
  closed:      { label: 'Закрито',                 icon: 'Lock',          colorVariant: 'secondary' },
  on_tour:     { label: 'У виїзді',                icon: 'Route',         colorVariant: 'success', isPulsing: true },
  completed:   { label: 'Завершено',               icon: 'CheckCircle2',  colorVariant: 'secondary' },
  cancelled:   { label: 'Скасовано',               icon: 'XCircle',       colorVariant: 'danger' },
};

// ─── PAYMENT STATUSES ────────────────────────────────────────

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, StatusConfig> = {
  unpaid:         { label: 'Не оплачено',        icon: 'CircleDashed',    colorVariant: 'danger' },
  deposit_paid:   { label: 'Депозит сплачено',   icon: 'CreditCard',      colorVariant: 'warning' },
  partially_paid: { label: 'Частково оплачено',  icon: 'Coins',           colorVariant: 'info' },
  fully_paid:     { label: 'Повністю оплачено',  icon: 'CircleCheckBig',  colorVariant: 'success' },
  overdue:        { label: 'Прострочено',         icon: 'AlertOctagon',    colorVariant: 'danger', isPulsing: true },
};

// ─── LEAD STATUSES ───────────────────────────────────────────

export const LEAD_STATUS_CONFIG: Record<LeadStatus, StatusConfig> = {
  new:               { label: 'Новий',              icon: 'Sparkles',      colorVariant: 'info', isPulsing: true },
  in_work:           { label: 'У роботі',           icon: 'Loader2',       colorVariant: 'info' },
  needs_clarification:{ label: 'Потребує уточнення',icon: 'AlertCircle',   colorVariant: 'warning' },
  proposal_sent:     { label: 'Надіслано пропозицію',icon: 'Send',         colorVariant: 'info' },
  waiting_decision:  { label: 'Очікує рішення',     icon: 'Clock',         colorVariant: 'warning', isPulsing: true },
  won:               { label: 'Успішний',           icon: 'Trophy',        colorVariant: 'success' },
  lost:              { label: 'Втрачений',          icon: 'XCircle',       colorVariant: 'danger' },
};

// ─── COMMISSION STATUSES ─────────────────────────────────────

import { CommissionStatus } from '../types';

export const COMMISSION_STATUS_CONFIG: Record<CommissionStatus, StatusConfig> = {
  pending:   { label: 'Нараховано',     icon: 'Clock',         colorVariant: 'warning' },
  frozen:    { label: 'Заморожено',     icon: 'Snowflake',     colorVariant: 'secondary' },
  to_pay:    { label: 'До виплати',     icon: 'Banknote',      colorVariant: 'success', isPulsing: true },
  paid:      { label: 'Виплачено',      icon: 'CircleCheckBig',colorVariant: 'success' },
  cancelled: { label: 'Скасовано',      icon: 'XCircle',       colorVariant: 'danger' },
};

// ─── AGENT TYPE LABELS ───────────────────────────────────────

export const AGENT_TYPE_CONFIG: Record<string, { label: string; icon: string; colorVariant: StatusColorVariant }> = {
  standard: { label: 'Стандартний агент', icon: 'User',    colorVariant: 'secondary' },
  network:  { label: 'Мережевий агент',   icon: 'Network', colorVariant: 'info' },
};

// ─── BOOKING TYPE LABELS ─────────────────────────────────────

export const BOOKING_TYPE_LABELS: Record<string, string> = {
  direct:    'Прямий',
  agent:     'Агент',
  corporate: 'Корпоративний',
  group:     'Груповий',
};
