// ============================================================
// EUROTRIPS — CalendarGrid Component
// Місячна сітка з подіями (виїзди). OPS UX C-3, Wireframe 1.
// ============================================================

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface CalendarEvent {
  id: string;
  /** ISO-дата (YYYY-MM-DD) */
  date: string;
  label: string;
  tone: 'ok' | 'warn' | 'err';
}

export interface CalendarGridProps {
  /** Будь-яка дата в межах відображуваного місяця */
  month: Date;
  events: CalendarEvent[];
  onMonthChange: (next: Date) => void;
  onEventClick?: (id: string) => void;
  className?: string;
}

const WEEKDAYS_UK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

const TONE_CLASSES: Record<CalendarEvent['tone'], string> = {
  ok:   'bg-brand-cyan/10 text-brand-cyan-dark border-brand-cyan/30',
  warn: 'bg-brand-gold/10 text-brand-gold-dark border-brand-gold/30',
  err:  'bg-brand-red/10 text-brand-red border-brand-red/30',
};

function buildMonthCells(month: Date): (Date | null)[] {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1);
  const lastDay = new Date(year, m + 1, 0);
  // ISO: понеділок = 0
  const leadingBlanks = (firstDay.getDay() + 6) % 7;

  const cells: (Date | null)[] = Array(leadingBlanks).fill(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push(new Date(year, m, d));
  }
  return cells;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  month, events, onMonthChange, onEventClick, className = '',
}) => {
  const cells = useMemo(() => buildMonthCells(month), [month]);
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return map;
  }, [events]);

  const monthLabel = month.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });

  return (
    <div className={className}>
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 capitalize min-w-[140px] text-center">
          {monthLabel}
        </span>
        <button
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
        {WEEKDAYS_UK.map((wd) => (
          <div key={wd} className="bg-slate-50 dark:bg-slate-800 text-center text-[10px] font-semibold text-slate-400 py-1.5">
            {wd}
          </div>
        ))}
        {cells.map((d, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 min-h-[64px] p-1">
            {d && (
              <>
                <div className="text-[10px] text-slate-400 mb-0.5">{d.getDate()}</div>
                <div className="space-y-0.5">
                  {(eventsByDate.get(toISODate(d)) ?? []).map((e) => (
                    <button
                      key={e.id}
                      onClick={() => onEventClick?.(e.id)}
                      className={`w-full text-left text-[9px] font-medium px-1 py-0.5 rounded border truncate ${TONE_CLASSES[e.tone]}`}
                      title={e.label}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalendarGrid;
