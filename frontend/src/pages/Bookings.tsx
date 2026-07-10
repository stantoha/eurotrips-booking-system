// ============================================================
// EUROTRIPS — pages/Bookings.tsx
// Маршрут: /bookings   Ролі: admin, director, manager, ops, accountant
//
// Пошук:   booking_number (ET-YYYY-NNNNN) або contact_name
// Фільтри: status, manager_name, дата (тиждень/місяць/довільна)
//
// Таблиця:
//   • BookingRow з розгортанням деталей
//   • Пагінація 10/сторінку
//   • Статистика: загальний борг, кількість "очікують оплату"
//
// TODO: замінити MOCK_BOOKINGS на useBookings() (TanStack Query)
//       коли GET /api/v1/bookings відкрито на backend
// ============================================================

import React, { useState, useMemo, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Download, ChevronDown, ChevronUp,
  User, Building2, CreditCard, Coins, X,
} from 'lucide-react';

import { StatusBadge }   from '../components/ui/StatusBadge';
import { useAuth }        from '../hooks/useAuth';
import { useBookings }    from '../hooks/useBookings';
import {
  BOOKING_STATUS_CONFIG,
  STATUS_COLOR_CLASSES,
  BOOKING_TYPE_LABELS,
} from '../constants/statuses';
import type { Booking, BookingStatus } from '../types';

// ─── CONSTANTS ────────────────────────────────────────────────

const DATE_PRESETS = [
  { value: 'all',   label: 'Будь-яка дата'   },
  { value: 'week',  label: 'Цей тиждень'     },
  { value: 'month', label: 'Цей місяць'      },
] as const;

const PER_PAGE = 10;

// ─── HELPERS ──────────────────────────────────────────────────

const fmtEur = (n: number) => n.toLocaleString('uk-UA');

const bookingTypeIcon = (type: string) => {
  if (type === 'corporate') return <Building2 size={10} aria-hidden="true" />;
  if (type === 'group')     return <User size={10} aria-hidden="true" />;
  return <User size={10} aria-hidden="true" />;
};

// ─── EXPANDED DETAIL ──────────────────────────────────────────

const BookingDetail: React.FC<{ booking: Booking }> = ({ booking: b }) => (
  <tr>
    <td
      colSpan={9}
      className="px-4 pb-4 pt-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        {[
          ['Контакт',    b.contact_name],
          ['Агент',      b.agent_name ?? '—'],
          ['Депозит',    `${fmtEur(b.prepayment_amount)} EUR`],
          ['Сплачено',   `${fmtEur(b.amount_paid)} EUR`],
          ['Залишок',    b.balance_due > 0 ? `${fmtEur(b.balance_due)} EUR` : '—'],
          ['Комісія',    b.agent_commission_amount ? `${fmtEur(b.agent_commission_amount)} EUR` : '—'],
          ['Дедлайн опл.', b.payment_deadline ?? '—'],
          ['Примітки',   b.notes ?? '—'],
        ].map(([k, v]) => (
          <div key={k as string}>
            <p className="text-slate-400 dark:text-slate-500 mb-0.5">{k}</p>
            <p className="font-medium text-slate-700 dark:text-slate-300">{v}</p>
          </div>
        ))}
      </div>
    </td>
  </tr>
);

// ─── BOOKING ROW ──────────────────────────────────────────────

