// ============================================================
// EUROTRIPS — pages/Tours.tsx
// Маршрут: /tours   Ролі: admin, director, manager, ops_manager, accountant
//
// Фільтри:
//   • статус туру (TourStatus)
//   • тип транспорту (bus / avia / combined)
//   • місяць виїзду (витягується з departure_date)
//
// Відображення:
//   • Grid (TourCard variant="grid", 3-4 колонки)
//   • List (TourCard variant="list", рядки)
//   • Прогрес-бар заповненості по available_seats / total_seats
//   • cost_price та margin приховані для агентів (BR-04)
//
// TODO: замінити MOCK_TOURS на useTours() (TanStack Query)
//       коли GET /api/v1/tours відкрито на backend
// ============================================================

import React, { useState, useMemo, useCallback } from 'react';
import { Plus, Search, Grid3X3, List, SlidersHorizontal, X } from 'lucide-react';

import { TourCard }   from '../components/tours/TourCard';
import { useAuth }    from '../hooks/useAuth';
import { MOCK_TOURS } from '../mocks';
import {
  TOUR_STATUS_CONFIG,
  STATUS_COLOR_CLASSES,
} from '../constants/statuses';
import type { Tour, TourStatus, TourType } from '../types';

// ─── CONSTANTS ────────────────────────────────────────────────

const MONTHS_UK = [
  'Січень','Лютий','Березень','Квітень','Травень','Червень',
  'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень',
];

/** YYYY-MM → 'Жовтень 2025' */
const fmtMonth = (ym: string): string => {
  const [y, m] = ym.split('-');
  return `${MONTHS_UK[parseInt(m, 10) - 1]} ${y}`;
};

const TOUR_TYPES: { value: TourType | 'all'; label: string }[] = [
  { value: 'all',      label: 'Всі типи'      },
  { value: 'bus',      label: 'Автобусний'    },
  { value: 'avia',     label: 'Авіатур'       },
  { value: 'combined', label: 'Комбінований'  },
];

const PER_PAGE = 8;

// ─── HELPERS ──────────────────────────────────────────────────

/** Відсоток заповненості місць */
const occupancy = (t: Tour): number =>
  t.total_seats > 0
    ? Math.round(((t.total_seats - t.available_seats) / t.total_seats) * 100)
    : 100;

/** Tailwind-клас прогрес-бару за відсотком */
const barColor = (pct: number): string =>
  pct >= 95 ? 'bg-red-500'
  : pct >= 80 ? 'bg-amber-500'
  : 'bg-emerald-500';

// ─── SUB-COMPONENTS ───────────────────────────────────────────

/** Бейдж статусу туру */
const TourStatusBadge: React.FC<{ status: TourStatus }> = ({ status }) => {
  const cfg = TOUR_STATUS_CONFIG[status];
  if (!cfg) return null;
  const cc  = STATUS_COLOR_CLASSES[cfg.colorVariant];
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full
        text-xs font-medium border ${cc.badge}
        ${cfg.isPulsing ? 'animate-pulse' : ''}
      `}
    >
      {cfg.label}
    </span>
  );
};

/** Рядок у list-view */
const TourListRow: React.FC<{
  tour: Tour;
  showCost: boolean;
  onBook: (id: string) => void;
}> = ({ tour, showCost, onBook }) => {
  const occ = occupancy(tour);
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">

      {/* ID + назва */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <code className="text-xs text-slate-400 font-mono">{tour.code}</code>
          <TourStatusBadge status={tour.status} />
        </div>
        <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">{tour.name}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {tour.direction} · {tour.departure_date} · {tour.duration_days}д · {
            { bus: 'Автобусний', avia: 'Авіатур', combined: 'Комбінований' }[tour.tour_type]
          }
        </p>
      </div>

      {/* Місця + прогрес */}
      <div className="w-24 flex-shrink-0">
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
          <span>{tour.available_seats} місць</span>
          <span>{occ}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor(occ)}`}
            style={{ width: `${occ}%` }}
          />
        </div>
      </div>

      {/* Ціна + комісія */}
      <div className="text-right flex-shrink-0 min-w-[90px]">
        <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
          {tour.base_price.toLocaleString('uk-UA')} EUR
        </p>
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          {(tour.agent_commission_pct * 100).toFixed(0)}% ком.
        </p>
        {/* BR-04: cost_price тільки для admin/director/accountant */}
        {showCost && (
          <p className="text-xs text-slate-400">
            с/в {tour.cost_price?.toLocaleString('uk-UA')}
          </p>
        )}
      </div>

      <button
        onClick={() => onBook(tour.id)}
        disabled={tour.available_seats === 0}
        className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {tour.available_seats === 0 ? 'Заповнений' : 'Бронювати'}
      </button>
    </div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────

