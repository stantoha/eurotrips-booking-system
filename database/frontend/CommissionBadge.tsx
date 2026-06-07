// ============================================================
// EUROTRIPS — CommissionBadge Component
// Комісія звичайного агента + мережевого агента (+ роялті)
// Джерело: Фінансова модель (§2), ADR-001 (§3.4), BR-02–BR-04, BR-07
// RBAC: агент НЕ бачить комісії інших, не бачить маржу (BR-04)
// ============================================================

import React, { useState } from 'react';
import {
  Network, User, Banknote, TrendingUp, Clock, CheckCircle2,
  XCircle, Snowflake, Info, ChevronDown, ChevronUp, Shield
} from 'lucide-react';
import { CommissionInfo, AgentType, UserRole } from '../../types';
import { StatusBadge } from './StatusBadge';
import { COMMISSION_STATUS_CONFIG, AGENT_TYPE_CONFIG } from '../../constants/statuses';

// ─── TYPES ───────────────────────────────────────────────────

export interface CommissionBadgeProps {
  commission: CommissionInfo;
  /** Роль визначає доступні деталі (BR-04) */
  userRole?: UserRole;
  /** Показувати розгорнуту деталізацію */
  defaultExpanded?: boolean;
  /** Мінімальний варіант (тільки суми) */
  compact?: boolean;
  className?: string;
}

// ─── RBAC ────────────────────────────────────────────────────

function canSeeAllCommissions(role?: UserRole): boolean {
  return ['admin', 'director', 'accountant'].includes(role ?? '');
}

// ─── HELPERS ─────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`;
}

// ─── STATUS ICON ─────────────────────────────────────────────

const CommissionStatusIcon: React.FC<{ status: string }> = ({ status }) => {
  const icons: Record<string, React.ReactNode> = {
    pending:   <Clock size={13} className="text-amber-500" />,
    frozen:    <Snowflake size={13} className="text-slate-400" />,
    to_pay:    <TrendingUp size={13} className="text-emerald-500" />,
    paid:      <CheckCircle2 size={13} className="text-emerald-500" />,
    cancelled: <XCircle size={13} className="text-red-400" />,
  };
  return <>{icons[status] ?? null}</>;
};

// ─── COMMISSION LINE ─────────────────────────────────────────

