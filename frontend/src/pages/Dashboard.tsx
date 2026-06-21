// ============================================================
// EUROTRIPS — pages/Dashboard.tsx
// Маршрут: /dashboard   Ролі: admin, director, manager, ops, accountant
//
// Секції:
//   1. KPI-картки: всього бронювань, підтверджених, доходу, боргу
//   2. Останні бронювання (10 рядків, без пагінації)
//   3. Тури найближчого місяця: ємність + кількість місць
//   4. Активні ліди (для менеджерів)
//
// Дані: GET /api/v1/finance/summary + GET /api/v1/bookings?limit=10
//       + GET /api/v1/tours?status=active&limit=5
//
// TODO: підключити TanStack Query хуки
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  BarChart2, Users, CreditCard, TrendingUp,
  AlertCircle, CalendarDays, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { api }     from '../services/api';

// ─── TYPES ───────────────────────────────────────────────────

interface FinanceSummary {
  totalBookings:     number;
  confirmedBookings: number;
  totalRevenue:      number;
  collectedRevenue:  number;
  currency:          string;
  generatedAt:       string;
}

interface RecentBooking {
  id:            string;
  bookingNumber: string;
  status:        string;
  totalAmount:   number;
  createdAt:     string;
  contactTourist?: { firstName: string; lastName: string };
  tour?:           { name: string; departureDate: string };
}

interface ActiveTour {
  id:             string;
  name:           string;
  departureDate:  string;
  availableSeats: number;
  totalSeats:     number;
  status:         string;
}

// ─── KPI CARD ─────────────────────────────────────────────────

const KpiCard: React.FC<{
  title: string;
  value: string | number;
  sub?:  string;
  icon:  React.ReactNode;
  color: string;
}> = ({ title, value, sub, icon, color }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 flex items-start gap-4">
    <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
    <div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  </div>
);

// ─── STATUS BADGE (inline) ────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  new:              'Новий',
  in_work:          'В роботі',
  confirmed:        'Підтверджено',
  awaiting_payment: 'Очікує оплату',
  completed:        'Завершено',
  cancelled_client: 'Скасовано',
};

const STATUS_COLORS: Record<string, string> = {
  new:              'bg-slate-100 text-slate-700',
  in_work:          'bg-blue-100 text-blue-700',
  confirmed:        'bg-green-100 text-green-700',
  awaiting_payment: 'bg-amber-100 text-amber-700',
  completed:        'bg-emerald-100 text-emerald-700',
  cancelled_client: 'bg-red-100 text-red-700',
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-600'}`}>
    {STATUS_LABELS[status] ?? status}
  </span>
);

// ─── MAIN PAGE ────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  const [summary,        setSummary]        = useState<FinanceSummary | null>(null);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [activeTours,    setActiveTours]    = useState<ActiveTour[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const [summaryRes, bookingsRes, toursRes] = await Promise.allSettled([
        api.get<{ data: FinanceSummary }>('/finance/summary'),
        api.get<{ data: RecentBooking[] }>('/bookings?limit=10'),
        api.get<{ data: ActiveTour[] }>('/tours?status=active&limit=5'),
      ]);

      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data.data);
      if (bookingsRes.status === 'fulfilled') setRecentBookings(bookingsRes.value.data.data ?? []);
      if (toursRes.status === 'fulfilled')    setActiveTours(toursRes.value.data.data ?? []);
    } catch {
      setError('Помилка завантаження даних');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const debt = summary
    ? summary.totalRevenue - summary.collectedRevenue
    : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Заголовок ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Дашборд</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Вітаємо, {user?.first_name ?? 'Користувач'} · {new Date().toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Оновити
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── KPI ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Всього бронювань"
          value={summary?.totalBookings ?? '—'}
          icon={<Users className="w-5 h-5 text-blue-600" />}
          color="bg-blue-50"
        />
        <KpiCard
          title="Підтверджено"
          value={summary?.confirmedBookings ?? '—'}
          sub="зараз в роботі"
          icon={<BarChart2 className="w-5 h-5 text-green-600" />}
          color="bg-green-50"
        />
        <KpiCard
          title="Загальний дохід"
          value={summary ? `€ ${summary.totalRevenue.toLocaleString('uk-UA')}` : '—'}
          sub={summary?.currency}
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          color="bg-emerald-50"
        />
        <KpiCard
          title="Дебіторська заборгованість"
          value={summary ? `€ ${debt.toLocaleString('uk-UA')}` : '—'}
          sub="не зібрано"
          icon={<CreditCard className="w-5 h-5 text-amber-600" />}
          color="bg-amber-50"
        />
      </div>

      {/* ── Бронювання + Тури ─────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Останні бронювання */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Останні бронювання</h2>
            <a href="/bookings" className="text-sm text-blue-600 hover:underline">Всі →</a>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Завантаження…</div>
          ) : recentBookings.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Немає бронювань</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {recentBookings.map((b) => (
                <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 font-mono">{b.bookingNumber}</p>
                    {b.contactTourist && (
                      <p className="text-xs text-slate-500 truncate">
                        {b.contactTourist.firstName} {b.contactTourist.lastName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusPill status={b.status} />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 w-20 text-right">
                      € {Number(b.totalAmount).toLocaleString('uk-UA', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Активні тури */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Активні тури</h2>
            <a href="/tours" className="text-sm text-blue-600 hover:underline">Всі →</a>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Завантаження…</div>
          ) : activeTours.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Немає активних турів</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {activeTours.map((t) => {
                const occupancy = t.totalSeats > 0
                  ? Math.round(((t.totalSeats - t.availableSeats) / t.totalSeats) * 100)
                  : 0;

                return (
                  <div key={t.id} className="px-5 py-3">
                    <div className="flex items-start gap-2 mb-1.5">
                      <CalendarDays className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-tight truncate">{t.name}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(t.departureDate).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </div>
                    {/* Прогрес заповненості */}
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>{t.totalSeats - t.availableSeats} / {t.totalSeats} місць</span>
                        <span>{occupancy}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${occupancy >= 90 ? 'bg-red-500' : occupancy >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                          style={{ width: `${occupancy}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
