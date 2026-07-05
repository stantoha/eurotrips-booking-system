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
import { Search, AlertTriangle } from 'lucide-react';

import { useTours } from '../hooks/useTours';
import { StatusBadge } from '../components/ui/StatusBadge';
import { OccupancyBar, occupancyPct } from '../components/ui/OccupancyBar';
import { DeadlineIndicator } from '../components/ui/DeadlineIndicator';
import type { Tour, TourStatus } from '../types';

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
            {tour.departure_date} → {tour.duration_days ? `+${tour.duration_days}д` : ''}
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
  const [statusF, setStatusF] = useState<TourStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useTours({
    status: statusF === 'all' ? undefined : statusF,
    search: search || undefined,
    limit: 50,
  });

  const tours = useMemo(() => data?.data ?? [], [data]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Операційний відділ</h1>
      </div>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">
        Реєстр виїздів. Бізнес-правила: BR-09 (структура румінгів), BR-10 (валідація), BR-11 (BullMQ), BR-12 (самосервіс туристів), OPS-18 (чекліст готовності).
      </p>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
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

      {!isLoading && !isError && tours.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">Виїздів за обраними фільтрами не знайдено.</p>
        </div>
      )}

      {!isLoading && tours.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tours.map((tour) => (
            <OpsTourCard key={tour.id} tour={tour} onOpen={(id) => navigate(`/tours/${id}`)} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Operations;
