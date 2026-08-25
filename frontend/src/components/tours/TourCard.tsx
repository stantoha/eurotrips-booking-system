// ============================================================
// EUROTRIPS — TourCard Component
// Картка туру з полями з Gap Analysis + ADR-001
// RBAC: агент НЕ бачить cost_price та margin (BR-04)
// ============================================================

import React from 'react';
import {
  MapPin, Calendar, Clock, Users, Bus, Plane, ArrowRightLeft,
  Star, Briefcase, UserCheck, ChevronRight, AlertTriangle,
  Tag, Euro
} from 'lucide-react';
import { Tour, TourType, UserRole } from '../../types';
import { StatusBadge } from '../ui/StatusBadge';
import { TourPhotoCarousel, type TourPhoto } from './TourPhotoCarousel';
import { findRouteForTour, parseRoute } from '../../data/tourRoutes';

// ─── TYPES ───────────────────────────────────────────────────

export interface TourCardProps {
  tour: Tour;
  /** Роль поточного користувача для RBAC */
  userRole?: UserRole;
  /** Варіант відображення */
  variant?: 'grid' | 'list';
  /** Показувати кнопку "Забронювати" */
  showBookButton?: boolean;
  /** Фото локацій маршруту. Якщо не задано — виводяться з довідника
   *  маршрутів як підписані слоти-заглушки (у Tour ще немає поля photos) */
  photos?: TourPhoto[];
  /** Вимкнути карусель навіть за наявності маршруту */
  showPhotos?: boolean;
  /** Висота каруселі, px */
  photoHeight?: number;
  /** Callback при кліку на картку або кнопку */
  onBook?: (tourId: string) => void;
  onView?: (tourId: string) => void;
  className?: string;
}

/**
 * Слоти-заглушки з назв зупинок маршруту: карусель працює ще до появи
 * реальних фото, і одразу несе користь — показує, що входить у виїзд.
 * Кінцеві точки (Львів/Київ) відкидаємо — це місто виїзду, не локація.
 */
const MAX_PHOTO_SLOTS = 6;

function routePhotoSlots(tourName: string): TourPhoto[] {
  const route = findRouteForTour(tourName);
  if (!route) return [];
  const stops = parseRoute(route).main;
  if (stops.length < 3) return [];

  return stops
    .filter((s) => !s.isEndpoint)
    .slice(0, MAX_PHOTO_SLOTS)
    .map((s, i) => ({ caption: s.name, day: i + 1 }));
}

// ─── HELPERS ─────────────────────────────────────────────────

const TOUR_TYPE_CONFIG: Record<TourType, { label: string; Icon: React.FC<{ size?: number }> }> = {
  bus:      { label: 'Автобусний', Icon: Bus },
  avia:     { label: 'Авіатур',    Icon: Plane },
  combined: { label: 'Комбінований', Icon: ArrowRightLeft },
};

/** Перевіряємо чи може роль бачити собівартість */
function canSeeCostPrice(role?: UserRole): boolean {
  return role === 'admin' || role === 'director' || role === 'accountant';
}

/** Колір прогрес-бару завантаженості (brand кольори) */
function getOccupancyColor(pct: number): string {
  if (pct >= 95) return 'bg-brand-red';
  if (pct >= 80) return 'bg-brand-gold';
  return 'bg-brand-cyan';
}

/** Форматування дати для UA локалі */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────

const TourTag: React.FC<{ label: string }> = ({ label }) => (
  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
    {label}
  </span>
);

const FieldRow: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 py-0.5">
    <span className="shrink-0 text-slate-400">{icon}</span>
    <span>{children}</span>
  </div>
);

// ─── GRID VARIANT ────────────────────────────────────────────

