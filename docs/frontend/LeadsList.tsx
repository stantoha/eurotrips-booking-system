// ============================================================
// EUROTRIPS — pages/LeadsList.tsx
// Маршрут: /leads
// Ролі: admin, director, manager (всі), ops_manager (свої)
//
// Фічі:
//   • Таблиця лідів з фільтрами: статус, джерело, менеджер, дата, пошук
//   • Сортування по стовпцях: дата, статус, ПІБ
//   • Пагінація (10/20/50 на сторінку)
//   • "Конвертувати в бронювання" → PATCH /leads/:id/convert (TanStack mutation)
//   • Статус "won" та "lost" — термінальні, без конвертації
//   • BR-04 не застосовується (ліди — без фінансів)
// ============================================================

import React, { useState, useMemo, useCallback } from 'react';
import {
  Search, Filter, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Plus, ArrowRight, RefreshCw, Loader2, Instagram, Globe, Phone,
  Mail, Users, Calendar, CheckCircle2, AlertTriangle, User,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth }     from '../hooks/useAuth';
import { api }         from '../services/api';
import { MOCK_LEADS }  from '../mocks';
import type { Lead, LeadStatus, LeadSource } from '../types';

// ─── CONSTANTS ────────────────────────────────────────────────

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string }> = {
  new:                 { label: 'Новий',              color: 'bg-blue-50   text-blue-700   border-blue-200   dark:bg-blue-950/40   dark:text-blue-300   dark:border-blue-800'   },
  in_work:             { label: 'В роботі',           color: 'bg-cyan-50   text-cyan-700   border-cyan-200   dark:bg-cyan-950/40   dark:text-cyan-300   dark:border-cyan-800'   },
  needs_clarification: { label: 'Уточнення',          color: 'bg-amber-50  text-amber-700  border-amber-200  dark:bg-amber-950/30  dark:text-amber-400  dark:border-amber-800'  },
  proposal_sent:       { label: 'КП надіслано',       color: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800' },
  waiting_decision:    { label: 'Чекає рішення',      color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800' },
  won:                 { label: 'Конвертовано',        color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' },
  lost:                { label: 'Програно',            color: 'bg-slate-100  text-slate-500  border-slate-200  dark:bg-slate-800     dark:text-slate-400  dark:border-slate-700'  },
};

const SOURCE_CONFIG: Record<LeadSource, { label: string; icon: React.ReactNode; color: string }> = {
  site:       { label: 'Сайт',      icon: <Globe     size={11} />, color: 'bg-blue-50   text-blue-600   dark:bg-blue-950/30   dark:text-blue-400'   },
  instagram:  { label: 'Instagram', icon: <Instagram size={11} />, color: 'bg-pink-50   text-pink-600   dark:bg-pink-950/30   dark:text-pink-400'   },
  facebook:   { label: 'Facebook',  icon: <Globe     size={11} />, color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400' },
  telegram:   { label: 'Telegram',  icon: <Globe     size={11} />, color: 'bg-sky-50    text-sky-600    dark:bg-sky-950/30    dark:text-sky-400'    },
  viber:      { label: 'Viber',     icon: <Phone     size={11} />, color: 'bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400' },
  phone:      { label: 'Телефон',   icon: <Phone     size={11} />, color: 'bg-slate-100 text-slate-600  dark:bg-slate-800     dark:text-slate-400'  },
  email:      { label: 'Email',     icon: <Mail      size={11} />, color: 'bg-slate-100 text-slate-600  dark:bg-slate-800     dark:text-slate-400'  },
  agent:      { label: 'Агент',     icon: <User      size={11} />, color: 'bg-amber-50  text-amber-600  dark:bg-amber-950/30  dark:text-amber-400'  },
  corporate:  { label: 'Корпорат.', icon: <Users     size={11} />, color: 'bg-teal-50   text-teal-600   dark:bg-teal-950/30   dark:text-teal-400'   },
  repeat:     { label: 'Повторний', icon: <RefreshCw size={11} />, color: 'bg-green-50  text-green-600  dark:bg-green-950/30  dark:text-green-400'  },
};

const TERMINAL_STATUSES: LeadStatus[] = ['won', 'lost'];
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

// ─── MOCK MANAGER MAP ─────────────────────────────────────────
// TODO: підтягнути з GET /users?role=manager
const MANAGERS: Record<string, string> = {
  'usr-m01': 'Андрій Сич',
  'usr-m02': 'Олена Романюк',
};

// ─── HELPERS ──────────────────────────────────────────────────
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('uk-UA', { day:'2-digit', month:'2-digit', year:'2-digit' });

const leadName = (l: Lead) => {
  if (l.first_name || l.last_name) return [l.last_name, l.first_name].filter(Boolean).join(' ');
  return l.email ?? l.phone ?? '—';
};

// ─── API HOOKS ────────────────────────────────────────────────

interface LeadFilters {
  search?:    string;
  status?:    LeadStatus;
  source?:    LeadSource;
  manager?:   string;
  date_from?: string;
  date_to?:   string;
  page?:      number;
  per_page?:  number;
}

/** useLeads — підтягує ліди з API або fallback-мок у DEV */
function useLeads(filters?: LeadFilters) {
  return useQuery({
    queryKey: ['leads', 'list', filters ?? {}],
    queryFn: async () => {
      try {
        const { data } = await api.get<{ data: Lead[]; meta: { total: number } }>(
          '/leads', { params: filters },
        );
        return data;
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[useLeads] API unavailable → mock fallback');
          let result = [...MOCK_LEADS];
          const q = filters?.search?.toLowerCase().trim() ?? '';
          if (q)              result = result.filter(l => leadName(l).toLowerCase().includes(q) || l.phone?.includes(q) || l.email?.toLowerCase().includes(q));
          if (filters?.status)   result = result.filter(l => l.status  === filters.status);
          if (filters?.source)   result = result.filter(l => l.source  === filters.source);
          if (filters?.manager)  result = result.filter(l => l.assigned_to === filters.manager);
          if (filters?.date_from) result = result.filter(l => l.created_at >= filters.date_from!);
          if (filters?.date_to)   result = result.filter(l => l.created_at <= filters.date_to! + 'T23:59:59Z');
          const total   = result.length;
          const page    = filters?.page ?? 1;
          const perPage = filters?.per_page ?? 10;
          result = result.slice((page - 1) * perPage, page * perPage);
          return { data: result, meta: { total } };
        }
        throw err;
      }
    },
    staleTime:  30_000,
    placeholderData: (prev) => prev,
  });
}

/** useConvertLead — PATCH /leads/:id/convert */
function useConvertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string) => {
      const { data } = await api.patch<{ data: { booking_id: string; booking_number: string } }>(
        `/leads/${leadId}/convert`,
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err) => {
      console.error('[useConvertLead] failed:', err);
    },
  });
}