const ToursPage: React.FC = () => {
  const { isAdmin, isDirector, isManager, isAccountant, canSeeMargin } = useAuth();
  const canCreate = isAdmin || isManager;

  // ── Filter state ───────────────────────────────────────────
  const [view,     setView]    = useState<'grid' | 'list'>('grid');
  const [query,    setQuery]   = useState('');
  const [statusF,  setStatusF] = useState<TourStatus | 'all'>('all');
  const [typeF,    setTypeF]   = useState<TourType | 'all'>('all');
  const [monthF,   setMonthF]  = useState<string>('all');
  const [page,     setPage]    = useState(1);

  // ── Available months (з реальних дат) ─────────────────────
  const monthOptions = useMemo(() => {
    const set = new Set(
      MOCK_TOURS.map((t) => t.departure_date.substring(0, 7)),
    );
    return Array.from(set).sort();
  }, []);

  // ── Filtered data ──────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return MOCK_TOURS.filter((t: Tour) => {
      if (statusF !== 'all' && t.status !== statusF)                     return false;
      if (typeF   !== 'all' && t.tour_type !== typeF)                    return false;
      if (monthF  !== 'all' && !t.departure_date.startsWith(monthF))     return false;
      if (q && !t.name.toLowerCase().includes(q)
            && !t.direction.toLowerCase().includes(q)
            && !t.code.toLowerCase().includes(q))                        return false;
      return true;
    });
  }, [query, statusF, typeF, monthF]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged      = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // ── Handlers ───────────────────────────────────────────────
  const resetPage   = useCallback(() => setPage(1), []);

  const handleQuery  = useCallback((v: string)              => { setQuery(v);   resetPage(); }, [resetPage]);
  const handleStatus = useCallback((v: string)              => { setStatusF(v as TourStatus | 'all'); resetPage(); }, [resetPage]);
  const handleType   = useCallback((v: string)              => { setTypeF(v as TourType | 'all'); resetPage(); }, [resetPage]);
  const handleMonth  = useCallback((v: string)              => { setMonthF(v);  resetPage(); }, [resetPage]);
  const handleBook   = useCallback((id: string) => {
    // TODO: navigate(`/bookings/new?tour=${id}`)
    console.log('[Tours] Book tour:', id);
  }, []);

  const clearFilters = () => { setQuery(''); setStatusF('all'); setTypeF('all'); setMonthF('all'); setPage(1); };
  const hasFilters   = query || statusF !== 'all' || typeF !== 'all' || monthF !== 'all';

  const selClass = 'px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer';

  return (
    <div className="p-6 max-w-screen-xl mx-auto">

      {/* ── HEADER ── */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-medium text-slate-900 dark:text-slate-100">
            Каталог турів
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {filtered.length} турів
            {hasFilters && (
              <button onClick={clearFilters} className="ml-2 text-blue-500 hover:underline inline-flex items-center gap-1">
                <X size={11} /> Скинути
              </button>
            )}
          </p>
        </div>
        {canCreate && (
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 transition-colors">
            <Plus size={14} aria-hidden="true" /> Новий тур
          </button>
        )}
      </div>

      {/* ── FILTERS ── */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">

        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
            placeholder="Назва, напрямок або код туру..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Статус */}
        <select value={statusF} onChange={(e) => handleStatus(e.target.value)} className={selClass}>
          <option value="all">Всі статуси</option>
          {(Object.keys(TOUR_STATUS_CONFIG) as TourStatus[]).map((s) => (
            <option key={s} value={s}>{TOUR_STATUS_CONFIG[s].label}</option>
          ))}
        </select>

        {/* Тип */}
        <select value={typeF} onChange={(e) => handleType(e.target.value)} className={selClass}>
          {TOUR_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Місяць виїзду */}
        <select value={monthF} onChange={(e) => handleMonth(e.target.value)} className={selClass}>
          <option value="all">Всі місяці</option>
          {monthOptions.map((ym) => (
            <option key={ym} value={ym}>{fmtMonth(ym)}</option>
          ))}
        </select>

        {/* View toggle */}
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1">
          {([['grid', Grid3X3, 'Сітка'], ['list', List, 'Список']] as const).map(([v, Icon, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-label={label}
              className={`p-1.5 rounded-md transition-all ${
                view === v
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={15} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      {paged.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Search size={32} className="opacity-30 mb-3" aria-hidden="true" />
          <p className="text-sm">Турів не знайдено — спробуйте змінити фільтри.</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          {paged.map((tour) => (
            <TourCard
              key={tour.id}
              tour={tour}
              userRole={canSeeMargin ? 'manager' : 'agent'}
              variant="grid"
              onBook={handleBook}
            />
          ))}
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-6">
          {paged.map((tour) => (
            <TourListRow
              key={tour.id}
              tour={tour}
              showCost={canSeeMargin}
              onBook={handleBook}
            />
          ))}
        </div>
      )}

      {/* ── PAGINATION ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>
            {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} з {filtered.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`px-2.5 py-1.5 rounded-md border text-xs transition-colors ${
                  page === n
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent font-medium'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >{n}</button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >›</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToursPage;
