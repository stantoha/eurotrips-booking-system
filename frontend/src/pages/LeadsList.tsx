// ============================================================
// EUROTRIPS — pages/LeadsList.tsx
// Маршрут: /leads
// Ролі: admin, director, manager (всі), ops_manager (свої)
//
// Kanban-дошка за макетом Eurotrips Prototype.dc.html: 7 колонок
// (по одній на LeadStatus), drag-and-drop між колонками через
// @dnd-kit/core. Перетягування в колонку "won" запускає той самий
// флоу конвертації (useConvertLead), що й раніше кнопка
// "Конвертувати" — бо won у цій системі означає "конвертовано",
// а не просто зміну статусу. Перетягування в будь-яку іншу колонку
// (включно з lost) — нова мутація useUpdateLeadStatus (PUT /leads/:id,
// бекенд приймає status без перевірки переходів, на відміну від BR-06
// для бронювань). Картки зі статусом won/lost більше не draggable.
//
// Пагінацію прибрано — дошка одним запитом (limit=100, без фільтра
// статусу) підвантажує ліди і розподіляє їх по колонках на клієнті;
// понад 100 лідів по системі дошка не покаже (потрібен бекенд-ендпоінт
// агрегації/пагінації по колонках для точності при більшому масштабі).
//
// Виправлено під час перебудови: фільтри реально надсилались під
// невірними іменами (manager/date_from/date_to/per_page), тоді як
// бекенд (leads.schema.ts) очікує managerId/dateFrom/dateTo/limit —
// раніше ці фільтри тихо не спрацьовували проти реального API.
// ============================================================

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext, useDraggable, useDroppable, DragOverlay,
  PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import {
  Search, X, ChevronDown, Plus, RefreshCw, Loader2, Instagram, Globe, Phone,
  Mail, Users, AlertTriangle, User, CheckCircle2,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth }     from '../hooks/useAuth';
import { api }         from '../services/api';
import { LEAD_STATUS_CONFIG, STATUS_COLOR_CLASSES } from '../constants/statuses';
import type { Lead, LeadStatus, LeadSource } from '../types';

// ─── SOURCE CONFIG ────────────────────────────────────────────

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

// TODO: підтягнути з GET /users?role=manager
const MANAGERS: Record<string, string> = {
  'usr-m01': 'Андрій Сич',
  'usr-m02': 'Олена Романюк',
};

// ─── HELPERS ──────────────────────────────────────────────────

const leadName = (l: Lead) => {
  if (l.first_name || l.last_name) return [l.last_name, l.first_name].filter(Boolean).join(' ');
  return l.email ?? l.phone ?? '—';
};

// ─── API HOOKS ────────────────────────────────────────────────

interface LeadFilters {
  search?:    string;
  source?:    LeadSource;
  managerId?: string;
  dateFrom?:  string;
  dateTo?:    string;
}

/** useLeads — один запит на всю дошку (limit=100, без фільтра статусу) */
function useLeads(filters: LeadFilters) {
  return useQuery({
    queryKey: ['leads', 'kanban', filters],
    queryFn: async () => {
      const { data } = await api.get<{ data: Lead[]; meta: { total: number } }>('/leads', {
        params: { ...filters, limit: 100 },
      });
      return data;
    },
    staleTime: 30_000,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
    onError: (err) => console.error('[useConvertLead] failed:', err),
  });
}

/** useUpdateLeadStatus — PUT /leads/:id (без перевірки переходів на бекенді) */
function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const { data } = await api.put<{ data: Lead }>(`/leads/${id}`, { status });
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
    onError: (err) => console.error('[useUpdateLeadStatus] failed:', err),
  });
}

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
}> = ({ value, onChange, options, placeholder }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none pl-3 pr-7 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-cyan"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <ChevronDown size={12} className="absolute right-2.5 top-3 text-slate-400 pointer-events-none" />
  </div>
);

// ─── LEAD CARD ────────────────────────────────────────────────

const LeadCard: React.FC<{ lead: Lead; onOpenBooking: (bookingId: string) => void }> = ({ lead, onOpenBooking }) => {
  const isTerminal = TERMINAL_STATUSES.includes(lead.status);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { status: lead.status },
    disabled: isTerminal,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isTerminal ? {} : listeners)}
      {...(isTerminal ? {} : attributes)}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 ${
        isTerminal ? '' : 'cursor-grab active:cursor-grabbing'
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{leadName(lead)}</p>
      <p className="text-xs text-slate-400 truncate mt-0.5">{lead.tour?.name ?? 'Тур не обрано'}</p>
      <div className="flex items-center justify-between mt-2 gap-2">
        <SourceBadge source={lead.source} />
        {lead.budget_eur !== undefined && (
          <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 flex-shrink-0">
            {lead.budget_eur.toLocaleString('uk-UA')} EUR
          </span>
        )}
      </div>
      {lead.status === 'won' && lead.booking_id && (
        <button
          onClick={() => onOpenBooking(lead.booking_id!)}
          className="mt-2 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          <CheckCircle2 size={11} /> Перейти до броні
        </button>
      )}
      {lead.status === 'lost' && lead.lost_reason && (
        <p className="text-xs text-slate-400 mt-1.5 truncate" title={lead.lost_reason}>{lead.lost_reason}</p>
      )}
    </div>
  );
};

