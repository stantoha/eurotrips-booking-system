// ============================================================
// EUROTRIPS — pages/Operations.tsx
// Маршрут: /operations   Ролі: admin, director, manager, ops, accountant
//
// OPS Wireframe 1 «Список виїздів»: реєстр турів з фільтрами
// (місяць, статус) + OccupancyBar + DeadlineIndicator (депозит).
// Джерело: docs/04. UX & Design/Wireframes/eurotrips_ux_cjm_wireframes.html
//
// Наступні вкладки картки виїзду (Готелі/Румінг/Розсадка/Чекліст)
// підключаються в TourDetail.tsx — див. project_ops_module_plan
// у пам'яті сесії.
// ============================================================

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, AlertTriangle, List, CalendarDays, LayoutDashboard, Users2, AlertOctagon } from 'lucide-react';

import { useTours } from '../hooks/useTours';
import { StatusBadge } from '../components/ui/StatusBadge';
import { OccupancyBar, occupancyPct, occupancyColor } from '../components/ui/OccupancyBar';
import { DeadlineIndicator } from '../components/ui/DeadlineIndicator';
import { CalendarGrid, type CalendarEvent } from '../components/ops/CalendarGrid';
import { useOpsDashboard } from '../hooks/useOpsDashboard';
import { ScreenStateBanner } from '../components/ops/ScreenStateBanner';
import type { Tour, TourStatus } from '../types';

// ─── DASHBOARD (/ops) ───────────────────────────────────────────

