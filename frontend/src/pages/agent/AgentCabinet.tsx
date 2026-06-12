// ============================================================
// EUROTRIPS — pages/agent/AgentCabinet.tsx
// Маршрут: /agent/*   Роль: agent тільки (ProtectedRoute)
//
// Секції:
//   1. Мої бронювання         — останні 5, з розгортанням
//   2. Комісія поточного місяця — CommissionBadge + PaymentBlock
//   3. Нові тури              — 3-5 TourCard (без cost_price BR-04)
//
// Мережевий агент (isNetworkAgent = true):
//   + Блок "Мережа та роялті" — network_name, royalty_rate, royalty_amount
//
// Бізнес-правила:
//   BR-02: commission_amount обчислено тільки від base_price (без ДОПів)
//   BR-03: commission виплачується тільки після tour status = completed
//   BR-04: cost_price та margin НІКОЛИ не показуються агенту
//   BR-07: royalty_amount нараховується після виплати комісій субагентів
//
// TODO: замінити моки на TanStack Query хуки:
//   useBookings({ agentId: user.id, limit: 5 })
//   useCommission({ agentId: user.id, period: currentPeriod })
//   useTours({ status: ['open','active','almost_full'], limit: 5 })
// ============================================================

import React, { useMemo } from 'react';
import {
  Plus, ArrowRight, Network, User, TrendingUp,
  Shield, Banknote, CheckCircle2, Clock,
} from 'lucide-react';

import { TourCard }        from '../../components/tours/TourCard';
import { CommissionBadge } from '../../components/ui/CommissionBadge';
import { PaymentBlock }    from '../../components/ui/PaymentBlock';
import { StatusBadge }     from '../../components/ui/StatusBadge';
import { useAuth }         from '../../hooks/useAuth';
import {
  MOCK_BOOKINGS,
  MOCK_TOURS,
  MOCK_COMMISSIONS,
  MOCK_PAYMENTS,
} from '../../mocks';
import type { Booking, Tour, CommissionInfo, PaymentInfo } from '../../types';

// ─── HELPERS ──────────────────────────────────────────────────

const fmtEur = (n: number) =>
  n.toLocaleString('uk-UA', { minimumFractionDigits: 0 });

// ─── SUB-COMPONENTS ───────────────────────────────────────────

/** Stat box — метрична картка */
const StatBox: React.FC<{
  label:      string;
  value:      string | number;
  sub?:       string;
  colorClass?: string;
}> = ({ label, value, sub, colorClass = 'text-slate-900 dark:text-slate-100' }) => (
  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-3">
    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
    <p className={`text-base font-medium leading-tight ${colorClass}`}>{value}</p>
    {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
  </div>
);

/** Section header */
const SectionHead: React.FC<{
  title: string;
  icon?: React.ReactNode;
  badge?: string;
  onAll?: () => void;
}> = ({ title, icon, badge, onAll }) => (
  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700">
    <div className="flex items-center gap-2">
      {icon && <span className="text-slate-400">{icon}</span>}
      <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</h2>
      {badge && (
        <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-slate-200 dark:bg-slate-700 text-slate-500">
          {badge}
        </span>
      )}
    </div>
    {onAll && (
      <button
        onClick={onAll}
        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
      >
        Всі <ArrowRight size={11} aria-hidden="true" />
      </button>
    )}
  </div>
);

/** Компактний рядок бронювання у кабінеті агента */
const AgentBookingRow: React.FC<{ booking: Booking }> = ({ booking: b }) => (
  <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-0.5">
        <code className="text-xs font-mono text-blue-600 dark:text-blue-400">{b.booking_number}</code>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
        {b.tour_name} · {b.pax_count} ос. · {b.tour_date}
      </p>
    </div>
    <div className="text-right flex-shrink-0">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
        {fmtEur(b.total_price)} EUR
      </p>
      {b.balance_due > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          залишок {fmtEur(b.balance_due)}
        </p>
      )}
    </div>
    <StatusBadge status={b.status} domain="booking" size="xs" />
  </div>
);

