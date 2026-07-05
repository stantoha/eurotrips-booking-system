// ============================================================
// EUROTRIPS — TimelineView Component
// Вертикальний timeline програми туру по датах/містах.
// OPS UX C-3, Wireframe 3 «Програма і Гіди».
// ============================================================

import React, { useMemo } from 'react';
import { MapPin, Clock, Phone, Euro } from 'lucide-react';
import type { TourActivity } from '../../hooks/useTourActivities';

export interface TimelineViewProps {
  activities: TourActivity[];
  className?: string;
}

interface DayGroup {
  date: string;
  city: string;
  items: TourActivity[];
}

function groupByDayAndCity(activities: TourActivity[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const a of activities) {
    const key = `${a.activity_date}__${a.city}`;
    if (!map.has(key)) map.set(key, { date: a.activity_date, city: a.city, items: [] });
    map.get(key)!.items.push(a);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function isAddon(programType: string | null): boolean {
  return (programType ?? '').toLowerCase().includes('доп');
}

const STATUS_LABELS: Record<string, string> = {
  'затверджено': 'підтверджено',
  'скасовано': 'скасовано',
  'очікує': 'очікує',
};

export const TimelineView: React.FC<TimelineViewProps> = ({ activities, className = '' }) => {
  const days = useMemo(() => groupByDayAndCity(activities), [activities]);

  if (days.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400 text-sm">
        Програму туру ще не додано.
      </div>
    );
  }

  return (
    <div className={`relative pl-5 ${className}`}>
      <div className="absolute left-[7px] top-1 bottom-1 w-px bg-slate-200 dark:bg-slate-700" />
      <div className="space-y-6">
        {days.map((day) => (
          <div key={`${day.date}__${day.city}`} className="relative">
            <div className="absolute -left-5 top-1 w-3 h-3 rounded-full bg-brand-cyan border-2 border-white dark:border-slate-900" />
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {new Date(day.date).toLocaleDateString('uk-UA', { day: '2-digit', month: 'long' })}
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <MapPin size={11} /> {day.city}
              </span>
            </div>

            <div className="space-y-2">
              {day.items.map((a) => {
                const addon = isAddon(a.program_type);
                return (
                  <div
                    key={a.id}
                    className={`bg-white dark:bg-slate-900 border rounded-lg px-3 py-2 flex items-center gap-3 ${
                      addon ? 'border-brand-gold/30' : 'border-brand-cyan/30'
                    }`}
                  >
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${
                        addon
                          ? 'bg-brand-gold/10 text-brand-gold-dark'
                          : 'bg-brand-cyan/10 text-brand-cyan-dark'
                      }`}
                    >
                      {addon ? 'ДОП' : 'Основна'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{a.activity_name}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                        {a.start_time && <span className="flex items-center gap-1"><Clock size={10} />{a.start_time}</span>}
                        {a.guide_name && (
                          <span className="flex items-center gap-1">
                            {a.guide_name}{a.guide_phone && <><Phone size={10} />{a.guide_phone}</>}
                          </span>
                        )}
                        {a.cost_eur != null && <span className="flex items-center gap-1"><Euro size={10} />{a.cost_eur}</span>}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{STATUS_LABELS[a.status] ?? a.status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimelineView;
