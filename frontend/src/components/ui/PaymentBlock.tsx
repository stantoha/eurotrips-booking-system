// ============================================================
// EUROTRIPS — PaymentBlock Component
// Передоплата / залишок / статус оплати
// Поля з Фінансової моделі (розділ 3.2), Business Rules BR-01–BR-06
// ============================================================

import React from 'react';
import {
  CreditCard, Clock, AlertOctagon, CheckCircle2,
  TrendingDown, Calendar, ArrowRight, Banknote, Info
} from 'lucide-react';
import { PaymentInfo, UserRole } from '../../types';
import { StatusBadge } from './StatusBadge';

// ─── TYPES ───────────────────────────────────────────────────

export interface PaymentBlockProps {
  payment: PaymentInfo;
  /** Роль визначає видимість комісійних рядків */
  userRole?: UserRole;
  /** Компактний варіант для таблиць */
  compact?: boolean;
  /** Callback для кнопки "Внести оплату" */
  onAddPayment?: () => void;
  /** Показувати деталізацію собівартості (тільки admin/accountant) */
  showCommission?: boolean;
  className?: string;
}

// ─── HELPERS ─────────────────────────────────────────────────

function formatCurrency(amount: number, currency = 'EUR'): string {
  return `${amount.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
}

function getProgressColor(status: string, pct: number): string {
  if (status === 'overdue') return 'bg-red-500';
  if (status === 'fully_paid') return 'bg-emerald-500';
  if (pct >= 50) return 'bg-blue-500';
  if (pct > 0) return 'bg-amber-500';
  return 'bg-slate-300 dark:bg-slate-600';
}

function getDaysUntilDeadline(deadline: string): number {
  const today = new Date();
  const due = new Date(deadline);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getDeadlineColor(days: number, status: string): string {
  if (status === 'fully_paid') return 'text-slate-400';
  if (status === 'overdue' || days < 0) return 'text-red-600 dark:text-red-400';
  if (days <= 3) return 'text-red-600 dark:text-red-400';
  if (days <= 14) return 'text-amber-600 dark:text-amber-400';
  return 'text-slate-600 dark:text-slate-400';
}

function canSeeCommission(role?: UserRole): boolean {
  return ['admin', 'director', 'accountant'].includes(role ?? '');
}

// ─── PAYMENT STEP INDICATOR ──────────────────────────────────

const PaymentStep: React.FC<{
  label: string;
  amount: number;
  currency: string;
  isDone: boolean;
  isActive: boolean;
}> = ({ label, amount, currency, isDone, isActive }) => (
  <div className="flex items-center gap-2">
    <div className={`
      w-5 h-5 rounded-full flex items-center justify-center shrink-0
      ${isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}
    `}>
      {isDone ? <CheckCircle2 size={12} /> : <span className="text-[10px] font-bold">{isActive ? '→' : '○'}</span>}
    </div>
    <div>
      <p className={`text-xs font-medium ${isDone ? 'text-slate-500 line-through' : isActive ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
        {label}
      </p>
      <p className={`text-sm font-semibold ${isDone ? 'text-slate-400' : isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'}`}>
        {formatCurrency(amount, currency)}
      </p>
    </div>
  </div>
);

// ─── MAIN COMPONENT ──────────────────────────────────────────

export const PaymentBlock: React.FC<PaymentBlockProps> = ({
  payment,
  userRole,
  compact = false,
  onAddPayment,
  showCommission,
  className = '',
}) => {
  const currency = payment.currency ?? 'EUR';
  const pct = payment.total_price > 0
    ? Math.round((payment.amount_paid / payment.total_price) * 100)
    : 0;
  const progressColor = getProgressColor(payment.payment_status, pct);
  const daysUntil = getDaysUntilDeadline(payment.payment_deadline);
  const deadlineColor = getDeadlineColor(daysUntil, payment.payment_status);
  const isFullyPaid = payment.payment_status === 'fully_paid';
  const isOverdue = payment.payment_status === 'overdue';
  const depositPaid = payment.amount_paid >= payment.deposit_amount;

  // ── COMPACT VARIANT ──────────────────────────────────────

  if (compact) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex-1">
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>{formatCurrency(payment.amount_paid, currency)} з {formatCurrency(payment.total_price, currency)}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${progressColor}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <StatusBadge status={payment.payment_status} domain="payment" size="xs" />
      </div>
    );
  }

  // ── FULL VARIANT ─────────────────────────────────────────

  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 mb-1 truncate">{payment.label}</p>
          <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {formatCurrency(payment.total_price, currency)}
          </p>
        </div>
        <StatusBadge status={payment.payment_status} domain="payment" size="sm" />
      </div>

      {/* Progress bar */}
      <div className="mb-1">
        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="flex justify-between text-xs text-slate-400 mb-4">
        <span>Сплачено: <span className="font-medium text-slate-600 dark:text-slate-300">{formatCurrency(payment.amount_paid, currency)}</span></span>
        <span>{pct}% виконано</span>
      </div>

      {/* Payment steps */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <PaymentStep
          label="Передоплата (депозит)"
          amount={payment.deposit_amount}
          currency={currency}
          isDone={depositPaid}
          isActive={!depositPaid}
        />
        <PaymentStep
          label="Залишок (доплата)"
          amount={payment.balance_due}
          currency={currency}
          isDone={isFullyPaid}
          isActive={depositPaid && !isFullyPaid}
        />
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-800 mb-4" />

      {/* Deadline & details */}
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div>
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <Calendar size={11} /> Дедлайн оплати
          </p>
          <p className={`font-medium ${deadlineColor}`}>
            {payment.payment_deadline}
            {!isFullyPaid && daysUntil > 0 && (
              <span className="text-xs ml-1 font-normal">({daysUntil}д)</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <TrendingDown size={11} /> Залишок
          </p>
          <p className={`font-medium ${payment.balance_due > 0
            ? isOverdue ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
            : 'text-emerald-600 dark:text-emerald-500'
          }`}>
            {payment.balance_due > 0 ? formatCurrency(payment.balance_due, currency) : '— Закрито'}
          </p>
        </div>
      </div>

      {/* Overdue warning (BR-06) */}
      {isOverdue && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mb-4">
          <AlertOctagon size={14} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-600 dark:text-red-400">
            Прострочено! Менеджер отримав задачу. Зверніться до клієнта або скасуйте бронювання.
          </p>
        </div>
      )}

      {/* Commission info (RBAC: тільки для admin/accountant — BR-04) */}
      {showCommission && canSeeCommission(userRole) && payment.commission_amount && (
        <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2 mb-4">
          <div className="flex items-center gap-2">
            <Banknote size={14} className="text-emerald-500" />
            <div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Комісія агента</p>
              {payment.commission_status && (
                <StatusBadge status={payment.commission_status} domain="commission" size="xs" />
              )}
            </div>
          </div>
          <p className="font-semibold text-emerald-700 dark:text-emerald-300">
            {formatCurrency(payment.commission_amount, currency)}
          </p>
        </div>
      )}

      {/* Add payment button */}
      {onAddPayment && !isFullyPaid && (
        <button
          onClick={onAddPayment}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition-colors"
        >
          <CreditCard size={15} />
          Внести оплату
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
};

// ─── PAYMENT SUMMARY (для списку бронювань) ──────────────────

export interface PaymentSummaryProps {
  totalBookings: number;
  totalRevenue: number;
  totalPaid: number;
  totalDebt: number;
  overdueCount: number;
  currency?: string;
}

export const PaymentSummary: React.FC<PaymentSummaryProps> = ({
  totalBookings, totalRevenue, totalPaid, totalDebt, overdueCount, currency = 'EUR',
}) => {
  const pct = totalRevenue > 0 ? Math.round((totalPaid / totalRevenue) * 100) : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Всього бронювань', value: totalBookings.toString(), sub: null, color: 'text-slate-900 dark:text-slate-100' },
        { label: 'Загальна виручка', value: formatCurrency(totalRevenue, currency), sub: null, color: 'text-slate-900 dark:text-slate-100' },
        { label: 'Фактично сплачено', value: formatCurrency(totalPaid, currency), sub: `${pct}%`, color: 'text-emerald-600 dark:text-emerald-400' },
        { label: 'Загальний борг', value: formatCurrency(totalDebt, currency), sub: overdueCount > 0 ? `${overdueCount} прострочено` : null, color: totalDebt > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400' },
      ].map(({ label, value, sub, color }) => (
        <div key={label} className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-400 mb-1">{label}</p>
          <p className={`text-base font-semibold ${color}`}>{value}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
        </div>
      ))}
    </div>
  );
};

export default PaymentBlock;