// ─── STATUS BADGE ─────────────────────────────────────────────
const LeadStatusBadge: React.FC<{ status: LeadStatus }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium whitespace-nowrap ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};

// ─── SOURCE BADGE ─────────────────────────────────────────────
const SourceBadge: React.FC<{ source: LeadSource }> = ({ source }) => {
  const cfg = SOURCE_CONFIG[source];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
};

// ─── FILTER SELECT ────────────────────────────────────────────
const FilterSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  className?: string;
}> = ({ value, onChange, options, placeholder, className = '' }) => (
  <div className="relative">
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`appearance-none pl-3 pr-7 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <ChevronDown size={12} className="absolute right-2.5 top-3 text-slate-400 pointer-events-none" />
  </div>
);

// ─── SORT HEADER ──────────────────────────────────────────────
const SortHeader: React.FC<{
  label: string;
  sortKey: string;
  current: string;
  direction: 'asc' | 'desc';
  onSort: (key: string) => void;
}> = ({ label, sortKey, current, direction, onSort }) => (
  <button
    onClick={() => onSort(sortKey)}
    className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap"
  >
    {label}
    {current === sortKey
      ? direction === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
      : <span className="w-2.5" />
    }
  </button>
);

// ─── CONVERT BUTTON ───────────────────────────────────────────
const ConvertButton: React.FC<{
  lead: Lead;
  onNavigate: (bookingId: string) => void;
}> = ({ lead, onNavigate }) => {
  const mutation = useConvertLead();
  const [converted, setConverted] = useState<{ bookingId: string; number: string } | null>(null);

  if (TERMINAL_STATUSES.includes(lead.status)) {
    if (lead.status === 'won' && lead.booking_id) {
      return (
        <button
          onClick={() => onNavigate(lead.booking_id!)}
          className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          <CheckCircle2 size={11} /> Перейти до броні
        </button>
      );
    }
    return null;
  }

  if (converted) {
    return (
      <button
        onClick={() => onNavigate(converted.bookingId)}
        className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
      >
        <CheckCircle2 size={11} /> {converted.number}
      </button>
    );
  }

  return (
    <button
      onClick={async () => {
        try {
          const res = await mutation.mutateAsync(lead.id);
          setConverted({ bookingId: res.booking_id, number: res.booking_number });
        } catch {/* handled in mutation.onError */}
      }}
      disabled={mutation.isPending}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
    >
      {mutation.isPending
        ? <><Loader2 size={11} className="animate-spin" /> Конвертація…</>
        : <><ArrowRight size={11} /> Конвертувати</>
      }
    </button>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────

interface LeadsListProps {
  onOpenBooking?: (bookingId: string) => void;
  onNewLead?:     () => void;
}

const LeadsList: React.FC<LeadsListProps> = ({ onOpenBooking, onNewLead }) => {
  const { isAdmin, isManager, isOpsManager, user } = useAuth();

  // ── Filters state ─────────────────────────────────────────
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState<LeadStatus | ''>('');
  const [source,   setSource]   = useState<LeadSource | ''>('');
  const [manager,  setManager]  = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [page,     setPage]     = useState(1);
  const [perPage,  setPerPage]  = useState<typeof PAGE_SIZE_OPTIONS[number]>(10);
  const [sortBy,   setSortBy]   = useState('created_at');
  const [sortDir,  setSortDir]  = useState<'asc' | 'desc'>('desc');

  const activeFiltersCount = [search, status, source, manager, dateFrom, dateTo].filter(Boolean).length;

  const clearFilters = () => {
    setSearch(''); setStatus(''); setSource(''); setManager('');
    setDateFrom(''); setDateTo(''); setPage(1);
  };

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
    setPage(1);
  };

  // ── Data ──────────────────────────────────────────────────
  const filters: LeadFilters = useMemo(() => ({
    ...(search   && { search   }),
    ...(status   && { status   }),
    ...(source   && { source   }),
    ...(manager  && { manager  }),
    ...(dateFrom && { date_from: dateFrom }),
    ...(dateTo   && { date_to:   dateTo   }),
    page,
    per_page: perPage,
  }), [search, status, source, manager, dateFrom, dateTo, page, perPage]);

  const { data, isLoading, isError, refetch, isFetching } = useLeads(filters);
  const leads = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // ── Client-side sort (для mock; сервер сортує нативно) ────
  const sorted = useMemo(() => {
    if (!leads.length) return leads;
    return [...leads].sort((a, b) => {
      let av = '', bv = '';
      if (sortBy === 'created_at')   { av = a.created_at;     bv = b.created_at;    }
      if (sortBy === 'name')         { av = leadName(a);       bv = leadName(b);      }
      if (sortBy === 'status')       { av = a.status;          bv = b.status;         }
      if (sortBy === 'next_contact') { av = a.next_contact_at ?? ''; bv = b.next_contact_at ?? ''; }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [leads, sortBy, sortDir]);

  const handleNavigate = useCallback((bookingId: string) => {
    onOpenBooking?.(bookingId);
  }, [onOpenBooking]);

  return (
    <div className="p-6 max-w-screen-xl mx-auto">

      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Ліди</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isLoading ? '…' : `${total} ${total === 1 ? 'лід' : total < 5 ? 'ліди' : 'лідів'}`}
            {isFetching && !isLoading && <span className="ml-2 text-slate-400"><Loader2 size={11} className="inline animate-spin" /></span>}
          </p>
        </div>
        <button
          onClick={onNewLead}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-80 transition-opacity"
        >
          <Plus size={14} /> Новий лід
        </button>
      </div>

      {/* ── FILTERS ── */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 mb-4 bg-white dark:bg-slate-900">
        <div className="flex flex-wrap gap-2 items-center">

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Пошук: ПІБ, телефон, email…"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status */}
          <FilterSelect
            value={status}
            onChange={v => { setStatus(v as LeadStatus | ''); setPage(1); }}
            placeholder="Статус"
            options={Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
          />

          {/* Source */}
          <FilterSelect
            value={source}
            onChange={v => { setSource(v as LeadSource | ''); setPage(1); }}
            placeholder="Джерело"
            options={Object.entries(SOURCE_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
          />

          {/* Manager (тільки admin/director) */}
          {(isAdmin || isManager) && (
            <FilterSelect
              value={manager}
              onChange={v => { setManager(v); setPage(1); }}
              placeholder="Менеджер"
              options={Object.entries(MANAGERS).map(([v, label]) => ({ value: v, label }))}
            />
          )}

          {/* Date from */}
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Дата від"
          />
          <span className="text-slate-400 text-sm">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Дата до"
          />

          {/* Clear */}
          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={11} /> Скинути ({activeFiltersCount})
            </button>
          )}
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-32" />
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-48" />
                </div>
                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-20" />
                <div className="h-5 bg-slate-100 dark:bg-slate-800 rounded w-24" />
                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-16" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center py-12 text-slate-400">
            <AlertTriangle size={28} className="mb-2 text-red-400" />
            <p className="text-sm mb-3">Помилка завантаження лідів</p>
            <button onClick={() => refetch()} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <RefreshCw size={11} /> Повторити
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <Filter size={28} className="mb-2 opacity-40" />
            <p className="text-sm">Лідів за фільтрами не знайдено</p>
            {activeFiltersCount > 0 && (
              <button onClick={clearFilters} className="mt-2 text-xs text-blue-500 hover:underline">Скинути фільтри</button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              {/* Header */}
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  {[
                    { key: 'name',         label: 'ПІБ / Контакт'    },
                    { key: 'source',       label: 'Джерело'           },
                    { key: 'status',       label: 'Статус'            },
                    { key: null,           label: 'Тур'               },
                    { key: null,           label: 'Менеджер'          },
                    { key: 'next_contact', label: 'Наступний контакт' },
                    { key: 'created_at',   label: 'Дата'              },
                    { key: null,           label: ''                  },
                  ].map((col, i) => (
                    <th key={i} className="px-4 py-2.5 text-left border-b border-slate-200 dark:border-slate-700">
                      {col.key ? (
                        <SortHeader
                          label={col.label}
                          sortKey={col.key}
                          current={sortBy}
                          direction={sortDir}
                          onSort={handleSort}
                        />
                      ) : (
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {col.label}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Rows */}
              <tbody>
                {sorted.map(lead => (
                  <tr
                    key={lead.id}
                    className="border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* ПІБ / Контакт */}
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {leadName(lead)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                        {lead.phone && <span>{lead.phone}</span>}
                        {lead.email && <span className="truncate max-w-[140px]">{lead.email}</span>}
                        {lead.pax_count > 1 && (
                          <span className="flex items-center gap-1">
                            <Users size={10} />{lead.pax_count} ос.
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Джерело */}
                    <td className="px-4 py-3">
                      <SourceBadge source={lead.source} />
                    </td>

                    {/* Статус */}
                    <td className="px-4 py-3">
                      <LeadStatusBadge status={lead.status} />
                      {lead.status === 'lost' && lead.lost_reason && (
                        <p className="text-xs text-slate-400 mt-0.5 max-w-[160px] truncate" title={lead.lost_reason}>
                          {lead.lost_reason}
                        </p>
                      )}
                    </td>

                    {/* Тур */}
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {lead.tour_id
                        ? <span className="text-xs">{lead.tour_date ?? '—'}</span>
                        : <span className="text-xs text-slate-300 dark:text-slate-600">Не обрано</span>}
                      {lead.budget_eur && (
                        <span className="block text-xs text-slate-400">до {lead.budget_eur.toLocaleString()} EUR</span>
                      )}
                    </td>

                    {/* Менеджер */}
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {lead.assigned_to ? MANAGERS[lead.assigned_to] ?? lead.assigned_to : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>

                    {/* Наступний контакт */}
                    <td className="px-4 py-3">
                      {lead.next_contact_at ? (
                        <span className={`flex items-center gap-1 text-xs whitespace-nowrap ${
                          new Date(lead.next_contact_at) < new Date()
                            ? 'text-red-500 dark:text-red-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}>
                          <Calendar size={11} />
                          {fmtDate(lead.next_contact_at)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>

                    {/* Дата */}
                    <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {fmtDate(lead.created_at)}
                    </td>

                    {/* Дії */}
                    <td className="px-4 py-3">
                      <ConvertButton lead={lead} onNavigate={handleNavigate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── PAGINATION ── */}
      {total > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <span>На сторінці:</span>
            {PAGE_SIZE_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => { setPerPage(n); setPage(1); }}
                className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                  perPage === n
                    ? 'border-slate-900 dark:border-slate-100 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {((page - 1) * perPage) + 1}–{Math.min(page * perPage, total)} з {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              {/* Page numbers — показуємо max 5 */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs border transition-colors ${
                      page === p
                        ? 'border-slate-900 dark:border-slate-100 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadsList;
