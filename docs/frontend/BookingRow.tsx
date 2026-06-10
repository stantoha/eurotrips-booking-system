// ============================================================
// EUROTRIPS — BookingRow Component
// Рядок таблиці бронювань з RBAC-фільтрацією колонок
// Джерело: AC Sprint 1 (A-03), User Stories (M-07), ADR-001
// ============================================================

import React, { useState } from 'react';
import {
  ChevronDown, ChevronUp, MoreHorizontal, Eye, Edit2,
  CreditCard, FileText, MessageSquare, Users, ArrowRight,
  Building2, User, UserCheck, Briefcase
} from 'lucide-react';
import { Booking, UserRole } from '../../types';
import { StatusBadge } from '../ui/StatusBadge';
import { BOOKING_TYPE_LABELS } from '../../constants/statuses';

// ─── TYPES ───────────────────────────────────────────────────

export interface BookingRowProps {
  booking: Booking;
  userRole: UserRole;
  isSelected?: boolean;
  onSelect?: (bookingId: string) => void;
  onView?: (bookingId: string) => void;
  onEdit?: (bookingId: string) => void;
  onPayment?: (bookingId: string) => void;
  className?: string;
}

export interface BookingTableHeaderProps {
  userRole: UserRole;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (column: string) => void;
}

// ─── RBAC HELPERS ────────────────────────────────────────────

/** Чи може роль бачити колонку "Залишок / Фінанси" */
function canSeeFinanceDetails(role: UserRole): boolean {
  return ['admin', 'director', 'manager', 'accountant'].includes(role);
}

/** Чи може роль бачити менеджера бронювання */
function canSeeManager(role: UserRole): boolean {
  return ['admin', 'director', 'manager', 'ops_manager', 'accountant'].includes(role);
}

/** Чи може роль бачити агента / комісію */
function canSeeAgent(role: UserRole): boolean {
  return ['admin', 'director', 'manager', 'accountant'].includes(role);
}

/** Чи може роль редагувати бронювання */
function canEdit(role: UserRole, booking: Booking): boolean {
  if (['admin', 'manager'].includes(role)) return true;
  if (role === 'agent' && ['new', 'in_work', 'pre_booked'].includes(booking.status)) return true;
  return false;
}

// ─── HELPERS ─────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return amount.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
}

const BOOKING_TYPE_ICON: Record<string, React.FC<{ size?: number }>> = {
  direct:    User,
  agent:     UserCheck,
  corporate: Building2,
  group:     Users,
};

// ─── TABLE HEADER ─────────────────────────────────────────────

export const BookingTableHeader: React.FC<BookingTableHeaderProps> = ({
  userRole, sortBy, sortDir, onSort,
}) => {
  const SortButton: React.FC<{ col: string; label: string }> = ({ col, label }) => (
    <button
      onClick={() => onSort?.(col)}
      className="flex items-center gap-1 text-left font-medium text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
    >
      {label}
      {sortBy === col && (
        sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
      )}
    </button>
  );

  return (
    <thead>
      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <th className="px-3 py-2.5 text-left w-8">
          <input type="checkbox" className="rounded border-slate-300" />
        </th>
        <th className="px-3 py-2.5 text-left min-w-[130px]">
          <SortButton col="booking_number" label="№ Бронювання" />
        </th>
        <th className="px-3 py-2.5 text-left min-w-[150px]">
          <SortButton col="contact_name" label="Турист" />
        </th>
        <th className="px-3 py-2.5 text-left min-w-[160px]">
          <SortButton col="tour_date" label="Тур / Дата" />
        </th>
        <th className="px-3 py-2.5 text-left w-[90px]">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Тип</span>
        </th>
        <th className="px-3 py-2.5 text-right w-[100px]">
          <SortButton col="total_price" label="Сума" />
        </th>
        {canSeeFinanceDetails(userRole) && (
          <th className="px-3 py-2.5 text-right w-[110px]">
            <SortButton col="balance_due" label="Залишок" />
          </th>
        )}
        {canSeeAgent(userRole) && (
          <th className="px-3 py-2.5 text-left min-w-[120px]">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Агент</span>
          </th>
        )}
        {canSeeManager(userRole) && (
          <th className="px-3 py-2.5 text-left w-[100px]">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Менеджер</span>
          </th>
        )}
        <th className="px-3 py-2.5 text-left min-w-[160px]">
          <SortButton col="status" label="Статус" />
        </th>
        <th className="px-3 py-2.5 w-[40px]" />
      </tr>
    </thead>
  );
};

// ─── BOOKING ROW ─────────────────────────────────────────────