const TourCardGrid: React.FC<TourCardProps> = ({
  tour, userRole, showBookButton = true, photos, showPhotos = true, photoHeight = 148, onBook, onView,
}) => {
  const typeConfig = TOUR_TYPE_CONFIG[tour.tour_type];
  const occupancyPct = Math.round(
    ((tour.total_seats - tour.available_seats) / tour.total_seats) * 100
  );
  const isAlmostFull = tour.available_seats <= 3;
  const isFull = tour.available_seats === 0;

  const slots = React.useMemo(
    () => (photos ?? (showPhotos ? routePhotoSlots(tour.name) : [])),
    [photos, showPhotos, tour.name],
  );
  const hasPics = slots.length > 0;

  return (
    <article
      onClick={() => onView?.(tour.id)}
      className={`group bg-surface-1 border border-line rounded-panel overflow-hidden hover:border-line-strong hover:shadow-sm transition-all duration-base cursor-pointer flex flex-col ${hasPics ? '' : 'p-4'}`}
    >
      {/* Карусель локацій маршруту — статус і код лягають поверх фото */}
      {hasPics && (
        <TourPhotoCarousel
          photos={slots}
          height={photoHeight}
          rounded={false}
          overlay={
            <>
              <StatusBadge status={tour.status} domain="tour" size="sm" />
              <code className="et-carousel__codeOn">{tour.code}</code>
            </>
          }
        />
      )}

      <div className={hasPics ? 'flex flex-col flex-1 px-4 pt-3.5 pb-4' : 'contents'}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          {!hasPics && <StatusBadge status={tour.status} domain="tour" size="sm" className="mb-2" />}
          <h3 className="font-medium text-content-primary text-h4 leading-snug truncate">
            {tour.name}
          </h3>
        </div>
        {!hasPics && (
          <code className="text-caption text-content-tertiary font-mono shrink-0 mt-0.5">
            {tour.code}
          </code>
        )}
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-2 gap-0 mb-3">
        <FieldRow icon={<MapPin size={14} />}>{tour.direction}</FieldRow>
        <FieldRow icon={<Calendar size={14} />}>{formatDate(tour.departure_date)}</FieldRow>
        <FieldRow icon={<Clock size={14} />}>{tour.duration_days} днів</FieldRow>
        <FieldRow icon={<typeConfig.Icon size={14} />}>{typeConfig.label}</FieldRow>
        <FieldRow icon={<MapPin size={14} />}>{tour.departure_city}</FieldRow>
        {tour.guide_name && (
          <FieldRow icon={<UserCheck size={14} />}>{tour.guide_name}</FieldRow>
        )}
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-800 my-3" />

      {/* Price + Commission row */}
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p className="text-[11px] text-slate-400 mb-0.5">Ціна від особи</p>
          <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {tour.base_price.toLocaleString('uk-UA')}
            <span className="text-sm font-normal text-slate-400 ml-1">EUR</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-slate-400 mb-0.5">Комісія агента</p>
          <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
            {(tour.agent_commission_pct * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Cost price (тільки для admin/director/accountant — BR-04) */}
      {canSeeCostPrice(userRole) && tour.cost_price && (
        <div className="flex items-center justify-between text-xs bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-1.5 mb-3">
          <span className="text-amber-600 dark:text-amber-400">Собівартість (внутр.)</span>
          <span className="font-medium text-amber-700 dark:text-amber-300">
            {tour.cost_price.toLocaleString()} EUR
          </span>
        </div>
      )}

      {/* Seats + Occupancy */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
          <span className="flex items-center gap-1">
            <Users size={12} />
            {isAlmostFull ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                <AlertTriangle size={11} />
                Залишилось {tour.available_seats} місць
              </span>
            ) : (
              `Місця: ${tour.available_seats} з ${tour.total_seats}`
            )}
          </span>
          <span>{occupancyPct}% заповнено</span>
        </div>
        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${getOccupancyColor(occupancyPct)}`}
            style={{ width: `${occupancyPct}%` }}
          />
        </div>
      </div>

      {/* Tags */}
      {tour.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {tour.tags.map((tag) => (
            <TourTag key={tag} label={tag} />
          ))}
        </div>
      )}

      {/* Action button */}
      {showBookButton && (
        <button
          onClick={(e) => { e.stopPropagation(); if (!isFull) onBook?.(tour.id); }}
          disabled={isFull}
          className={`
            mt-auto w-full py-2 px-4 rounded-pill text-sm font-semibold
            flex items-center justify-center gap-1.5
            transition-all duration-150
            ${isFull
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'
              : 'bg-brand-red text-white hover:bg-brand-red-dark'
            }
          `}
        >
          {isFull ? 'Немає місць' : 'Забронювати'}
          {!isFull && <ChevronRight size={15} />}
        </button>
      )}
      </div>
    </article>
  );
};

// ─── LIST VARIANT ────────────────────────────────────────────

const TourCardList: React.FC<TourCardProps> = ({
  tour, userRole, showBookButton = true, onBook, onView,
}) => {
  const typeConfig = TOUR_TYPE_CONFIG[tour.tour_type];
  const occupancyPct = Math.round(
    ((tour.total_seats - tour.available_seats) / tour.total_seats) * 100
  );

  return (
    <article
      className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all duration-200 cursor-pointer"
      onClick={() => onView?.(tour.id)}
    >
      <div className="flex items-center gap-4">
        {/* Tour info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <StatusBadge status={tour.status} domain="tour" size="xs" />
            <code className="text-[11px] text-slate-400 font-mono">{tour.code}</code>
          </div>
          <h3 className="font-medium text-slate-900 dark:text-slate-100 truncate">{tour.name}</h3>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1"><MapPin size={11} />{tour.direction}</span>
            <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(tour.departure_date)}</span>
            <span className="flex items-center gap-1"><Clock size={11} />{tour.duration_days} д.</span>
            <span className="flex items-center gap-1"><typeConfig.Icon size={11} />{typeConfig.label}</span>
          </div>
        </div>

        {/* Seats */}
        <div className="hidden sm:flex flex-col items-center gap-1 min-w-[80px]">
          <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${getOccupancyColor(occupancyPct)}`} style={{ width: `${occupancyPct}%` }} />
          </div>
          <span className="text-[11px] text-slate-400">{tour.available_seats}/{tour.total_seats}</span>
        </div>

        {/* Price */}
        <div className="text-right min-w-[90px]">
          <p className="font-semibold text-slate-900 dark:text-slate-100 text-[15px]">
            {tour.base_price.toLocaleString()}
            <span className="text-xs text-slate-400 ml-0.5">EUR</span>
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {(tour.agent_commission_pct * 100).toFixed(0)}% комісія
          </p>
        </div>

        {/* Book button */}
        {showBookButton && (
          <button
            onClick={(e) => { e.stopPropagation(); onBook?.(tour.id); }}
            className="shrink-0 px-3 py-1.5 rounded-pill text-xs font-semibold bg-brand-red text-white hover:bg-brand-red-dark transition-colors"
          >
            Забронювати
          </button>
        )}
      </div>
    </article>
  );
};

// ─── MAIN COMPONENT ──────────────────────────────────────────

export const TourCard: React.FC<TourCardProps> = (props) => {
  if (props.variant === 'list') return <TourCardList {...props} />;
  return <TourCardGrid {...props} />;
};

export default TourCard;
