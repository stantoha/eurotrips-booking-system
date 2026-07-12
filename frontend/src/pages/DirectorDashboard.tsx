// ============================================================
// EUROTRIPS — pages/DirectorDashboard.tsx
// Окремий дашборд для ролі director (стратегічний зріз):
//   1. Фінансові KPI (useFinanceSummary)
//   2. Тури з ризиком негативної маржі (useMarginAlerts — BR §15)
//   3. Воронка продажів + конверсія (useSalesFunnel)
//   4. Топ агентів за оборотом (useAgentsTop)
//   5. Дебіторська заборгованість (useFinanceDebts)
// Рендериться замість загального Dashboard, коли роль = director
// (див. Dashboard.tsx).
// ============================================================

import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertTriangle, TrendingDown, Users2, Wallet } from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { useFinanceSummary, useFinanceDebts, useMarginAlerts } from '../hooks/useFinance';
import { useSalesFunnel, useAgentsTop } from '../hooks/useAnalytics';

const fmtEur = (n: number) => `€ ${n.toLocaleString('uk-UA', { minimumFractionDigits: 0 })}`;

const KpiCard: React.FC<{ label: string; value: string | number; accent?: 'red' | 'green' }> = ({ label, value, accent }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4">
    <p className="text-xs text-slate-400 mb-2">{label}</p>
    <p className={`font-mono text-2xl font-semibold ${
      accent === 'red' ? 'text-brand-red' : accent === 'green' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-50'
    }`}>{value}</p>
  </div>
);

const SectionCard: React.FC<{ title: React.ReactNode; to?: string; children: React.ReactNode }> = ({ title, to, children }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-heading text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h2>
      {to && <Link to={to} className="text-xs text-brand-cyan hover:text-brand-cyan-dark transition-colors">Всі →</Link>}
    </div>
    {children}
  </div>
);

const DirectorDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: summary, isLoading: summaryLoading } = useFinanceSummary();
  const { data: marginAlerts, isLoading: marginLoading } = useMarginAlerts(true);
  const { data: funnel, isLoading: funnelLoading } = useSalesFunnel();
  const { data: agentsTop, isLoading: agentsLoading } = useAgentsTop();
  const { data: debts, isLoading: debtsLoading } = useFinanceDebts();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900 dark:text-slate-50">Дашборд директора</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Вітаємо, {user?.first_name ?? 'Директор'} · {' '}
          {new Date().toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* ── Фінансові KPI ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Загальний дохід" value={summaryLoading || !summary ? '…' : fmtEur(summary.total_revenue)} />
        <KpiCard label="Зібрано коштів" value={summaryLoading || !summary ? '…' : fmtEur(summary.collected_revenue)} accent="green" />
        <KpiCard
          label="Дебіторська заборгованість"
          value={summaryLoading || !summary ? '…' : fmtEur(summary.total_revenue - summary.collected_revenue)}
          accent="red"
        />
        <KpiCard label="Підтверджені бронювання" value={summaryLoading ? '…' : summary?.confirmed_bookings ?? '—'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ЛІВО */}
        <div className="flex flex-col gap-6">

          {/* Маржинальні ризики (BR §15 — Budapest+Vienna кейс) */}
          <SectionCard
            title={<span className="flex items-center gap-1.5"><AlertTriangle size={13} className="text-brand-red" /> Тури з ризиком негативної маржі</span>}
            to="/finance"
          >
            {marginLoading ? (
              <p className="text-xs text-slate-400 py-4 text-center">Завантаження…</p>
            ) : !marginAlerts || marginAlerts.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Ризикових турів немає — комісії агентів у межах маржі.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {marginAlerts.map((a) => (
                  <div
                    key={a.tour_id}
                    onClick={() => navigate(`/tours/${a.tour_id}`)}
                    className="flex items-center justify-between gap-3 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800 dark:text-slate-200 truncate">
                        <span className="font-mono text-xs text-slate-400 mr-1">{a.code}</span>{a.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        комісія {(a.agent_commission_pct * 100).toFixed(0)}% · маржа {a.margin_pct}%
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-brand-red shrink-0">ризик</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Воронка продажів */}
          <SectionCard title={<span className="flex items-center gap-1.5"><TrendingDown size={13} /> Воронка продажів</span>} to="/analytics">
            {funnelLoading || !funnel ? (
              <p className="text-xs text-slate-400 py-4 text-center">Завантаження…</p>
            ) : (
              <div className="space-y-2">
                {([
                  { label: 'Ліди', value: funnel.funnel.leads, color: 'bg-brand-cyan' },
                  { label: 'Бронювання', value: funnel.funnel.bookings, color: 'bg-brand-gold', pct: funnel.conversion.lead_to_booking_pct },
                  { label: 'Підтверджені', value: funnel.funnel.confirmed, color: 'bg-emerald-500', pct: funnel.conversion.booking_to_confirmed_pct },
                ]).map((s, i) => {
                  const max = Math.max(1, funnel.funnel.leads, funnel.funnel.bookings, funnel.funnel.confirmed);
                  return (
                    <div key={s.label}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-slate-500 dark:text-slate-400">{s.label}</span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                          {s.value}{i > 0 && s.pct !== undefined && <span className="text-slate-400 font-normal ml-1.5">({s.pct}%)</span>}
                        </span>
                      </div>
                      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden">
                        <div className={`h-full rounded ${s.color}`} style={{ width: `${Math.max(2, (s.value / max) * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ПРАВО */}
        <div className="flex flex-col gap-6">

          {/* Топ агентів */}
          <SectionCard title={<span className="flex items-center gap-1.5"><Users2 size={13} /> Топ агентів за оборотом</span>} to="/analytics">
            {agentsLoading || !agentsTop ? (
              <p className="text-xs text-slate-400 py-4 text-center">Завантаження…</p>
            ) : agentsTop.agents.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Немає агентських бронювань</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {agentsTop.agents.slice(0, 5).map((a, i) => (
                  <div key={a.agent_id ?? i} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="text-slate-700 dark:text-slate-300 truncate">
                      <span className="text-slate-400 font-mono text-xs mr-1.5">{i + 1}.</span>
                      {a.agency_name ?? '—'}
                    </span>
                    <span className="font-mono text-xs text-slate-600 dark:text-slate-300 shrink-0">
                      {a.bookings_count} бр. · {fmtEur(a.total_amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Дебіторка */}
          <SectionCard title={<span className="flex items-center gap-1.5"><Wallet size={13} /> Найбільші борги</span>} to="/finance">
            {debtsLoading || !debts ? (
              <p className="text-xs text-slate-400 py-4 text-center">Завантаження…</p>
            ) : debts.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Прострочених оплат немає</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {debts.slice(0, 6).map((d) => {
                  const owed = d.total_amount - d.deposit_paid - d.balance_paid;
                  return (
                    <div
                      key={d.id}
                      onClick={() => navigate(`/bookings/${d.id}`)}
                      className="flex items-center justify-between gap-3 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-slate-700 dark:text-slate-300 truncate">
                          {d.contact_tourist ? `${d.contact_tourist.last_name} ${d.contact_tourist.first_name}` : d.booking_number}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">{d.booking_number}{d.tour ? ` · ${d.tour.code}` : ''}</p>
                      </div>
                      <span className="font-mono text-xs font-semibold text-brand-red shrink-0">{fmtEur(owed)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
};

export default DirectorDashboard;
