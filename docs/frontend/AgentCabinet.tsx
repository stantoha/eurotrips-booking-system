// ============================================================
// EUROTRIPS — pages/agent/AgentCabinet.tsx
// Головна кабінету агента. RBAC: тільки role='agent'.
//
// Три блоки:
//   1. Мої бронювання — список останніх BookingRow
//   2. Комісія поточного місяця — CommissionBadge + PaymentBlock
//   3. Нові тури — 3-5 карток TourCard (без cost_price — BR-04)
//
// Мережевий агент (isNetworkAgent):
//   + Блок роялті: мережа, кількість субагентів, роялті (BR-07)
// ============================================================

import React, { useMemo } from 'react';
import {
  ArrowRight, Network, User, Plus, TrendingUp, Shield,
} from 'lucide-react';

import { BookingRow }      from '../../components/bookings/BookingRow';
import { TourCard }        from '../../components/tours/TourCard';
import { CommissionBadge } from '../../components/ui/CommissionBadge';
import { PaymentBlock }    from '../../components/ui/PaymentBlock';
import { StatusBadge }     from '../../components/ui/StatusBadge';
import { useAuth }         from '../../hooks/useAuth';
import {
  MOCK_BOOKINGS,
  MOCK_TOURS,
  MOCK_COMMISSIONS,
} from '../../mocks';
import type { CommissionInfo, PaymentInfo } from '../../types';

// ─── SUB-COMPONENTS ───────────────────────────────────────────

