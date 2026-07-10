// ============================================================
// EUROTRIPS — pages/Dashboard.tsx
// Маршрут: /dashboard   Ролі: admin, director, manager, ops, accountant
//
// Секції (за макетом Eurotrips Prototype.dc.html):
//   1. KPI-картки: бронювання/підтверджено/дохід/зібрано (useFinanceSummary)
//   2. Найближчі виїзди (useOpsDashboard → upcoming_tours)
//   3. Готовність турів (useOpsDashboard → checklist_progress) —
//      замінює прототипну "Задачі на сьогодні": сутності Task/Todo
//      у бекенді немає, тому використано реальні дані готовності
//   4. Ліди по статусах (useLeadsByStatus — клієнтська агрегація,
//      обмежена перших 100 лідів по системі)
//   5. Дедлайни готелів (useOpsDashboard → hotel_deadlines)
// ============================================================

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users2, AlertOctagon } from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { useFinanceSummary } from '../hooks/useFinance';
import { useOpsDashboard } from '../hooks/useOpsDashboard';
import { useLeadsByStatus } from '../hooks/useDashboard';
import { StatusDot } from '../components/ui/StatusBadge';
import { DeadlineIndicator } from '../components/ui/DeadlineIndicator';
import { occupancyColor } from '../components/ui/OccupancyBar';
import { LEAD_STATUS_CONFIG } from '../constants/statuses';
import type { LeadStatus } from '../types';

// ─── KPI CARD ─────────────────────────────────────────────────

const KpiCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4">
    <p className="text-xs text-slate-400 mb-2">{label}</p>
    <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-slate-50">{value}</p>
  </div>
);

// ─── SECTION HEADER ───────────────────────────────────────────

const SectionHeading: React.FC<{ children: React.ReactNode; to?: string }> = ({ children, to }) => (
  <div className="flex items-center justify-between mb-3">
    <h2 className="font-heading text-sm font-semibold text-slate-800 dark:text-slate-200">{children}</h2>
    {to && (
      <Link to={to} className="text-xs text-brand-cyan hover:text-brand-cyan-dark transition-colors">
        Всі →
      </Link>
    )}
  </div>
);

// ─── MAIN PAGE ────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: summary, isLoading: summaryLoading } = useFinanceSummary();
  const { data: ops, isLoading: opsLoading, isError: opsError } = useOpsDashboard();
  const { data: leadsByStatus, isLoading: leadsLoading } = useLeadsByStatus();

  const fmtEur = (n: number) => `€ ${n.toLocaleString('uk-UA', { minimumFractionDigits: 0 })}`;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Заголовок ─────────────────────────────────────────── */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900 dark:text-slate-50">Дашборд</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Вітаємо, {user?.first_name ?? 'Користувач'} · {' '}
          {new Date().toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* ── KPI ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Всього бронювань"     value={summaryLoading ? '…' : summary?.total_bookings ?? '—'} />
        <KpiCard label="Підтверджено"          value={summaryLoading ? '…' : summary?.confirmed_bookings ?? '—'} />
        <KpiCard label="Загальний дохід"       value={summaryLoading || !summary ? '…' : fmtEur(summary.total_revenue)} />
        <KpiCard
          label="Дебіторська заборгованість"
          value={summaryLoading || !summary ? '…' : fmtEur(summary.total_revenue - summary.collected_revenue)}
        />
      </div>

      {/* ── Основний грід ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ЛІВО */}
        <div className="flex flex-col gap-6">

          {/* Найближчі виїзди */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <SectionHeading to="/tours">Найближчі виїзди</SectionHeading>
            {opsLoading ? (
              <p className="text-xs text-slate-400 py-4 text-center">Завантаження…</p>
            ) : opsError || !ops || ops.upcoming_tours.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Немає виїздів у найближчі 7 днів</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {ops.upcoming_tours.map((t) => (
                  <div
                    key={t.tour_id}
                    onClick={() => navigate(`/tours/${t.tour_id}`)}
                    className="flex items-center justify-between gap-3 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{t.name}</p>
                      <p className="text-xs text-slate-400 font-mono">
                        {t.code} · {new Date(t.departure_date).toLocaleDateString('uk-UA')}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500 flex-shrink-0">
                      {t.total_seats - t.available_seats}/{t.total_seats}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Готовність турів (заміна прототипної "Задачі на сьогодні" — Task/Todo в БД немає) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <SectionHeading to="/operations">Готовність турів</SectionHeading>
            {opsLoading ? (
              <p className="text-xs text-slate-400 py-4 text-center">Завантаження…</p>
            ) : opsError || !ops || ops.checklist_progress.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Немає турів у підготовці</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {ops.checklist_progress.map((c) => (
                  <div
                    key={c.tour_id}
                    onClick={() => navigate(`/tours/${c.tour_id}`)}
                    className="flex items-center gap-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <span className="font-mono text-xs text-slate-400 w-24 shrink-0 truncate">{c.code}</span>
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${occupancyColor(c.readiness_percent)}`} style={{ width: `${c.readiness_percent}%` }} />
                    </div>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 w-9 text-right shrink-0">{c.readiness_percent}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ПРАВО */}
        <div className="flex flex-col gap-6">

          {/* Ліди по статусах */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <SectionHeading to="/leads">Ліди по статусах</SectionHeading>
            {leadsLoading || !leadsByStatus ? (
              <p className="text-xs text-slate-400 py-4 text-center">Завантаження…</p>
            ) : (
              <div className="space-y-1.5">
                {(Object.keys(LEAD_STATUS_CONFIG) as LeadStatus[]).map((status) => (
                  <div key={status} className="flex items-center gap-2.5 py-1">
                    <StatusDot status={status} domain="lead" size="sm" />
                    <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">
                      {LEAD_STATUS_CONFIG[status].label}
                    </span>
                    <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {leadsByStatus[status]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Дедлайни готелів */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <SectionHeading>
              <span className="flex items-center gap-1.5"><AlertOctagon size={13} className="text-brand-red" /> Дедлайни готелів</span>
            </SectionHeading>
            {opsLoading ? (
              <p className="text-xs text-slate-400 py-4 text-center">Завантаження…</p>
            ) : opsError || !ops || ops.hotel_deadlines.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Немає близьких дедлайнів</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {ops.hotel_deadlines.map((hd) => (
                  <div
                    key={hd.hotel_booking_id}
                    onClick={() => navigate(`/tours/${hd.tour_id}`)}
                    className="flex items-center justify-between gap-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                      <span className="font-mono text-xs text-slate-400">{hd.tour_code}</span> · {hd.hotel_name}
                    </span>
                    <DeadlineIndicator date={hd.option_deadline} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Нові підтверджені туристи сьогодні */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <SectionHeading>
              <span className="flex items-center gap-1.5"><Users2 size={13} /> Нові туристи сьогодні</span>
            </SectionHeading>
            {opsLoading ? (
              <p className="text-xs text-slate-400 py-4 text-center">Завантаження…</p>
            ) : opsError || !ops || ops.new_tourists.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Сьогодні ще немає нових підтверджених бронювань</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {ops.new_tourists.map((n) => (
                  <div key={n.booking_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="text-slate-700 dark:text-slate-300 truncate">
                      {n.contact_name} <span className="text-slate-400">({n.persons_count} ос.)</span>
                    </span>
                    <span className="text-xs text-slate-400 font-mono flex-shrink-0">{n.tour_code} · {n.booking_number}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
