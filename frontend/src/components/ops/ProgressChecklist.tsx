// ============================================================
// EUROTRIPS — ProgressChecklist Component
// OPS-18: 9-пунктний чекліст готовності виїзду. Wireframe 5.
// ============================================================

import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { occupancyColor } from '../ui/OccupancyBar';
import { CHECKLIST_ITEMS, type ChecklistItemKey, type TourChecklist } from '../../hooks/useTourChecklist';

const ITEM_LABELS: Record<ChecklistItemKey, string> = {
  transportConfirmed:      'Тур підтверджений перевізником',
  hotelsAllPaid:           'Готелі всі оплачені (депозит + фінальна)',
  guidesAllConfirmed:      'Гіди всі підтверджені',
  roomingFinalizedAndSent: 'Румінг фіналізовано і відправлено в готелі',
  documentsGenerated:      'Документи сформовані',
  touristsNotified:        'Туристи отримали інфо-лист',
  guideAssigned:           'Турлідер призначений',
  emergencyContactsReady:  'Екстрені контакти готові',
  finalLetterSent:         'Фінальний лист туристам відправлено',
};

export interface ProgressChecklistProps {
  checklist: TourChecklist;
  departureDate?: string;
  /** Чи може поточний користувач відмічати пункти (ops/admin) */
  canEdit?: boolean;
  onToggle?: (item: ChecklistItemKey, value: boolean) => void;
  className?: string;
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export const ProgressChecklist: React.FC<ProgressChecklistProps> = ({
  checklist, departureDate, canEdit = false, onToggle, className = '',
}) => {
  const pct = checklist.readiness_percent;
  const doneCount = CHECKLIST_ITEMS.filter(({ field }) => checklist[field]).length;
  const daysLeft = daysUntil(departureDate);

  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-dark to-slate-700 px-5 py-4 flex items-center gap-4">
        <div className="text-3xl font-bold font-mono text-brand-cyan leading-none">{pct}%</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white mb-1.5">Чекліст готовності виїзду</p>
          <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${occupancyColor(pct)}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] text-white/40 font-mono mt-1">{doneCount} з {CHECKLIST_ITEMS.length} пунктів виконано</p>
        </div>
        {daysLeft !== null && (
          <div className="text-center shrink-0">
            <div className="text-xl font-bold font-mono text-brand-gold leading-none">{daysLeft}</div>
            <div className="text-[10px] text-white/40 font-mono">{daysLeft === 1 ? 'день до виїзду' : 'днів до виїзду'}</div>
          </div>
        )}
      </div>

      {/* Items */}
      <div>
        {CHECKLIST_ITEMS.map(({ key, field }) => {
          const done = Boolean(checklist[field]);
          return (
            <button
              key={key}
              type="button"
              disabled={!canEdit}
              onClick={() => onToggle?.(key, !done)}
              className={`
                w-full flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0 text-left
                transition-colors
                ${!done ? 'bg-brand-red/5' : ''}
                ${canEdit ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer' : 'cursor-default'}
              `}
            >
              {done
                ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                : <Circle size={18} className="text-brand-red shrink-0" />
              }
              <span className={`text-sm flex-1 ${done ? 'text-slate-700 dark:text-slate-300' : 'text-brand-red font-medium'}`}>
                {ITEM_LABELS[key]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressChecklist;