/** Metric card — simple stat box */
const StatCard: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  colorClass?: string;
}> = ({ label, value, sub, colorClass = '' }) => (
  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-3">
    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
    <p className={`text-base font-medium ${colorClass}`}>{value}</p>
    {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
  </div>
);

/** Section heading with optional "Show all" link */
const SectionHead: React.FC<{ title: string; onShowAll?: () => void }> = ({
  title,
  onShowAll,
}) => (
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</h2>
    {onShowAll && (
      <button
        onClick={onShowAll}
        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
      >
        Всі <ArrowRight size={11} />
      </button>
    )}
  </div>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────

const AgentCabinet: React.FC = () => {
  const { user, isNetworkAgent, canSeeMargin } = useAuth();

  // ── Agent identity ─────────────────────────────────────────
  // TODO: replace with real agent data from TanStack Query
  const agentName    = user?.full_name ?? 'Агент';
  const agentCode    = user?.agent_code ?? '—';
  const networkName  = user?.network_name;          // only for network agents

  // ── My Bookings — last 5 ───────────────────────────────────
  // TODO: replace with useBookings({ agentId: user.id, limit: 5 })
  const myBookings = useMemo(
    () =>
      MOCK_BOOKINGS.filter(
        (b) => b.agent_id === user?.id || b.agent_name?.toLowerCase().includes('мрія'),
      ).slice(0, 5),
    [user?.id],
  );

  // ── Available tours — open/active/almost_full ─────────────
  // TODO: replace with useTours({ status: ['open','active','almost_full'], limit: 4 })
  const availableTours = useMemo(
    () =>
      MOCK_TOURS.filter((t) =>
        ['open', 'active', 'almost_full'].includes(t.status),
      ).slice(0, 4),
    [],
  );

  // ── Commission for current month ───────────────────────────
  // TODO: replace with useCommission({ agentId: user.id, month: currentMonth })
  const commissionInfo: CommissionInfo = useMemo(
    () =>
      MOCK_COMMISSIONS.find((c) => c.agent_id === user?.id) ??
      MOCK_COMMISSIONS[0],
    [user?.id],
  );

  // ── Payment info (for PaymentBlock) ───────────────────────
  const paymentInfo: PaymentInfo = useMemo(
    () => ({
      total_amount:   commissionInfo.total_commission_amount,
      paid_amount:    commissionInfo.paid_commission_amount,
      balance:        commissionInfo.pending_commission_amount,
      deposit_amount: 0,
      currency:       'EUR',
      payments:       [],
    }),
    [commissionInfo],
  );

  // ── Stats summary ──────────────────────────────────────────
  const stats = useMemo(() => {
    const total = myBookings.reduce((s, b) => s + (b.total_amount ?? 0), 0);
    const debt  = myBookings.reduce((s, b) => s + (b.balance ?? 0), 0);
    return { total, debt, count: myBookings.length };
  }, [myBookings]);

  return (
    <div className="p-6 max-w-screen-xl mx-auto">

      {/* ── WELCOME HEADER ── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className={`
            w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border
            ${isNetworkAgent
              ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
            }
          `}>
            {isNetworkAgent
              ? <Network size={18} className="text-blue-500" />
              : <User     size={18} className="text-slate-500" />
            }
          </div>

          <div>
            <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100">
              {agentName}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* Agent code */}
              <code className="text-xs text-slate-400 font-mono">{agentCode}</code>

              {/* Agent type badge */}
              <span className={`
                inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border
                ${isNetworkAgent
                  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                }
              `}>
                {isNetworkAgent ? <Network size={10} /> : <User size={10} />}
                {isNetworkAgent ? 'Мережевий агент' : 'Стандартний агент'}
              </span>

              {/* Network name — for network agents */}
              {isNetworkAgent && networkName && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                  <Network size={9} />
                  {networkName}
                </span>
              )}
            </div>
          </div>
        </div>

        <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 transition-colors flex-shrink-0">
          <Plus size={14} />
          Нове бронювання
        </button>
      </div>

      {/* ── STATS ROW ── */}
      <div className={`
        grid gap-3 mb-6
        ${isNetworkAgent ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}
      `}>
        <StatCard
          label="Бронювань цього місяця"
          value={commissionInfo.bookings_count ?? stats.count}
        />
        <StatCard
          label="Продажі"
          value={`${stats.total.toLocaleString('uk-UA')} EUR`}
          sub="загальна сума"
        />
        <StatCard
          label="Комісія нарахована"
          value={`${commissionInfo.total_commission_amount.toLocaleString('uk-UA')} EUR`}
          sub={`${commissionInfo.commission_rate}% від продажів`}
          colorClass="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label="До виплати"
          value={`${commissionInfo.pending_commission_amount.toLocaleString('uk-UA')} EUR`}
          sub="після завершення турів"
          colorClass="text-amber-600 dark:text-amber-400"
        />
        {/* Network royalty stat — BR-07 */}
        {isNetworkAgent && (
          <StatCard
            label="Роялті мережі"
            value={`${(commissionInfo.royalty_amount ?? 0).toLocaleString('uk-UA')} EUR`}
            sub={`${commissionInfo.royalty_rate ?? 3}% від субагентів`}
            colorClass="text-blue-600 dark:text-blue-400"
          />
        )}
      </div>

      {/* ── MAIN CONTENT GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT COLUMN (2/3): Bookings + Commission + Network ── */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Block 1: My bookings */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <SectionHead
                title="Мої бронювання"
                onShowAll={() => {
                  // TODO: navigate('/bookings?agentId=me')
                }}
              />
            </div>

            {myBookings.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                Бронювань ще немає
              </div>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800">
                    {['№ Бронювання', 'Турист', 'Тур', 'Сума', 'Залишок', 'Статус', ''].map((h, i) => (
                      <th
                        key={i}
                        className={`
                          px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400
                          border-b border-slate-200 dark:border-slate-700
                          ${i >= 3 && i <= 4 ? 'text-right' : 'text-left'}
                        `}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {myBookings.map((booking) => (
                    // BR-04: агент не бачить кнопки менеджерських дій
                    <BookingRow
                      key={booking.id}
                      booking={booking}
                      isExpanded={false}
                      onToggleExpand={() => {}}
                      showActions={false}
                      compact
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Block 2: Commission */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <SectionHead title={`Комісія — ${commissionInfo.period ?? 'поточний місяць'}`} />
            </div>
            <div className="p-4 grid sm:grid-cols-2 gap-4">
              {/* CommissionBadge — shows rate, amount, status, BR-02/BR-03 */}
              <CommissionBadge
                commission={commissionInfo}
                variant={isNetworkAgent ? 'network' : 'standard'}
              />
              {/* PaymentBlock — progress bar, payment steps */}
              <PaymentBlock
                payment={paymentInfo}
                variant="compact"
              />
            </div>
          </div>

          {/* Block 3: Network royalty — ONLY for network agents (BR-07) */}
          {isNetworkAgent && (
            <div className="border border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Network size={14} className="text-blue-500" />
                    <h2 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Мережа та роялті
                    </h2>
                    {/* BR-07 rule reference */}
                    <span className="text-xs text-blue-500 bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded font-mono">
                      BR-07
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4">
                {/* Network stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  <StatCard
                    label="Субагентів у мережі"
                    value={commissionInfo.network_agents_count ?? '—'}
                    sub="активних"
                  />
                  <StatCard
                    label="Продажі мережі"
                    value={`${(commissionInfo.network_total_sales ?? 0).toLocaleString('uk-UA')} EUR`}
                    sub="цього місяця"
                  />
                  <StatCard
                    label="Роялті ставка"
                    value={`${commissionInfo.royalty_rate ?? 3}%`}
                    sub="від продажів субагентів"
                  />
                </div>

                {/* Royalty summary banner */}
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3.5">
                  <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 mb-2">
                    <Shield size={11} />
                    Роялті {commissionInfo.royalty_rate ?? 3}% від продажів субагентів нараховується після виплати їхніх комісій
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-medium text-blue-700 dark:text-blue-300">
                      {(commissionInfo.royalty_amount ?? 0).toLocaleString('uk-UA')} EUR
                    </span>
                    <span className="text-xs text-blue-500">
                      очікує виплати
                    </span>
                  </div>
                  {/* Royalty breakdown by sub-agents */}
                  {commissionInfo.sub_agent_royalties && commissionInfo.sub_agent_royalties.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 space-y-1.5">
                      {commissionInfo.sub_agent_royalties.map((row) => (
                        <div key={row.agent_id} className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400">
                          <span>{row.agent_name}</span>
                          <span className="font-medium">{row.royalty_amount.toLocaleString('uk-UA')} EUR</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN (1/3): Available Tours ── */}
        <div className="flex flex-col gap-4">
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <SectionHead
                title="Доступні тури"
                onShowAll={() => {
                  // TODO: navigate('/tours')
                }}
              />
            </div>

            <div className="p-3 flex flex-col gap-3">
              {availableTours.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  Немає доступних турів
                </p>
              ) : (
                availableTours.map((tour) => (
                  <TourCard
                    key={tour.id}
                    tour={tour}
                    // BR-04: агент не бачить cost_price/margin
                    userRole="agent"
                    variant="list"
                    showBookButton={true}
                    onBook={(id) => {
                      // TODO: navigate(`/bookings/new?tour=${id}`)
                    }}
                  />
                ))
              )}
            </div>
          </div>

          {/* Quick stats card */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-slate-400" />
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Моя статистика
              </h3>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['Активних бронювань',    myBookings.filter((b) => !['completed','cancelled_client','cancelled_operator','refund'].includes(b.status)).length],
                ['Завершених турів',      myBookings.filter((b) => b.status === 'completed').length],
                ['Загальний оборот',      `${stats.total.toLocaleString('uk-UA')} EUR`],
                ['Поточний борг клієнтів', stats.debt > 0 ? `${stats.debt.toLocaleString('uk-UA')} EUR` : '—'],
              ].map(([k, v]) => (
                <div key={k as string} className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{k}</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentCabinet;
