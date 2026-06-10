// ============================================================
// EUROTRIPS — pages/Bookings.tsx
// Список бронювань: пошук по ET-номеру/імені, фільтри статусу
// та менеджера, пагінація, розгорнута деталь рядка.
// Моки: MOCK_BOOKINGS з src/mocks/index.ts
// ============================================================

import React, { useState, useMemo, useCallback } from 'react';
import { Plus, Search, Download } from 'lucide-react';

import { BookingRow }  from '../components/bookings/BookingRow';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth }     from '../hooks/useAuth';
import { MOCK_BOOKINGS } from '../mocks';
import type { Booking, BookingStatus } from '../types';

// ─── CONSTANTS ────────────────────────────────────────────────

/** Статуси бронювань для фільтра */
const BOOKING_STATUSES: { value: BookingStatus | 'all'; label: string }[] = [
  { value: 'all',                  label: 'Всі статуси'              },
  { value: 'new',                  label: 'Нова заявка'              },
  { value: 'in_work',              label: 'У роботі'                 },
  { value: 'awaiting_payment',     label: 'Очікує оплату'            },
  { value: 'partially_paid',       label: 'Частково оплачено'        },
  { value: 'confirmed',            label: 'Підтверджено'             },
  { value: 'docs_collected',       label: 'Документи зібрані'        },
  { value: 'ready_to_depart',      label: 'Готово до виїзду'         },
  { value: 'on_trip',              label: 'У поїздці'                },
  { value: 'completed',            label: 'Завершено'                },
  { value: 'cancelled_client',     label: 'Скасовано клієнтом'       },
  { value: 'cancelled_operator',   label: 'Скасовано оператором'     },
  { value: 'refund',               label: 'Refund'                   },
];

/** Менеджери для фільтра (TODO: завантажувати з API) */
const MANAGERS = ['all', 'Андрій С.', 'Олена Р.', 'Михайло К.'] as const;

/** Колонки таблиці */
const TABLE_HEADERS = [
  { key: 'id',      label: '№ Бронювання',  align: 'left'  },
  { key: 'tourist', label: 'Турист',         align: 'left'  },
  { key: 'tour',    label: 'Тур / Дата',     align: 'left'  },
  { key: 'type',    label: 'Тип',            align: 'left'  },
  { key: 'total',   label: 'Сума EUR',       align: 'right' },
  { key: 'balance', label: 'Залишок',        align: 'right' },
  { key: 'status',  label: 'Статус',         align: 'left'  },
  { key: 'manager', label: 'Менеджер',       align: 'left'  },
  { key: 'expand',  label: '',               align: 'center'},
] as const;

const PER_PAGE = 10;

// ─── COMPONENT ────────────────────────────────────────────────

const BookingsPage: React.FC = () => {
  const { isAdmin, isManager, isOpsManager } = useAuth();

  // ── Filters state ──────────────────────────────────────────
  const [query,      setQuery]   = useState('');
  const [statusF,    setStatusF] = useState<BookingStatus | 'all'>('all');
  const [managerF,   setManagerF] = useState<string>('all');
  const [page,       setPage]    = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Reset page helper ──────────────────────────────────────
  const resetPage = useCallback(() => setPage(1), []);

  // ── Filtered data ──────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return MOCK_BOOKINGS.filter((b: Booking) => {
      // Status filter
      if (statusF !== 'all' && b.status !== statusF) return false;
      // Manager filter
      if (managerF !== 'all' && b.manager_name !== managerF) return false;
      // Full-text: booking id, tourist name, tour name
      if (q) {
        const inId      = b.booking_number?.toLowerCase().includes(q);
        const inName    = b.tourist_name?.toLowerCase().includes(q);
        const inTour    = b.tour_name?.toLowerCase().includes(q);
        const inAgent   = b.agent_name?.toLowerCase().includes(q);
        if (!inId && !inName && !inTour && !inAgent) return false;
      }
      return true;
    });
  }, [query, statusF, managerF]);

  // ── Derived stats ──────────────────────────────────────────
  const totalDebt    = useMemo(() => filtered.reduce((s, b) => s + (b.balance ?? 0), 0), [filtered]);
  const pendingCount = useMemo(() => filtered.filter((b) => b.status === 'awaiting_payment' || b.status === 'partially_paid').length, [filtered]);

  // ── Pagination ─────────────────────────────────────────────
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged      = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // ── Handlers ───────────────────────────────────────────────
  const handleSearch = useCallback((v: string) => { setQuery(v);    resetPage(); }, [resetPage]);
  const handleStatus = useCallback((v: string) => { setStatusF(v as BookingStatus | 'all'); resetPage(); }, [resetPage]);
  const handleMgr    = useCallback((v: string) => { setManagerF(v); resetPage(); }, [resetPage]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const clearFilters = () => {
    setQuery('');
    setStatusF('all');
    setManagerF('all');
    setPage(1);
    setExpandedId(null);
  };

  const hasFilters = query !== '' || statusF !== 'all' || managerF !== 'all';

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
            Бронювання
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {filtered.length} записів
            {totalDebt > 0 && (
              <> · Борг: <span className="text-amber-600 dark:text-amber-400 font-medium">{totalDebt.toLocaleString('uk-UA')} EUR</span></>
            )}
            {pendingCount > 0 && (
              <> · Очікують оплати: <span className="text-orange-600 dark:text-orange-400 font-medium">{pendingCount}</span></>
            )}
            {hasFilters && (
              <button onClick={clearFilters} className="ml-2 text-blue-500 hover:text-blue-700 underline">
                Скинути
              </button>
            )}
          </p>
        </div>

        <div className="flex gap-2 items-center">
          {(isAdmin || isManager) && (
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <Download size={14} />
              Експорт
            </button>
          )}
          {(isAdmin || isManager || isOpsManager) && (
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 transition-colors">
              <Plus size={14} />
              Нове бронювання
            </button>
          )}
        </div>
      </div>

      {/* ── FILTER BAR ── */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        {/* Search — by ET-number, tourist name, tour name */}
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="ET-2025-NNNNN або ім'я туриста..."
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
          onChange={(e) => handleStatus(e.target.value)}
          className={selClass}
        >
          {BOOKING_STATUSES.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Manager filter — only for admin/director */}
        {(isAdmin || isManager) && (
          <select
            value={managerF}
            onChange={(e) => handleMgr(e.target.value)}
            className={selClass}
          >
            <option value="all">Всі менеджери</option>
            {MANAGERS.filter((m) => m !== 'all').map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── TABLE ── */}
      {paged.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Search size={32} className="opacity-30 mb-3" />
          <p className="text-sm">Бронювань не знайдено.</p>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-2 text-sm text-blue-500 hover:underline">
              Скинути фільтри
            </button>
          )}
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800">
                {TABLE_HEADERS.map((h) => (
                  <th
                    key={h.key}
                    className={`
                      px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400
                      border-b border-slate-200 dark:border-slate-700 whitespace-nowrap
                      ${h.align === 'right' ? 'text-right' : h.align === 'center' ? 'text-center' : 'text-left'}
                    `}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((booking) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  isExpanded={expandedId === booking.id}
                  onToggleExpand={toggleExpand}
                  // RBAC: менеджер бачить кнопки дій, агент — ні
                  showActions={isAdmin || isManager || isOpsManager}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── PAGINATION ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>
            Показано {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} з {filtered.length}
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

export default BookingsPage;
