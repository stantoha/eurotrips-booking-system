// ============================================================
// EUROTRIPS — pages/TourDetail.tsx
// Маршрут: /tours/:id   Ролі: admin, director, manager, ops, accountant
// Мінімальна версія: інфо про тур + перехід до створення бронювання.
// cost_price/margin — тільки якщо canSeeMargin (BR-04).
// ============================================================

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, Users, Tag, Plus } from 'lucide-react';
import { useTour } from '../hooks/useTours';
import { useAuth } from '../hooks/useAuth';
import { TOUR_STATUS_CONFIG, STATUS_COLOR_CLASSES } from '../constants/statuses';

const TOUR_TYPE_LABELS: Record<string, string> = {
  bus: 'Автобусний', avia: 'Авіатур', combined: 'Комбінований',
};

const TourDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canSeeMargin } = useAuth();
  const { data: tour, isLoading, isError } = useTour(id ?? '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-brand-cyan">
        <div className="h-8 w-8 rounded-full border-2 border-brand-cyan border-t-transparent animate-spin mr-3" />
        <span className="text-sm text-slate-500 dark:text-slate-400">Завантаження туру…</span>
      </div>
    );
  }

  if (isError || !tour) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-sm text-brand-red">Тур не знайдено.</p>
        <button
          onClick={() => navigate('/tours')}
          className="px-4 py-2 rounded-pill text-sm font-semibold bg-brand-red text-white hover:bg-brand-red-dark transition-colors"
        >
          До каталогу турів
        </button>
      </div>
    );
  }

  const cfg = TOUR_STATUS_CONFIG[tour.status];
  const cc  = cfg ? STATUS_COLOR_CLASSES[cfg.colorVariant] : undefined;
  const occupied = tour.total_seats - tour.available_seats;
  const occPct   = tour.total_seats > 0 ? Math.round((occupied / tour.total_seats) * 100) : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/tours')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-4"
      >
        <ArrowLeft size={15} aria-hidden="true" /> До каталогу турів
      </button>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <code className="text-xs text-slate-400 font-mono">{tour.code}</code>
            {cfg && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cc?.badge} ${cfg.isPulsing ? 'animate-pulse' : ''}`}>
                {cfg.label}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{tour.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
            <MapPin size={13} aria-hidden="true" /> {tour.direction}
            {tour.countries?.length > 0 && ` · ${tour.countries.join(', ')}`}
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Calendar size={12} aria-hidden="true" /> Дати</p>
            <p className="text-sm text-slate-800 dark:text-slate-200">
              {new Date(tour.departure_date).toLocaleDateString('uk-UA')} — {new Date(tour.return_date).toLocaleDateString('uk-UA')}
              {' '}({tour.duration_days} д.)
            </p>
            <p className="text-xs text-slate-400 mt-1">{tour.departure_city} → {tour.arrival_city ?? tour.departure_city}</p>
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-1">Тип туру</p>
            <p className="text-sm text-slate-800 dark:text-slate-200">{TOUR_TYPE_LABELS[tour.tour_type] ?? tour.tour_type}</p>
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Users size={12} aria-hidden="true" /> Місця</p>
            <p className="text-sm text-slate-800 dark:text-slate-200">{tour.available_seats} вільно з {tour.total_seats}</p>
            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-1.5 max-w-[160px]">
              <div
                className={`h-full rounded-full ${occPct >= 95 ? 'bg-brand-red' : occPct >= 80 ? 'bg-brand-gold' : 'bg-brand-cyan'}`}
                style={{ width: `${occPct}%` }}
              />
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-1">Ціна</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {tour.base_price.toLocaleString('uk-UA')} {tour.currency}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              {(tour.agent_commission_pct * 100).toFixed(0)}% комісія агента
            </p>
            {canSeeMargin && tour.cost_price != null && (
              <p className="text-xs text-slate-400 mt-0.5">
                Собівартість: {tour.cost_price.toLocaleString('uk-UA')} {tour.currency}
                {' '}· Маржа: {(tour.base_price - tour.cost_price).toLocaleString('uk-UA')} {tour.currency}
              </p>
            )}
          </div>

          {tour.included && (
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-400 mb-1">Включено</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{tour.included}</p>
            </div>
          )}

          {tour.not_included && (
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-400 mb-1">Не включено</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{tour.not_included}</p>
            </div>
          )}

          {tour.tags?.length > 0 && (
            <div className="sm:col-span-2 flex items-center gap-1.5 flex-wrap">
              <Tag size={12} className="text-slate-400" aria-hidden="true" />
              {tour.tags.map((t) => (
                <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={() => navigate(`/bookings/new?tour=${tour.id}`)}
            disabled={tour.available_seats === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-pill text-sm font-semibold bg-brand-red text-white hover:bg-brand-red-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={15} aria-hidden="true" />
            {tour.available_seats === 0 ? 'Місць немає' : 'Забронювати'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TourDetailPage;
