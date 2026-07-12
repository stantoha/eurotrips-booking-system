// ============================================================
// EUROTRIPS — pages/Analytics.tsx
// Маршрут: /analytics   Ролі: admin, director, manager
// Базова аналітика (Реліз 1): воронка продажів, заповнюваність
// турів, топ агентів — на 3 готових бекенд-ендпоінтах.
// ============================================================

import React, { useState } from 'react';
import { Filter, TrendingDown, Users2, BusFront } from 'lucide-react';
import { useSalesFunnel, useToursLoad, useAgentsTop } from '../hooks/useAnalytics';
import { useAuth } from '../hooks/useAuth';

// ─── ВОРОНКА ПРОДАЖІВ ─────────────────────────────────────────

const FunnelSection: React.FC<{ dateFrom?: string; dateTo?: string }> = ({ dateFrom, dateTo }) => {
  const { data, isLoading, isError } = useSalesFunnel({ dateFrom, dateTo });

  if (isLoading) return <p className="text-sm text-slate-400">Завантаження воронки…</p>;
  if (isError || !data) return <p className="text-sm text-brand-red">Не вдалося завантажити воронку продажів.</p>;

  const steps = [
    { label: 'Ліди', value: data.funnel.leads, color: 'bg-brand-cyan' },
    { label: 'Бронювання', value: data.funnel.bookings, color: 'bg-brand-gold', pct: data.conversion.lead_to_booking_pct },
    { label: 'Підтверджені', value: data.funnel.confirmed, color: 'bg-emerald-500', pct: data.conversion.booking_to_confirmed_pct },
  ];
  const max = Math.max(1, ...steps.map((s) => s.value));

  return (
    <div className="space-y-3">
      {steps.map((s, i) => (
        <div key={s.label}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-slate-700 dark:text-slate-300">{s.label}</span>
            <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {s.value.toLocaleString('uk-UA')}
              {i > 0 && s.pct !== undefined && (
                <span className="text-xs text-slate-400 font-normal ml-2">конверсія {s.pct}%</span>
              )}
            </span>
          </div>
          <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
            <div className={`h-full rounded-lg ${s.color} transition-all`} style={{ width: `${Math.max(2, (s.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── ЗАПОВНЮВАНІСТЬ ТУРІВ ─────────────────────────────────────

const ToursLoadSection: React.FC<{ dateFrom?: string; dateTo?: string }> = ({ dateFrom, dateTo }) => {
  const { data, isLoading, isError } = useToursLoad({ dateFrom, dateTo });

  if (isLoading) return <p className="text-sm text-slate-400">Завантаження…</p>;
  if (isError || !data) return <p className="text-sm text-brand-red">Не вдалося завантажити заповнюваність.</p>;
  if (data.length === 0) return <p className="text-xs text-slate-400">Немає турів за обраний період.</p>;

  const barColor = (pct: number) => pct >= 95 ? 'bg-brand-red' : pct >= 80 ? 'bg-brand-gold' : 'bg-brand-cyan';

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      {data.map((t) => (
        <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
          <div className="w-40 shrink-0">
            <code className="text-[11px] text-slate-400 font-mono">{t.code}</code>
            <p className="text-xs text-slate-700 dark:text-slate-300 truncate">{t.name}</p>
          </div>
          <span className="text-xs text-slate-400 w-20 shrink-0">{new Date(t.departure_date).toLocaleDateString('uk-UA')}</span>
          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor(t.occupancy_pct)}`} style={{ width: `${t.occupancy_pct}%` }} />
          </div>
          <span className="font-mono text-xs text-slate-600 dark:text-slate-300 w-24 text-right shrink-0">
            {t.sold_seats}/{t.total_seats} · {t.occupancy_pct}%
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── ТОП АГЕНТІВ ──────────────────────────────────────────────

const AgentsTopSection: React.FC<{ dateFrom?: string; dateTo?: string }> = ({ dateFrom, dateTo }) => {
  const { data, isLoading, isError } = useAgentsTop({ dateFrom, dateTo });

  if (isLoading) return <p className="text-sm text-slate-400">Завантаження…</p>;
  if (isError || !data) return <p className="text-sm text-brand-red">Не вдалося завантажити топ агентів.</p>;
  if (data.agents.length === 0) return <p className="text-xs text-slate-400">Немає агентських бронювань за період.</p>;

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="grid grid-cols-[1fr_90px_110px_110px] gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/60 text-[10px] uppercase font-semibold text-slate-400">
        <span>Агенція</span><span className="text-right">Броней</span><span className="text-right">Оборот, EUR</span><span className="text-right">Комісія, EUR</span>
      </div>
      {data.agents.map((a, i) => (
        <div key={a.agent_id ?? i} className="grid grid-cols-[1fr_90px_110px_110px] gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0 text-sm items-center">
          <div className="min-w-0">
            <p className="text-slate-800 dark:text-slate-200 truncate">
              <span className="text-slate-400 font-mono text-xs mr-1.5">{i + 1}.</span>
              {a.agency_name ?? '—'}
              {a.agent_type === 'network' && <span className="text-[10px] text-brand-cyan ml-1.5 uppercase">network</span>}
            </p>
            {a.manager_name && <p className="text-xs text-slate-400 truncate">{a.manager_name}</p>}
          </div>
          <span className="font-mono text-right">{a.bookings_count}</span>
          <span className="font-mono text-right">{a.total_amount.toLocaleString('uk-UA')}</span>
          <span className="font-mono text-right text-slate-500">{a.total_commission.toLocaleString('uk-UA')}</span>
        </div>
      ))}
    </div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────

const AnalyticsPage: React.FC = () => {
  const { isAdmin, isDirector, isManager } = useAuth();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  if (!(isAdmin || isDirector || isManager)) return null;

  const inputClass = 'px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300';

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <h1 className="text-xl font-medium text-slate-900 dark:text-slate-100 mb-1">Аналітика</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
        Воронка продажів, заповнюваність турів, топ агентів (Реліз 1 — базова аналітика).
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Filter size={14} className="text-slate-400" />
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
        <span className="text-slate-400 text-sm">—</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-blue-500 hover:underline">
            Скинути період
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">
            <TrendingDown size={15} /> Воронка продажів
          </h2>
          <FunnelSection dateFrom={dateFrom || undefined} dateTo={dateTo || undefined} />
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">
            <Users2 size={15} /> Топ агентів
          </h2>
          <AgentsTopSection dateFrom={dateFrom || undefined} dateTo={dateTo || undefined} />
        </section>
      </div>

      <section>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
          <BusFront size={15} /> Заповнюваність турів
        </h2>
        <ToursLoadSection dateFrom={dateFrom || undefined} dateTo={dateTo || undefined} />
      </section>
    </div>
  );
};

export default AnalyticsPage;
