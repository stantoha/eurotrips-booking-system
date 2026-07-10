// ============================================================
// EUROTRIPS — Status Configuration
// 15 статусів бронювання згідно ТЗ-скелету розділ 5.1
// ============================================================

import { BookingStatus, TourStatus, LeadStatus, PaymentStatus, CommissionStatus } from '../types';

// Кольорові групи для Tailwind CSS (light + dark mode)
export type StatusColorVariant =
  | 'info'       // blue    — нові / в роботі
  | 'warning'    // amber   — потребує уваги / очікує оплату
  | 'success'    // emerald — підтверджено / завершено-позитивно
  | 'danger'     // red     — скасовано / no-show / refund
  | 'neutral';   // slate   — завершено / нейтральні

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
    colorVariant: 'neutral',
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
    colorVariant: 'neutral',
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
  // blue — нові / в роботі
  info: {
    badge: 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe] dark:bg-[rgba(59,130,246,.16)] dark:text-[#93c5fd] dark:border-[rgba(59,130,246,.35)]',
    dot: 'bg-[#3b82f6] dark:bg-[#60a5fa]',
    text: 'text-[#1d4ed8] dark:text-[#93c5fd]',
  },
  // amber — очікування/попередження
  warning: {
    badge: 'bg-[#fffbeb] text-[#b45309] border-[#fde68a] dark:bg-[rgba(245,158,11,.16)] dark:text-[#fcd34d] dark:border-[rgba(245,158,11,.35)]',
    dot: 'bg-[#f59e0b]',
    text: 'text-[#b45309] dark:text-[#fcd34d]',
  },
  // emerald — підтверджено / завершено-позитивно
  success: {
    badge: 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0] dark:bg-[rgba(16,185,129,.16)] dark:text-[#6ee7b7] dark:border-[rgba(16,185,129,.35)]',
    dot: 'bg-[#10b981] dark:bg-[#34d399]',
    text: 'text-[#047857] dark:text-[#6ee7b7]',
  },
  // red — скасовано / no-show / refund
  danger: {
    badge: 'bg-[#fef2f2] text-[#b91c1c] border-[#fecaca] dark:bg-[rgba(239,68,68,.16)] dark:text-[#fca5a5] dark:border-[rgba(239,68,68,.35)]',
    dot: 'bg-[#ef4444] dark:bg-[#f87171]',
    text: 'text-[#b91c1c] dark:text-[#fca5a5]',
  },
  // slate — завершено / нейтральні
  neutral: {
    badge: 'bg-[#f1f5f9] text-[#475569] border-[#e2e8f0] dark:bg-[rgba(100,116,139,.18)] dark:text-[#cbd5e1] dark:border-[rgba(100,116,139,.35)]',
    dot: 'bg-[#64748b] dark:bg-[#94a3b8]',
    text: 'text-[#475569] dark:text-[#cbd5e1]',
  },
};

// ─── TOUR STATUSES ───────────────────────────────────────────

export const TOUR_STATUS_CONFIG: Record<TourStatus, StatusConfig> = {
  draft:       { label: 'Чернетка',                icon: 'FileEdit',      colorVariant: 'neutral' },
  open:        { label: 'Відкрито для продажу',    icon: 'DoorOpen',      colorVariant: 'info' },
  active:      { label: 'Активно продається',      icon: 'TrendingUp',    colorVariant: 'success', isPulsing: true },
  almost_full: { label: 'Майже заповнений',        icon: 'AlertTriangle', colorVariant: 'warning', isPulsing: true },
  closed:      { label: 'Закрито',                 icon: 'Lock',          colorVariant: 'neutral' },
  on_tour:     { label: 'У виїзді',                icon: 'Route',         colorVariant: 'success', isPulsing: true },
  completed:   { label: 'Завершено',               icon: 'CheckCircle2',  colorVariant: 'neutral' },
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

export const COMMISSION_STATUS_CONFIG: Record<CommissionStatus, StatusConfig> = {
  pending:   { label: 'Нараховано',     icon: 'Clock',         colorVariant: 'warning' },
  frozen:    { label: 'Заморожено',     icon: 'Snowflake',     colorVariant: 'neutral' },
  to_pay:    { label: 'До виплати',     icon: 'Banknote',      colorVariant: 'success', isPulsing: true },
  paid:      { label: 'Виплачено',      icon: 'CircleCheckBig',colorVariant: 'success' },
  cancelled: { label: 'Скасовано',      icon: 'XCircle',       colorVariant: 'danger' },
};

// ─── AGENT TYPE LABELS ───────────────────────────────────────

export const AGENT_TYPE_CONFIG: Record<string, { label: string; icon: string; colorVariant: StatusColorVariant }> = {
  standard: { label: 'Стандартний агент', icon: 'User',    colorVariant: 'neutral' },
  network:  { label: 'Мережевий агент',   icon: 'Network', colorVariant: 'info' },
};

// ─── BOOKING TYPE LABELS ─────────────────────────────────────

export const BOOKING_TYPE_LABELS: Record<string, string> = {
  direct:    'Прямий',
  agent:     'Агент',
  corporate: 'Корпоративний',
  group:     'Груповий',
};