/** Мінімальна картка туру в кабінеті — без cost_price (BR-04) */
const AgentTourCard: React.FC<{
  tour:   Tour;
  onBook: (id: string) => void;
}> = ({ tour: t, onBook }) => {
  const occ = t.total_seats > 0
    ? Math.round(((t.total_seats - t.available_seats) / t.total_seats) * 100)
    : 100;
  const barCls = occ >= 95 ? 'bg-red-500' : occ >= 80 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <StatusBadge status={t.status} domain="tour" size="xs" />
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1.5 leading-snug">{t.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t.departure_date} · {t.duration_days}д · {t.direction}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          {/* BR-04: ніколи не показуємо cost_price */}
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {fmtEur(t.base_price)} EUR
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {(t.agent_commission_pct * 100).toFixed(0)}% ком.
          </p>
        </div>
      </div>

      {/* Місця + прогрес */}
      <div className="mt-2.5">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>
            {t.available_seats === 0
              ? <span className="text-red-500 font-medium">Немає місць</span>
              : `${t.available_seats} з ${t.total_seats} місць`
            }
          </span>
          <span>{occ}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barCls}`} style={{ width: `${occ}%` }} />
        </div>
        {t.available_seats > 0 && t.available_seats <= 3 && (
          <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
            ⚡ Залишилось {t.available_seats} {t.available_seats === 1 ? 'місце' : 'місця'}
          </p>
        )}
      </div>

      <button
        onClick={() => onBook(t.id)}
        disabled={t.available_seats === 0}
        className="mt-3 w-full py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {t.available_seats === 0 ? 'Заповнений' : 'Забронювати'}
      </button>
    </div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────

const AgentCabinet: React.FC = () => {
  const { user, isNetworkAgent } = useAuth();

  // ── My bookings: 5 останніх, відфільтровано по agent_id ───
  // TODO: замінити на useBookings({ agentId: user!.id, limit: 5, sort: '-created_at' })
  const myBookings = useMemo<Booking[]>(
    () =>
      MOCK_BOOKINGS.filter(
        (b) => b.agent_id !== undefined, // коли є реальний userId: b.agent_id === user?.id
      ).slice(0, 5),
    [],
  );

  // ── Commission info для поточного агента ──────────────────
  // TODO: замінити на useCommission({ agentId: user!.id })
  const commission = useMemo<CommissionInfo>(
    () =>
      (isNetworkAgent
        ? MOCK_COMMISSIONS.find((c) => c.agent_type === 'network')
        : MOCK_COMMISSIONS.find((c) => c.agent_type === 'standard'))
      ?? MOCK_COMMISSIONS[0],
    [isNetworkAgent],
  );

  // ── PaymentInfo (для PaymentBlock з відображенням прогресу) ─
  const payment = useMemo<PaymentInfo>(
    () => ({
      label:           commission.agency_name,
      total_price:     commission.total_price,
      amount_paid:     commission.commission_amount,  // виплачено
      deposit_amount:  0,
      balance_due:     commission.commission_amount,  // до виплати
      payment_deadline: undefined,
      payment_status:  commission.commission_status === 'paid' ? 'fully_paid' : 'partially_paid',
      currency:        'EUR',
      commission_amount: commission.commission_amount,
      commission_status: commission.commission_status,
    }),
    [commission],
  );

  // ── Available tours ─────────────────────────────────────────
  // TODO: замінити на useTours({ status: ['open','active','almost_full'], limit: 5 })
  const availTours = useMemo<Tour[]>(
    () =>
      MOCK_TOURS.filter((t) =>
        ['open', 'active', 'almost_full'].includes(t.status),
      ).slice(0, 5),
    [],
  );

  // ── Stats ────────────────────────────────────────────────────
  const totalSales = myBookings.reduce((s, b) => s + b.total_price, 0);
  const totalDebt  = myBookings.reduce((s, b) => s + b.balance_due, 0);

  const handleBook = (id: string) => {
    // TODO: navigate(`/bookings/new?tour=${id}`)
    console.log('[AgentCabinet] Book tour:', id);
  };

  return (
    <div className="p-6 max-w-screen-xl mx-auto">

      {/* ── WELCOME HEADER ── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className={`
            w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
            border
            ${isNetworkAgent
              ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
            }
          `}>
            {isNetworkAgent
              ? <Network size={19} className="text-blue-500" aria-hidden="true" />
              : <User     size={19} className="text-slate-500" aria-hidden="true" />
            }
          </div>

          <div>
            <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100">
              {commission.agency_name}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-slate-400">{commission.agent_name}</span>
              <span className="text-xs text-slate-300 dark:text-slate-600">·</span>
              <span className={`
                inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border
                ${isNetworkAgent
                  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                }
              `}>
                {isNetworkAgent ? <Network size={9} aria-hidden="true" /> : <User size={9} aria-hidden="true" />}
                {isNetworkAgent ? 'Мережевий агент' : 'Стандартний агент'}
              </span>
              {isNetworkAgent && commission.network_name && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                  <Network size={9} aria-hidden="true" />
                  {commission.network_name}
                </span>
              )}
            </div>
          </div>
        </div>

        <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 transition-colors flex-shrink-0">
          <Plus size={14} aria-hidden="true" /> Нове бронювання
        </button>
      </div>

      {/* ── STATS ROW ── */}
      <div className={`grid gap-3 mb-6 ${isNetworkAgent ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}>
        <StatBox label="Бронювань"    value={myBookings.length}                             sub="всього по акаунту" />
        <StatBox label="Продажі"      value={`${fmtEur(totalSales)} EUR`}                   sub="загальний оборот" />
        <StatBox
          label="Комісія"
          value={`${fmtEur(commission.commission_amount)} EUR`}
          sub={`${(commission.commission_rate * 100).toFixed(0)}% від суми`}
          colorClass="text-emerald-600 dark:text-emerald-400"
        />
        <StatBox
          label="Борг клієнтів"
          value={totalDebt > 0 ? `${fmtEur(totalDebt)} EUR` : '—'}
          sub="залишок до оплати"
          colorClass={totalDebt > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
        />
        {/* BR-07: тільки для мережевого агента */}
        {isNetworkAgent && commission.royalty_amount !== undefined && (
          <StatBox
            label="Роялті мережі"
            value={`${fmtEur(commission.royalty_amount)} EUR`}
            sub={`${((commission.royalty_rate ?? 0) * 100).toFixed(0)}% від субагентів`}
            colorClass="text-blue-600 dark:text-blue-400"
          />
        )}
      </div>

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT (2/3): Bookings + Commission + [Network] ── */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Секція 1: Мої бронювання */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <SectionHead
              title="Мої бронювання"
              onAll={() => { /* TODO: navigate('/bookings?agentId=me') */ }}
            />
            {myBookings.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">Бронювань ще немає</p>
            ) : (
              myBookings.map((b) => <AgentBookingRow key={b.id} booking={b} />)
            )}
          </div>

          {/* Секція 2: Комісія поточного місяця */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <SectionHead
              title="Комісія"
              icon={<Banknote size={14} />}
            />
            <div className="p-4 grid sm:grid-cols-2 gap-4">
              {/* CommissionBadge — ставка, сума, статус, BR-02/BR-03 */}
              <CommissionBadge
                commission={commission}
                variant={isNetworkAgent ? 'network' : 'standard'}
              />
              {/* PaymentBlock — прогрес-бар виплат */}
              <PaymentBlock
                payment={payment}
                variant="compact"
              />
            </div>
          </div>

          {/* Секція 3 (тільки network): Мережа та роялті — BR-07 */}
          {isNetworkAgent && (
            <div className="border border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden">
              <SectionHead
                title="Мережа та роялті"
                icon={<Network size={14} className="text-blue-500" />}
                badge="BR-07"
              />
              <div className="p-4">
                {/* Ключові цифри мережі */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <StatBox label="Ставка роялті" value={`${((commission.royalty_rate ?? 0) * 100).toFixed(0)}%`} sub="від продажів субагентів" />
                  <StatBox
                    label="Нараховано роялті"
                    value={`${fmtEur(commission.royalty_amount ?? 0)} EUR`}
                    sub="поточний місяць"
                    colorClass="text-blue-600 dark:text-blue-400"
                  />
                  <StatBox label="База розрахунку" value={`${fmtEur(commission.total_price)} EUR`} sub="продажі субагентів" />
                </div>

                {/* Пояснення правила BR-07 */}
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3.5">
                  <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 mb-2.5">
                    <Shield size={11} aria-hidden="true" />
                    Роялті нараховується після виплати комісій субагентам мережі
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-medium text-blue-700 dark:text-blue-300">
                      {fmtEur(commission.royalty_amount ?? 0)} EUR
                    </span>
                    <StatusBadge status={commission.commission_status} domain="commission" size="xs" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT (1/3): Нові тури ── */}
        <div className="flex flex-col gap-5">
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <SectionHead
              title="Нові тури"
              onAll={() => { /* TODO: navigate('/tours') — але агент не має доступу; показати окрему сторінку */ }}
            />
            {availTours.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Немає доступних турів</p>
            ) : (
              availTours.map((t) => (
                <AgentTourCard key={t.id} tour={t} onBook={handleBook} />
              ))
            )}
          </div>

          {/* Коротка статистика */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-slate-400" aria-hidden="true" />
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Моя статистика</h3>
            </div>
            <dl className="space-y-2 text-sm">
              {[
                ['Активних бронювань',
                  myBookings.filter((b) => !['completed','cancelled_client','cancelled_operator','refund','no_show'].includes(b.status)).length
                ],
                ['Завершено успішно',
                  myBookings.filter((b) => b.status === 'completed').length
                ],
                ['Загальний оборот',  `${fmtEur(totalSales)} EUR`],
                ['Ставка комісії',    `${(commission.commission_rate * 100).toFixed(0)}%`],
              ].map(([k, v]) => (
                <div key={k as string} className="flex items-center justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AgentCabinet;
