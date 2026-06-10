// ============================================================
// EUROTRIPS — pages/Tours.tsx
// Каталог турів: фільтри, сітка/список, пагінація
// Моки: MOCK_TOURS з src/mocks/index.ts
// ============================================================

import React, { useState, useMemo, useCallback } from 'react';
import { Plus, Search, Grid3X3, List } from 'lucide-react';

import { TourCard }   from '../components/tours/TourCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth }     from '../hooks/useAuth';
import { MOCK_TOURS }  from '../mocks';
import type { Tour, TourStatus, TourType } from '../types';

// ─── CONSTANTS ────────────────────────────────────────────────

const STATUS_OPTIONS: { value: TourStatus | 'all'; label: string }[] = [
  { value: 'all',         label: 'Всі статуси'         },
  { value: 'open',        label: 'Відкрито для продажу' },
  { value: 'active',      label: 'Активно продається'   },
  { value: 'almost_full', label: 'Майже заповнений'     },
  { value: 'on_tour',     label: 'У виїзді'             },
  { value: 'closed',      label: 'Закрито'              },
  { value: 'completed',   label: 'Завершено'            },
];

const TYPE_OPTIONS: { value: TourType | 'all'; label: string }[] = [
  { value: 'all',      label: 'Всі типи'      },
  { value: 'bus',      label: 'Автобусний'    },
  { value: 'avia',     label: 'Авіатур'       },
  { value: 'combined', label: 'Комбінований'  },
];

const PER_PAGE = 8;

// ─── COMPONENT ────────────────────────────────────────────────

const ToursPage: React.FC = () => {
  const { isManager, isAdmin, isAgent } = useAuth();

  // ── Filters state ──────────────────────────────────────────
  const [view,       setView]    = useState<'grid' | 'list'>('grid');
  const [statusF,    setStatusF] = useState<TourStatus | 'all'>('all');
  const [typeF,      setTypeF]   = useState<TourType | 'all'>('all');
  const [query,      setQuery]   = useState('');
  const [page,       setPage]    = useState(1);

  // ── Reset page when filters change ────────────────────────
  const updateStatus = useCallback((v: TourStatus | 'all') => { setStatusF(v); setPage(1); }, []);
  const updateType   = useCallback((v: TourType | 'all')   => { setTypeF(v);   setPage(1); }, []);
  const updateQuery  = useCallback((v: string)              => { setQuery(v);   setPage(1); }, []);

  // ── Filtered & paginated data ─────────────────────────────
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return MOCK_TOURS.filter((t: Tour) => {
      if (statusF !== 'all' && t.status !== statusF) return false;
      if (typeF   !== 'all' && t.tour_type !== typeF) return false;
      if (q && !t.name.toLowerCase().includes(q)
            && !t.direction.toLowerCase().includes(q)
            && !t.code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [statusF, typeF, query]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged      = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // ── Handlers ───────────────────────────────────────────────
  const handleBook = useCallback((tourId: string) => {
    // TODO: navigate to /bookings/new?tour={tourId}
    console.log('Book tour:', tourId);
  }, []);

  const handleView = useCallback((tourId: string) => {
    // TODO: navigate to /tours/{tourId}
    console.log('View tour:', tourId);
  }, []);

  const clearFilters = () => {
    setStatusF('all');
    setTypeF('all');
    setQuery('');
    setPage(1);
  };

  const hasActiveFilters = statusF !== 'all' || typeF !== 'all' || query !== '';

  // ── SELECT STYLE (shared) ──────────────────────────────────
  const selClass = `
    px-3 py-2 text-sm rounded-lg border
    bg-white dark:bg-slate-900
    border-slate-200 dark:border-slate-700
    text-slate-700 dark:text-slate-300
    focus:outline-none focus:ring-2 focus:ring-blue-500
    cursor-pointer
  `;

  return (
    <div className="p-6 max-w-screen-xl mx-auto">

      {/* ── PAGE HEADER ── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-medium text-slate-900 dark:text-slate-100">
            Каталог турів
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {filtered.length} {filtered.length === 1 ? 'тур' : 'турів'} знайдено
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="ml-2 text-blue-500 hover:text-blue-700 underline"
              >
                Скинути фільтри
              </button>
            )}
          </p>
        </div>

        {(isAdmin || isManager) && (
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 transition-colors">
            <Plus size={14} />
            Новий тур
          </button>
        )}
      </div>

      {/* ── FILTER BAR ── */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            placeholder="Назва, напрямок або код туру..."
            className={`
              w-full pl-9 pr-4 py-2 text-sm rounded-lg border
              bg-white dark:bg-slate-900
              border-slate-200 dark:border-slate-700
              text-slate-900 dark:text-slate-100
              placeholder:text-slate-400
              focus:outline-none focus:ring-2 focus:ring-blue-500
            `}
          />
        </div>

        {/* Status filter */}
        <select
          value={statusF}
          onChange={(e) => updateStatus(e.target.value as TourStatus | 'all')}
          className={selClass}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Type filter */}
        <select
          value={typeF}
          onChange={(e) => updateType(e.target.value as TourType | 'all')}
          className={selClass}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* View toggle */}
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1">
          {([['grid', Grid3X3], ['list', List]] as const).map(([v, Icon]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-label={v === 'grid' ? 'Сітка' : 'Список'}
              className={`
                p-1.5 rounded-md transition-all
                ${view === v
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }
              `}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      {paged.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Search size={32} className="opacity-30 mb-3" />
          <p className="text-sm">Турів не знайдено. Спробуйте змінити фільтри.</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          {paged.map((tour) => (
            <TourCard
              key={tour.id}
              tour={tour}
              userRole={isAgent ? 'agent' : isManager ? 'manager' : undefined}
              variant="grid"
              showBookButton={true}
              onBook={handleBook}
              onView={handleView}
            />
          ))}
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-6">
          {paged.map((tour) => (
            <TourCard
              key={tour.id}
              tour={tour}
              userRole={isAgent ? 'agent' : isManager ? 'manager' : undefined}
              variant="list"
              showBookButton={true}
              onBook={handleBook}
              onView={handleView}
            />
          ))}
        </div>
      )}

      {/* ── PAGINATION ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>
            Сторінка {page} з {totalPages} · {filtered.length} турів
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`
                  px-2.5 py-1 rounded-md border text-xs transition-colors
                  ${page === n
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent font-medium'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }
                `}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToursPage;