export const BookingRow: React.FC<BookingRowProps> = ({
  booking,
  userRole,
  isSelected = false,
  onSelect,
  onView,
  onEdit,
  onPayment,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const TypeIcon = BOOKING_TYPE_ICON[booking.booking_type] ?? User;
  const isOverdue = booking.payment_status === 'overdue';
  const hasBalance = booking.balance_due > 0;

  return (
    <>
      {/* ── MAIN ROW ── */}
      <tr
        className={`
          border-b border-slate-100 dark:border-slate-800
          hover:bg-slate-50 dark:hover:bg-slate-800/50
          transition-colors duration-100 cursor-pointer
          ${isSelected ? 'bg-blue-50 dark:bg-blue-950/30' : ''}
          ${isOverdue ? 'bg-red-50/50 dark:bg-red-950/20' : ''}
          ${className}
        `}
        onClick={() => onView?.(booking.id)}
      >
        {/* Checkbox */}
        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect?.(booking.id)}
            className="rounded border-slate-300"
          />
        </td>

        {/* Booking number */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-1">
            <code className="text-xs font-mono text-blue-600 dark:text-blue-400 font-medium">
              {booking.booking_number}
            </code>
            {isExpanded
              ? <ChevronUp size={13} className="text-slate-400" />
              : <ChevronDown size={13} className="text-slate-300" />
            }
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {formatDate(booking.created_at)}
          </div>
        </td>

        {/* Tourist */}
        <td className="px-3 py-3">
          <span className="font-medium text-sm text-slate-800 dark:text-slate-200">
            {booking.contact_name}
          </span>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {booking.pax_count} {booking.pax_count === 1 ? 'особа' : 'осіб'}
          </div>
        </td>

        {/* Tour + date */}
        <td className="px-3 py-3">
          <div className="text-sm text-slate-800 dark:text-slate-200 line-clamp-1">
            {booking.tour_name}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {booking.tour_date}
          </div>
        </td>

        {/* Type */}
        <td className="px-3 py-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
            <TypeIcon size={11} />
            {BOOKING_TYPE_LABELS[booking.booking_type]}
          </span>
        </td>

        {/* Total price */}
        <td className="px-3 py-3 text-right">
          <span className="font-medium text-sm text-slate-900 dark:text-slate-100">
            {formatCurrency(booking.total_price)}
          </span>
          <div className="text-[11px] text-slate-400">EUR</div>
        </td>

        {/* Balance (RBAC) */}
        {canSeeFinanceDetails(userRole) && (
          <td className="px-3 py-3 text-right">
            {hasBalance ? (
              <>
                <span className={`font-medium text-sm ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {formatCurrency(booking.balance_due)}
                </span>
                <div className="text-[11px] text-slate-400">EUR</div>
              </>
            ) : (
              <span className="text-sm text-emerald-600 dark:text-emerald-500 font-medium">—</span>
            )}
          </td>
        )}

        {/* Agent (RBAC) */}
        {canSeeAgent(userRole) && (
          <td className="px-3 py-3">
            {booking.agent_name ? (
              <div>
                <div className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                  {booking.agent_name}
                </div>
                {booking.agent_commission_rate && (
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                    {(booking.agent_commission_rate * 100).toFixed(0)}% комісія
                  </div>
                )}
              </div>
            ) : (
              <span className="text-sm text-slate-300 dark:text-slate-600">—</span>
            )}
          </td>
        )}

        {/* Manager (RBAC) */}
        {canSeeManager(userRole) && (
          <td className="px-3 py-3">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {booking.manager_name}
            </span>
          </td>
        )}

        {/* Status */}
        <td className="px-3 py-3">
          <StatusBadge status={booking.status} domain="booking" size="sm" />
        </td>

        {/* Actions menu */}
        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <MoreHorizontal size={15} />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 py-1">
                <button
                  onClick={() => { onView?.(booking.id); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <Eye size={14} /> Переглянути
                </button>
                {canEdit(userRole, booking) && (
                  <button
                    onClick={() => { onEdit?.(booking.id); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <Edit2 size={14} /> Редагувати
                  </button>
                )}
                {canSeeFinanceDetails(userRole) && booking.balance_due > 0 && (
                  <button
                    onClick={() => { onPayment?.(booking.id); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <CreditCard size={14} /> Внести оплату
                  </button>
                )}
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <FileText size={14} /> Документи
                </button>
                <button
                  onClick={() => { setIsExpanded(!isExpanded); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <MessageSquare size={14} /> Коментарі
                </button>
              </div>
            )}
          </div>
        </td>
      </tr>

      {/* ── EXPANDED DETAILS ROW ── */}
      {isExpanded && (
        <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
          <td colSpan={10} className="px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-400 mb-1">Передоплата</p>
                <p className="font-medium">{formatCurrency(booking.prepayment_amount)} EUR</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Сплачено</p>
                <p className="font-medium text-emerald-600">{formatCurrency(booking.amount_paid)} EUR</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Дедлайн оплати</p>
                <p className="font-medium">{booking.payment_deadline}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Статус оплати</p>
                <StatusBadge status={booking.payment_status} domain="payment" size="xs" />
              </div>
              {booking.agent_commission_amount && canSeeAgent(userRole) && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Комісія агента</p>
                  <p className="font-medium text-emerald-600">
                    {formatCurrency(booking.agent_commission_amount)} EUR
                  </p>
                </div>
              )}
              {booking.commission_status && canSeeAgent(userRole) && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Статус комісії</p>
                  <StatusBadge status={booking.commission_status} domain="commission" size="xs" />
                </div>
              )}
              {booking.notes && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-400 mb-1">Примітки</p>
                  <p className="text-slate-600 dark:text-slate-400">{booking.notes}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default BookingRow;
