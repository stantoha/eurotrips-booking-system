// ============================================================
// EUROTRIPS — TimelineView Component
// Вертикальний timeline програми туру по датах/містах.
// OPS UX C-3, Wireframe 3 «Програма і Гіди».
// canEdit=true вмикає призначення гіда (OPS-12) та підтвердження (OPS-13).
// ============================================================

import React, { useMemo, useState } from 'react';
import { MapPin, Clock, Phone, Euro, CheckCircle2 } from 'lucide-react';
import { formatActivityTime, type TourActivity } from '../../hooks/useTourActivities';

export interface TimelineViewProps {
  activities: TourActivity[];
  canEdit?: boolean;
  onAssignGuide?: (activityId: string, guideName: string, guidePhone: string) => void;
  onConfirm?: (activityId: string) => void;
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

const GuideAssignForm: React.FC<{
  onSubmit: (name: string, phone: string) => void;
  onCancel: () => void;
}> = ({ onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+380');

  return (
    <div className="flex items-center gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ім'я гіда"
        className="text-xs border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 bg-white dark:bg-slate-900 w-28"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+380..."
        className="text-xs border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 bg-white dark:bg-slate-900 w-28"
      />
      <button
        onClick={() => name && phone && onSubmit(name, phone)}
        className="text-[10px] font-semibold px-2 py-1 rounded bg-brand-cyan text-white hover:bg-brand-cyan-dark"
      >
        OK
      </button>
      <button onClick={onCancel} className="text-[10px] text-slate-400 hover:text-slate-600">
        Скасувати
      </button>
    </div>
  );
};

export const TimelineView: React.FC<TimelineViewProps> = ({
  activities, canEdit = false, onAssignGuide, onConfirm, className = '',
}) => {
  const days = useMemo(() => groupByDayAndCity(activities), [activities]);
  const [assigningId, setAssigningId] = useState<string | null>(null);

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
                const time = formatActivityTime(a.start_time);
                return (
                  <div
                    key={a.id}
                    className={`bg-white dark:bg-slate-900 border rounded-lg px-3 py-2 flex items-start gap-3 ${
                      addon ? 'border-brand-gold/30' : 'border-brand-cyan/30'
                    }`}
                  >
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
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
                        {time && <span className="flex items-center gap-1"><Clock size={10} />{time}</span>}
                        {a.guide_name ? (
                          <span className="flex items-center gap-1">
                            {a.guide_name}{a.guide_phone && <><Phone size={10} />{a.guide_phone}</>}
                          </span>
                        ) : (
                          <span className="text-brand-red">Гід — не призначений</span>
                        )}
                        {a.cost_eur != null && <span className="flex items-center gap-1"><Euro size={10} />{a.cost_eur}</span>}
                      </div>

                      {canEdit && !a.guide_name && assigningId === a.id && (
                        <GuideAssignForm
                          onSubmit={(name, phone) => { onAssignGuide?.(a.id, name, phone); setAssigningId(null); }}
                          onCancel={() => setAssigningId(null)}
                        />
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-slate-400">{STATUS_LABELS[a.status] ?? a.status}</span>
                      {canEdit && !a.guide_name && assigningId !== a.id && (
                        <button
                          onClick={() => setAssigningId(a.id)}
                          className="text-[10px] font-semibold text-brand-cyan-dark hover:underline"
                        >
                          Призначити гіда
                        </button>
                      )}
                      {canEdit && a.status === 'очікує' && a.guide_name && (
                        <button
                          onClick={() => onConfirm?.(a.id)}
                          className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 hover:underline"
                        >
                          <CheckCircle2 size={11} /> Підтвердити
                        </button>
                      )}
                    </div>
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