const CommissionLine: React.FC<{
  label: string;
  description: string;
  rate: number;
  amount: number;
  highlighted?: boolean;
  variant?: 'default' | 'royalty' | 'total';
}> = ({ label, description, rate, amount, highlighted, variant = 'default' }) => {
  const bgClass = variant === 'royalty'
    ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800'
    : variant === 'total'
    ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800'
    : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700';

  const textClass = variant === 'royalty'
    ? 'text-blue-700 dark:text-blue-300'
    : variant === 'total'
    ? 'text-emerald-700 dark:text-emerald-300'
    : 'text-slate-700 dark:text-slate-300';

  const amountClass = variant === 'royalty'
    ? 'text-blue-800 dark:text-blue-200'
    : variant === 'total'
    ? 'text-emerald-800 dark:text-emerald-200 text-base'
    : 'text-slate-900 dark:text-slate-100';

  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${bgClass}`}>
      <div>
        <p className={`text-xs font-medium ${textClass}`}>{label}</p>
        <p className={`text-[11px] ${variant !== 'default' ? textClass : 'text-slate-500 dark:text-slate-400'}`}>
          {description}
        </p>
      </div>
      <div className="text-right">
        <p className={`font-semibold ${amountClass}`}>{formatCurrency(amount)}</p>
        <p className={`text-[11px] ${variant !== 'default' ? textClass : 'text-slate-400'}`}>
          {formatRate(rate)}
        </p>
      </div>
    </div>
  );
};

// ─── COMPACT VARIANT ─────────────────────────────────────────

const CommissionBadgeCompact: React.FC<CommissionBadgeProps> = ({ commission, userRole }) => {
  const isNetwork = commission.agent_type === 'network';
  const total = isNetwork && commission.royalty_amount
    ? commission.commission_amount + commission.royalty_amount
    : commission.commission_amount;

  return (
    <div className="inline-flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5">
      {isNetwork ? <Network size={14} className="text-blue-500 shrink-0" /> : <User size={14} className="text-slate-400 shrink-0" />}
      <div>
        <p className="text-xs text-slate-500">{commission.agency_name}</p>
        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(total)}
        </p>
      </div>
      <StatusBadge status={commission.commission_status} domain="commission" size="xs" />
    </div>
  );
};

// ─── FULL VARIANT ────────────────────────────────────────────

export const CommissionBadge: React.FC<CommissionBadgeProps> = ({
  commission,
  userRole,
  defaultExpanded = false,
  compact = false,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (compact) return <CommissionBadgeCompact commission={commission} userRole={userRole} />;

  const isNetwork = commission.agent_type === 'network';
  const hasRoyalty = isNetwork && commission.royalty_rate !== undefined && commission.royalty_amount !== undefined;
  const totalAmount = hasRoyalty
    ? commission.commission_amount + (commission.royalty_amount ?? 0)
    : commission.commission_amount;

  const agentTypeConfig = AGENT_TYPE_CONFIG[commission.agent_type];
  const AgentIcon = isNetwork ? Network : User;

  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden ${className}`}>
      {/* ── HEADER ── */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`
              w-9 h-9 rounded-lg flex items-center justify-center shrink-0
              ${isNetwork
                ? 'bg-blue-50 dark:bg-blue-950 text-blue-500'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }
            `}>
              <AgentIcon size={17} />
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100 text-[14px]">
                {commission.agency_name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`
                  inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded
                  ${isNetwork
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }
                `}>
                  <AgentIcon size={10} />
                  {agentTypeConfig.label}
                </span>
                {isNetwork && commission.network_name && (
                  <span className="text-[11px] text-slate-400">· {commission.network_name}</span>
                )}
              </div>
            </div>
          </div>
          <StatusBadge status={commission.commission_status} domain="commission" size="sm" />
        </div>
      </div>

      {/* ── BOOKING REFERENCE ── */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <code className="font-mono text-blue-600 dark:text-blue-400">{commission.booking_id}</code>
            <span>·</span>
            <span className="truncate max-w-[140px]">{commission.tour_name}</span>
          </div>
          <span className="text-slate-500 font-medium">
            База: {commission.total_price.toLocaleString()} EUR
          </span>
        </div>
      </div>

      {/* ── COMMISSION BREAKDOWN ── */}
      <div className="px-4 py-3 space-y-2">
        {/* Агентська комісія */}
        <CommissionLine
          label="Комісія агента"
          description={`${formatRate(commission.commission_rate)} від суми туру · BR-02`}
          rate={commission.commission_rate}
          amount={commission.commission_amount}
          variant="default"
        />

        {/* Роялті мережевого агента (BR-07) */}
        {hasRoyalty && (
          <CommissionLine
            label="Роялті мережі"
            description={`${formatRate(commission.royalty_rate!)} від субагентів · BR-07`}
            rate={commission.royalty_rate!}
            amount={commission.royalty_amount!}
            variant="royalty"
          />
        )}

        {/* Підсумок для мережевих агентів */}
        {hasRoyalty && (
          <CommissionLine
            label="Загалом до виплати"
            description="після підтвердження туру"
            rate={commission.commission_rate + (commission.royalty_rate ?? 0)}
            amount={totalAmount}
            variant="total"
          />
        )}
      </div>

      {/* ── RULES NOTE (collapsible) ── */}
      <div className="px-4 pb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <Info size={12} />
          Умови виплати
          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {isExpanded && (
          <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Shield size={11} className="text-slate-400 shrink-0 mt-0.5" />
              <p><span className="font-medium">BR-02:</span> Комісія нараховується тільки з ціни туру. ДОПи — не включаються.</p>
            </div>
            <div className="flex items-start gap-2">
              <Shield size={11} className="text-slate-400 shrink-0 mt-0.5" />
              <p><span className="font-medium">BR-03:</span> Виплата після переходу туру в статус "Завершено".</p>
            </div>
            {hasRoyalty && (
              <div className="flex items-start gap-2">
                <Shield size={11} className="text-slate-400 shrink-0 mt-0.5" />
                <p><span className="font-medium">BR-07:</span> Роялті нараховується після виплати комісій субагентам мережі.</p>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Shield size={11} className="text-slate-400 shrink-0 mt-0.5" />
              <p><span className="font-medium">BR-04:</span> Собівартість та маржа приховані від агента.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── ACTIONS (для admin/accountant) ── */}
      {canSeeAllCommissions(userRole) && commission.commission_status === 'to_pay' && (
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
          <button className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
            <Banknote size={15} />
            Позначити як виплачено · {formatCurrency(totalAmount)}
          </button>
        </div>
      )}
    </div>
  );
};

// ─── COMMISSION SUMMARY CARD ─────────────────────────────────

export interface CommissionSummaryProps {
  agentName: string;
  agentType: AgentType;
  period: string;
  bookingsCount: number;
  totalRevenue: number;
  commissionTotal: number;
  royaltyTotal?: number;
  commissionPaid: number;
  commissionPending: number;
}

export const CommissionSummary: React.FC<CommissionSummaryProps> = ({
  agentName, agentType, period, bookingsCount,
  totalRevenue, commissionTotal, royaltyTotal,
  commissionPaid, commissionPending,
}) => {
  const isNetwork = agentType === 'network';
  const grandTotal = commissionTotal + (royaltyTotal ?? 0);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-100">{agentName}</p>
          <p className="text-xs text-slate-400">{AGENT_TYPE_CONFIG[agentType].label} · {period}</p>
        </div>
        <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
          {bookingsCount} бронювань
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
          <p className="text-[11px] text-slate-400">Продажі</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{totalRevenue.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400">EUR</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-2">
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{isNetwork ? 'Ком. + роялті' : 'Комісія'}</p>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{grandTotal.toFixed(0)}</p>
          <p className="text-[10px] text-emerald-500">EUR</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2">
          <p className="text-[11px] text-amber-600 dark:text-amber-400">Нараховано</p>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{commissionPending.toFixed(0)}</p>
          <p className="text-[10px] text-amber-500">EUR</p>
        </div>
      </div>
    </div>
  );
};

export default CommissionBadge;
