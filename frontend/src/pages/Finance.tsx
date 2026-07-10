// ============================================================
// EUROTRIPS — pages/Finance.tsx
// Маршрут: /finance   Ролі: admin, director (навігація), доступ до
// деяких панелей ширший на бекенді (accountant теж бачить margin-alerts).
//
// За макетом Eurotrips Prototype.dc.html, з поправками під реальні
// бекенд-ендпоінти:
//   - "Журнал операцій" з прототипу перейменовано на "Дебіторська
//     заборгованість" — бекенд не має ендпоінта повної історії
//     транзакцій, тільки GET /finance/debts (непогашена заборгованість)
//   - Панель комісій агентів не реалізована в цьому проході —
//     GET /agents/:id/commissions вимагає agentId, "усі агенти" на
//     бекенді не існує (потрібен окремий ендпоінт-агрегація,
//     напр. GET /finance/agent-commissions — бекенд-завдання на майбутнє)
// ============================================================

import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { useFinanceSummary, useFinanceDebts, useMarginAlerts } from '../hooks/useFinance';
import { DeadlineIndicator } from '../components/ui/DeadlineIndicator';

const fmtEur = (n: number) => `€ ${n.toLocaleString('uk-UA', { minimumFractionDigits: 0 })}`;

const KpiCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4">
    <p className="text-xs text-slate-400 mb-2">{label}</p>
    <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-slate-50">{value}</p>
  </div>
);

const Finance: React.FC = () => {
  const { isAdmin, isDirector, isAccountant } = useAuth();
  const canSeeMarginAlerts = isAdmin || isDirector || isAccountant;

  const { data: summary, isLoading: summaryLoading } = useFinanceSummary();
  const { data: debts, isLoading: debtsLoading } = useFinanceDebts();
  const { data: alerts, isLoading: alertsLoading } = useMarginAlerts(canSeeMarginAlerts);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900 dark:text-slate-50">Фінанси</h1>
        <p className="text-sm text-slate-500 mt-0.5">Зведений звіт · дебіторська заборгованість · admin/director/accountant</p>
      </div>

      {/* ── KPI ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Всього бронювань" value={summaryLoading ? '…' : summary?.total_bookings ?? '—'} />
        <KpiCard label="Підтверджено"     value={summaryLoading ? '…' : summary?.confirmed_bookings ?? '—'} />
        <KpiCard label="Загальний дохід"  value={summaryLoading || !summary ? '…' : fmtEur(summary.total_revenue)} />
        <KpiCard label="Зібрано"          value={summaryLoading || !summary ? '…' : fmtEur(summary.collected_revenue)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Дебіторська заборгованість ──────────────────────── */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-heading text-sm font-semibold text-slate-800 dark:text-slate-200">Дебіторська заборгованість</h2>
          </div>
          {debtsLoading ? (
            <p className="text-xs text-slate-400 py-8 text-center">Завантаження…</p>
          ) : !debts || debts.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">Немає непогашеної заборгованості</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60">
                    <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Бронювання</th>
                    <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Тур</th>
                    <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Дедлайн</th>
                    <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">До сплати</th>
                  </tr>
                </thead>
                <tbody>
                  {debts.map((d) => (
                    <tr key={d.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <td className="px-3 py-2.5">
                        <code className="font-mono text-xs text-brand-cyan">{d.booking_number}</code>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                        {d.tour?.name ?? '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        {d.balance_deadline ? <DeadlineIndicator date={d.balance_deadline} /> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800 dark:text-slate-100">
                        {fmtEur(d.total_amount - d.deposit_paid - d.balance_paid)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Ризики маржі (admin/director/accountant) ───────── */}
        {canSeeMarginAlerts && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-heading text-sm font-semibold text-slate-800 dark:text-slate-200">Ризики маржі</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Комісія агента ≥ маржа оператора</p>
            </div>
            {alertsLoading ? (
              <p className="text-xs text-slate-400 py-8 text-center">Завантаження…</p>
            ) : !alerts || alerts.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">Ризикових турів немає</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {alerts.map((a) => (
                  <div key={a.tour_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{a.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{a.code}</p>
                    </div>
                    <span className="font-mono text-xs font-semibold text-brand-gold-dark flex-shrink-0">
                      {(a.margin_pct * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Finance;