const OpsDashboardView: React.FC<{ onOpenTour: (id: string) => void }> = ({ onOpenTour }) => {
  const { data, isLoading, isError } = useOpsDashboard();

  if (isLoading) return <p className="text-sm text-slate-400 py-6">Завантаження дашборду…</p>;
  if (isError || !data) return <p className="text-sm text-brand-red py-6">Не вдалося завантажити дашборд.</p>;

  const { hotel_deadlines, upcoming_tours, checklist_progress, new_tourists } = data;

  return (
    <div className="space-y-6">
      {/* 🚨 Дедлайни готелів */}
      <section>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
          <AlertOctagon size={15} className="text-brand-red" /> Дедлайни готелів (&lt;3 дні)
        </h2>
        {hotel_deadlines.length === 0 ? (
          <p className="text-xs text-slate-400">Немає готелів із дедлайном опції найближчим часом.</p>
        ) : (
          <div className="space-y-1.5">
            {hotel_deadlines.map((hd) => (
              <div
                key={hd.hotel_booking_id}
                onClick={() => onOpenTour(hd.tour_id)}
                className="flex items-center justify-between gap-3 bg-brand-red/5 border border-brand-red/20 rounded-lg px-3 py-2 cursor-pointer hover:bg-brand-red/10 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm text-slate-800 dark:text-slate-200 truncate">
                    <span className="font-mono text-xs text-slate-400">{hd.tour_code}</span> · {hd.hotel_name} ({hd.city})
                  </p>
                </div>
                <DeadlineIndicator date={hd.option_deadline} />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 📅 Виїзди наступних 7 днів */}
        <section>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
            📅 Виїзди наступних 7 днів
          </h2>
          {upcoming_tours.length === 0 ? (
            <p className="text-xs text-slate-400">Немає виїздів у найближчі 7 днів.</p>
          ) : (
            <div className="space-y-2">
              {upcoming_tours.map((t) => (
                <div
                  key={t.tour_id}
                  onClick={() => onOpenTour(t.tour_id)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 cursor-pointer hover:border-brand-cyan transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      <span className="font-mono text-xs text-slate-400 mr-1">{t.code}</span>{t.name}
                    </p>
                    <span className="text-xs text-slate-400 shrink-0">{new Date(t.departure_date).toLocaleDateString('uk-UA')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1"><OccupancyBar current={t.total_seats - t.available_seats} max={t.total_seats} size="sm" /></div>
                    <span className="text-xs text-slate-400 shrink-0">✅ {t.readiness_percent}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 📊 Прогрес чеклістів */}
        <section>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
            📊 Прогрес чеклістів (тури в підготовці)
          </h2>
          {checklist_progress.length === 0 ? (
            <p className="text-xs text-slate-400">Немає турів у підготовці.</p>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
              {checklist_progress.map((c) => (
                <div
                  key={c.tour_id}
                  onClick={() => onOpenTour(c.tour_id)}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
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
        </section>
      </div>

      {/* 👥 Нові туристи сьогодні */}
      <section>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
          <Users2 size={15} /> Нові підтверджені туристи сьогодні
        </h2>
        {new_tourists.length === 0 ? (
          <p className="text-xs text-slate-400">Сьогодні ще немає нових підтверджених бронювань.</p>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
            {new_tourists.map((n) => (
              <div
                key={n.booking_id}
                onClick={() => onOpenTour(n.tour_id)}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="text-slate-700 dark:text-slate-300">{n.contact_name} <span className="text-slate-400">({n.persons_count} ос.)</span></span>
                <span className="text-xs text-slate-400 font-mono">{n.tour_code} · {n.booking_number}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

// ─── CONSTANTS ────────────────────────────────────────────────

const STATUS_FILTERS: { value: TourStatus | 'all'; label: string }[] = [
  { value: 'all',         label: 'Всі статуси' },
  { value: 'draft',       label: 'Чернетка' },
  { value: 'open',        label: 'Відкрито' },
  { value: 'active',      label: 'Активно' },
  { value: 'almost_full', label: 'Майже заповнений' },
  { value: 'closed',      label: 'Закрито' },
  { value: 'on_tour',     label: 'На виїзді' },
];

// ─── CARD ─────────────────────────────────────────────────────

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });

const OpsTourCard: React.FC<{ tour: Tour; onOpen: (id: string) => void }> = ({ tour, onOpen }) => {
  const pct = occupancyPct(tour.total_seats - tour.available_seats, tour.total_seats);
  const isCritical = pct >= 80;

  return (
    <div
      onClick={() => onOpen(tour.id)}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <code className="text-[11px] text-slate-400 font-mono">{tour.code}</code>
          <h3 className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">{tour.name}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {formatDate(tour.departure_date)} → {formatDate(tour.return_date)}
            {tour.duration_days ? ` · ${tour.duration_days} дн.` : ''}
          </p>
        </div>
        <StatusBadge status={tour.status} domain="tour" size="xs" />
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-2">
        {isCritical && <AlertTriangle size={12} className="text-brand-red shrink-0" />}
        <span>{tour.direction}</span>
      </div>

      <OccupancyBar current={tour.total_seats - tour.available_seats} max={tour.total_seats} size="sm" />

      {tour.deposit_deadline && (
        <div className="mt-2">
          <DeadlineIndicator date={tour.deposit_deadline} label="Дедлайн депозиту" />
        </div>
      )}
    </div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────

const Operations: React.FC = () => {
  const navigate = useNavigate();
  const [mainView, setMainView] = useState<'dashboard' | 'registry'>('dashboard');
  const [statusF, setStatusF] = useState<TourStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  const { data, isLoading, isError } = useTours({
    status: statusF === 'all' ? undefined : statusF,
    search: search || undefined,
    limit: 50,
  });
  const { data: dashboard } = useOpsDashboard();

  const tours = useMemo(() => data?.data ?? [], [data]);
  const hasActiveFilter = statusF !== 'all' || search !== '';

  // C-4 «Стани екранів»: empty/partial/ready/post-tour для реєстру виїздів.
  const registryState = useMemo(() => {
    if (tours.length === 0) {
      return {
        state: 'empty' as const,
        title: hasActiveFilter ? 'Немає виїздів за обраними фільтрами.' : 'Немає виїздів на місяць.',
        subtitle: hasActiveFilter ? undefined : 'Створіть перший виїзд у каталозі турів.',
        action: hasActiveFilter
          ? { label: 'Скинути фільтри', onClick: () => { setStatusF('all'); setSearch(''); } }
          : { label: '+ Створити перший виїзд', onClick: () => navigate('/tours') },
      };
    }
    const draftCount = tours.filter((t) => t.status === 'draft').length;
    const activeCount = tours.filter((t) => ['open', 'active', 'almost_full'].includes(t.status)).length;
    const readinessById = new Map((dashboard?.checklist_progress ?? []).map((c) => [c.tour_id, c.readiness_percent]));
    const lowReadiness = tours.filter((t) => (readinessById.get(t.id) ?? 100) < 50);

    if (tours.every((t) => t.status === 'completed')) {
      return {
        state: 'post-tour' as const,
        title: 'Виїзди завершені. Статус: completed.',
        subtitle: 'Доступна аналітика по завершених виїздах.',
        action: { label: 'До фінансів', onClick: () => navigate('/finance') },
      };
    }
    if (lowReadiness.length > 0) {
      return {
        state: 'partial' as const,
        title: `${tours.length} виїзд(и): ${activeCount} активних, ${draftCount} чернеток.`,
        subtitle: `⚠️ Чекліст < 50% у ${lowReadiness.length} виїзд(ах)`,
        action: { label: 'Відкрити дашборд', onClick: () => setMainView('dashboard') },
      };
    }
    const nearest = tours
      .filter((t) => t.status !== 'completed')
      .map((t) => Math.ceil((new Date(t.departure_date).getTime() - Date.now()) / 86_400_000))
      .filter((d) => d >= 0)
      .sort((a, b) => a - b)[0];
    return {
      state: 'ready' as const,
      title: 'Всі виїзди активні.',
      subtitle: nearest !== undefined ? `Наступний виїзд за ${nearest} дн.` : undefined,
    };
  }, [tours, hasActiveFilter, dashboard, navigate]);

  // NOTE: календар будується з того самого списку (ліміт 50, без
  // фільтра по місяцю в API-запиті) — для туру поза цим вікном подія
  // у сітці не з'явиться. Прийнятне спрощення для MVP-перегляду;
  // повноцінний календар вимагатиме dateFrom/dateTo-запиту на бекенд.
  const calendarEvents: CalendarEvent[] = useMemo(
    () => tours.map((t) => ({
      id: t.id,
      date: t.departure_date,
      label: `${t.code} (${occupancyPct(t.total_seats - t.available_seats, t.total_seats)}%)`,
      tone: occupancyPct(t.total_seats - t.available_seats, t.total_seats) >= 80
        ? 'err'
        : occupancyPct(t.total_seats - t.available_seats, t.total_seats) >= 60
        ? 'warn'
        : 'ok',
    })),
    [tours],
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Операційний відділ</h1>
      </div>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">
        Бізнес-правила: BR-09 (структура румінгів), BR-10 (валідація), BR-11 (BullMQ), BR-12 (самосервіс туристів), OPS-18 (чекліст готовності).
      </p>

      {/* Main view toggle: Дашборд / Реєстр виїздів */}
      <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5 mb-5 w-fit">
        <button
          onClick={() => setMainView('dashboard')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            mainView === 'dashboard' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard size={13} /> Дашборд
        </button>
        <button
          onClick={() => setMainView('registry')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            mainView === 'registry' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500'
          }`}
        >
          <List size={13} /> Реєстр виїздів
        </button>
      </div>

      {mainView === 'dashboard' && <OpsDashboardView onOpenTour={(id) => navigate(`/tours/${id}`)} />}

      {mainView === 'registry' && (
      <>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              view === 'list' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500'
            }`}
          >
            <List size={13} /> Список
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              view === 'calendar' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500'
            }`}
          >
            <CalendarDays size={13} /> Календар
          </button>
        </div>
        <select
          value={statusF}
          onChange={(e) => setStatusF(e.target.value as TourStatus | 'all')}
          className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук за ID або назвою…"
            className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900"
          />
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-slate-400">Завантаження…</p>
      )}

      {isError && (
        <p className="text-sm text-brand-red">Не вдалося завантажити список виїздів.</p>
      )}

      {!isLoading && !isError && (
        <ScreenStateBanner
          state={registryState.state}
          title={registryState.title}
          subtitle={registryState.subtitle}
          action={registryState.action}
        />
      )}

      {!isLoading && tours.length > 0 && view === 'list' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tours.map((tour) => (
            <OpsTourCard key={tour.id} tour={tour} onOpen={(id) => navigate(`/tours/${id}`)} />
          ))}
        </div>
      )}

      {!isLoading && view === 'calendar' && (
        <CalendarGrid
          month={calendarMonth}
          events={calendarEvents}
          onMonthChange={setCalendarMonth}
          onEventClick={(id) => navigate(`/tours/${id}`)}
        />
      )}
      </>
      )}
    </div>
  );
};

export default Operations;