// ─── LEAD COLUMN ──────────────────────────────────────────────

const LeadColumn: React.FC<{
  status: LeadStatus;
  leads: Lead[];
  onOpenBooking: (bookingId: string) => void;
}> = ({ status, leads, onOpenBooking }) => {
  const cfg = LEAD_STATUS_CONFIG[status];
  const color = STATUS_COLOR_CLASSES[cfg.colorVariant];
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="w-[230px] flex-shrink-0 flex flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${color.dot}`} />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{cfg.label}</span>
        </div>
        <span className="font-mono text-xs text-slate-400">{leads.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-2 rounded-lg p-1.5 min-h-[80px] transition-colors ${
          isOver ? 'bg-brand-cyan/10 ring-2 ring-brand-cyan/40' : ''
        }`}
      >
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onOpenBooking={onOpenBooking} />
        ))}
      </div>
    </div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────

interface LeadsListProps {
  onNewLead?: () => void;
}

const LeadsList: React.FC<LeadsListProps> = ({ onNewLead }) => {
  const { isAdmin, isManager } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch]       = useState('');
  const [source, setSource]       = useState<LeadSource | ''>('');
  const [managerId, setManagerId] = useState('');
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');

  const activeFiltersCount = [search, source, managerId, dateFrom, dateTo].filter(Boolean).length;
  const clearFilters = () => { setSearch(''); setSource(''); setManagerId(''); setDateFrom(''); setDateTo(''); };

  const filters: LeadFilters = useMemo(() => ({
    ...(search    && { search }),
    ...(source    && { source }),
    ...(managerId && { managerId }),
    ...(dateFrom  && { dateFrom }),
    ...(dateTo    && { dateTo }),
  }), [search, source, managerId, dateFrom, dateTo]);

  const { data, isLoading, isError, refetch, isFetching } = useLeads(filters);
  const leads = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  const leadsByStatus = useMemo(() => {
    const grouped = Object.fromEntries(
      Object.keys(LEAD_STATUS_CONFIG).map((s) => [s, [] as Lead[]]),
    ) as Record<LeadStatus, Lead[]>;
    for (const lead of leads) {
      if (lead.status in grouped) grouped[lead.status].push(lead);
    }
    return grouped;
  }, [leads]);

  const convertLead = useConvertLead();
  const updateStatus = useUpdateLeadStatus();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const activeLead = activeId ? leads.find((l) => l.id === activeId) ?? null : null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const leadId = String(active.id);
    const fromStatus = active.data.current?.status as LeadStatus | undefined;
    const toStatus = over.id as LeadStatus;
    if (!fromStatus || fromStatus === toStatus) return;

    if (toStatus === 'won') {
      convertLead.mutate(leadId);
    } else {
      updateStatus.mutate({ id: leadId, status: toStatus });
    }
  };

  return (
    <div className="p-6 max-w-screen-2xl mx-auto">

      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-heading text-xl font-semibold text-slate-900 dark:text-slate-100">CRM · Ліди</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isLoading ? '…' : `${total} ${total === 1 ? 'лід' : total < 5 ? 'ліди' : 'лідів'}`}
            {isFetching && !isLoading && <span className="ml-2 text-slate-400"><Loader2 size={11} className="inline animate-spin" /></span>}
          </p>
        </div>
        <button
          onClick={onNewLead}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-brand-cyan text-brand-dark hover:bg-brand-cyan-dark transition-colors"
        >
          <Plus size={14} /> Новий лід
        </button>
      </div>

      {/* ── FILTERS ── */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 mb-4 bg-white dark:bg-slate-900">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук: ПІБ, телефон, email…"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-cyan"
            />
          </div>

          <FilterSelect
            value={source}
            onChange={(v) => setSource(v as LeadSource | '')}
            placeholder="Джерело"
            options={Object.entries(SOURCE_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
          />

          {(isAdmin || isManager) && (
            <FilterSelect
              value={managerId}
              onChange={setManagerId}
              placeholder="Менеджер"
              options={Object.entries(MANAGERS).map(([v, label]) => ({ value: v, label }))}
            />
          )}

          <input
            type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-cyan"
            title="Дата від"
          />
          <span className="text-slate-400 text-sm">—</span>
          <input
            type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-cyan"
            title="Дата до"
          />

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

      {/* ── BOARD ── */}
      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="w-[230px] flex-shrink-0 space-y-2 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24" />
              <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-lg" />
              <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-lg" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center py-16 text-slate-400">
          <AlertTriangle size={28} className="mb-2 text-brand-red" />
          <p className="text-sm mb-3">Помилка завантаження лідів</p>
          <button onClick={() => refetch()} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <RefreshCw size={11} /> Повторити
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {(Object.keys(LEAD_STATUS_CONFIG) as LeadStatus[]).map((status) => (
              <LeadColumn
                key={status}
                status={status}
                leads={leadsByStatus[status]}
                onOpenBooking={(bookingId) => navigate(`/bookings/${bookingId}`)}
              />
            ))}
          </div>
          <DragOverlay>
            {activeLead && <LeadCard lead={activeLead} onOpenBooking={() => {}} />}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
};

export default LeadsList;