const BRow: React.FC<{
  booking:    Booking;
  expanded:   boolean;
  onToggle:   (id: string) => void;
  showAgent:  boolean;
}> = ({ booking: b, expanded, onToggle, showAgent }) => {
  const cfg = BOOKING_STATUS_CONFIG[b.status];
  const cc  = cfg ? STATUS_COLOR_CLASSES[cfg.colorVariant] : STATUS_COLOR_CLASSES.neutral;

  return (
    <Fragment key={b.id}>
      <tr
        className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
        onClick={() => onToggle(b.id)}
      >
        {/* Номер бронювання */}
        <td className="px-3 py-2.5">
          <code className="text-xs font-mono text-blue-600 dark:text-blue-400">{b.booking_number}</code>
          <p className="text-xs text-slate-400 mt-0.5">{b.tour_date}</p>
        </td>

        {/* Турист */}
        <td className="px-3 py-2.5">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate max-w-[140px]">
            {b.contact_name}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{b.pax_count} ос.</p>
        </td>

        {/* Тур */}
        <td className="px-3 py-2.5 max-w-[130px]">
          <p className="text-xs text-slate-700 dark:text-slate-300 truncate">{b.tour_name}</p>
        </td>

        {/* Тип */}
        <td className="px-3 py-2.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
            {bookingTypeIcon(b.booking_type)}
            {BOOKING_TYPE_LABELS[b.booking_type] ?? b.booking_type}
          </span>
        </td>

        {/* Сума */}
        <td className="px-3 py-2.5 text-right">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {fmtEur(b.total_price)} EUR
          </p>
        </td>

        {/* Залишок */}
        <td className="px-3 py-2.5 text-right">
          {b.balance_due > 0 ? (
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              {fmtEur(b.balance_due)} EUR
            </p>
          ) : (
            <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>
          )}
        </td>

        {/* Статус */}
        <td className="px-3 py-2.5">
          <StatusBadge status={b.status} domain="booking" size="xs" />
        </td>

        {/* Менеджер */}
        <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">
          {b.manager_name}
        </td>

        {/* Expand toggle */}
        <td className="px-3 py-2.5 text-slate-400">
          {expanded
            ? <ChevronUp   size={14} aria-hidden="true" />
            : <ChevronDown size={14} aria-hidden="true" />
          }
        </td>
      </tr>

      {expanded && <BookingDetail booking={b} />}
    </Fragment>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────

const BookingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, isDirector, isManager, canSeeAllAgents } = useAuth();
  // На цій сторінці бувають тільки internal-ролі (ops/accountant теж),
  // але POST /bookings на бекенді дозволено лише admin/manager — узгоджено
  const canCreate = isAdmin || isManager;
  const canExport = isAdmin || isDirector || isManager;

  // ── Filter state ───────────────────────────────────────────
  const [query,      setQuery]     = useState('');
  const [statusF,    setStatusF]   = useState<BookingStatus | 'all'>('all');
  const [managerF,   setManagerF]  = useState('all');
  const [datePreset, setDatePreset] = useState('all');
  const [page,       setPage]      = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── TanStack Query ─────────────────────────────────────────
  const { data: bookingsData, isLoading, isError, refetch } = useBookings();
  const bookings: Booking[] = bookingsData?.data ?? [];

  // ── Manager options (з реальних даних, а не хардкод) ───────
  const managerOptions = useMemo(() => {
    const set = new Set(bookings.map((b) => b.manager_name).filter(Boolean));
    return Array.from(set).sort();
  }, [bookings]);

  // ── Filtered data ──────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings.filter((b: Booking) => {
      // Status
      if (statusF !== 'all' && b.status !== statusF) return false;
      // Manager
      if (managerF !== 'all' && b.manager_name !== managerF) return false;
      // Search: ET-номер або ім'я
      if (q) {
        const hit = b.booking_number.toLowerCase().includes(q)
          || b.contact_name.toLowerCase().includes(q)
          || b.tour_name.toLowerCase().includes(q)
          || (b.agent_name ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [bookings, query, statusF, managerF]);

  // ── Derived stats ──────────────────────────────────────────
  const totalDebt    = useMemo(() => filtered.reduce((s, b) => s + b.balance_due, 0), [filtered]);
  const pendingCount = useMemo(
    () => filtered.filter((b) => b.status === 'awaiting_payment' || b.status === 'partially_paid').length,
    [filtered],
  );

  // ── Pagination ─────────────────────────────────────────────
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged      = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // ── Handlers ───────────────────────────────────────────────
  const resetPage = useCallback(() => { setPage(1); setExpandedId(null); }, []);
  const handleQ   = useCallback((v: string) => { setQuery(v);    resetPage(); }, [resetPage]);
  const handleSt  = useCallback((v: string) => { setStatusF(v as BookingStatus | 'all'); resetPage(); }, [resetPage]);
  const handleMgr = useCallback((v: string) => { setManagerF(v); resetPage(); }, [resetPage]);

  const toggle = useCallback((id: string) => {
    setExpandedId((p) => (p === id ? null : id));
  }, []);

  const clear = () => { setQuery(''); setStatusF('all'); setManagerF('all'); setDatePreset('all'); setPage(1); setExpandedId(null); };
  const hasF  = query || statusF !== 'all' || managerF !== 'all';

  const selClass = 'px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer';

  return (
    <div className="p-6 max-w-screen-xl mx-auto">

      {/* ── HEADER ── */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-medium text-slate-900 dark:text-slate-100">Бронювання</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {filtered.length} записів
            {totalDebt > 0 && (
              <> · Борг:{' '}
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  {fmtEur(totalDebt)} EUR
                </span>
              </>
            )}
            {pendingCount > 0 && (
              <> · Очікують оплати:{' '}
                <span className="text-orange-600 font-medium">{pendingCount}</span>
              </>
            )}
            {hasF && (
              <button onClick={clear} className="ml-2 text-blue-500 hover:underline inline-flex items-center gap-1 text-xs">
                <X size={10} /> Скинути
              </button>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {canExport && (
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <Download size={14} aria-hidden="true" /> Експорт
            </button>
          )}
          {canCreate && (
            <button
              onClick={() => navigate('/bookings/new')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 transition-colors"
            >
              <Plus size={14} aria-hidden="true" /> Нове бронювання
            </button>
          )}
        </div>
      </div>

      {/* ── FILTERS ── */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">

        {/* Search — ET-номер або ім'я */}
        <div className="relative flex-1 min-w-[220px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => handleQ(e.target.value)}
            placeholder="ET-2025-NNNNN або ім'я туриста..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Статус */}
        <select value={statusF} onChange={(e) => handleSt(e.target.value)} className={selClass}>
          <option value="all">Всі статуси</option>
          {(Object.keys(BOOKING_STATUS_CONFIG) as BookingStatus[]).map((s) => (
            <option key={s} value={s}>{BOOKING_STATUS_CONFIG[s].label}</option>
          ))}
        </select>

        {/* Менеджер — тільки для тих, хто бачить чужі заявки */}
        {canSeeAllAgents && (
          <select value={managerF} onChange={(e) => handleMgr(e.target.value)} className={selClass}>
            <option value="all">Всі менеджери</option>
            {managerOptions.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}

        {/* Дата */}
        <select value={datePreset} onChange={(e) => setDatePreset(e.target.value)} className={selClass}>
          {DATE_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {/* ── LOADING / ERROR ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 text-brand-cyan">
          <div className="h-8 w-8 rounded-full border-2 border-brand-cyan border-t-transparent animate-spin mr-3" />
          <span className="text-sm text-slate-500 dark:text-slate-400">Завантаження бронювань…</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm text-brand-red">Не вдалося завантажити бронювання.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-pill text-sm font-semibold bg-brand-red text-white hover:bg-brand-red-dark transition-colors"
          >
            Спробувати ще раз
          </button>
        </div>
      )}

      {/* ── TABLE ── */}
      {!isLoading && !isError && (paged.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Search size={32} className="opacity-30 mb-3" aria-hidden="true" />
          <p className="text-sm">Бронювань не знайдено.</p>
          {hasF && (
            <button onClick={clear} className="mt-2 text-sm text-blue-500 hover:underline">
              Скинути фільтри
            </button>
          )}
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800">
                {[
                  ['№ Бронювання', ''],
                  ['Турист',       ''],
                  ['Тур',          ''],
                  ['Тип',          ''],
                  ['Сума EUR',     'text-right'],
                  ['Залишок',      'text-right'],
                  ['Статус',       ''],
                  ['Менеджер',     ''],
                  ['',             'w-6'],
                ].map(([h, cls], i) => (
                  <th
                    key={i}
                    className={`px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap ${cls}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((b) => (
                <BRow
                  key={b.id}
                  booking={b}
                  expanded={expandedId === b.id}
                  onToggle={toggle}
                  showAgent={canSeeAllAgents}
                />
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* ── PAGINATION ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>
            {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} з {filtered.length}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button key={n} onClick={() => setPage(n)}
                className={`px-2.5 py-1.5 rounded-md border text-xs transition-colors ${
                  page === n
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent font-medium'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}>
                {n}
              </button>
            ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">›</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingsPage;
