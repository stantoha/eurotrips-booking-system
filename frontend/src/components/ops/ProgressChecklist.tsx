// ============================================================
// EUROTRIPS — ProgressChecklist Component
// OPS-18: 9-пунктний чекліст готовності виїзду. Wireframe 5.
//
// Оновлено за дизайн-системою: пункти згруповані за фазами
// підготовки, а критичні позначені як БЛОКЕРИ виїзду — їхня
// кількість виводиться в шапці, а прогрес-бар червоніє, поки
// хоч один блокер відкритий. Раніше всі 9 пунктів були рівні,
// і по шапці не було видно, що саме зупиняє виїзд.
// ============================================================

import React from 'react';
import { CheckCircle2, Circle, TriangleAlert } from 'lucide-react';
import { occupancyColor } from '../ui/OccupancyBar';
import { CHECKLIST_ITEMS, type ChecklistItemKey, type TourChecklist } from '../../hooks/useTourChecklist';

/** Фази підготовки — щоб 9 пунктів читались як 3 блоки, а не суцільний список */
type ChecklistGroup = 'logistics' | 'staff' | 'docs';

const GROUP_LABELS: Record<ChecklistGroup, string> = {
  logistics: 'Логістика та розміщення',
  staff:     'Персонал',
  docs:      'Документи та комунікація',
};

const ITEM_GROUP: Record<ChecklistItemKey, ChecklistGroup> = {
  transportConfirmed:      'logistics',
  hotelsAllPaid:           'logistics',
  roomingFinalizedAndSent: 'logistics',
  guidesAllConfirmed:      'staff',
  guideAssigned:           'staff',
  emergencyContactsReady:  'staff',
  documentsGenerated:      'docs',
  touristsNotified:        'docs',
  finalLetterSent:         'docs',
};

/**
 * Блокери — без них виїзд фізично не відбудеться (немає автобуса,
 * готелю чи гіда). Решта пунктів важлива, але не зупиняє відправлення.
 */
const BLOCKING_ITEMS: ReadonlySet<ChecklistItemKey> = new Set<ChecklistItemKey>([
  'transportConfirmed',
  'hotelsAllPaid',
  'guidesAllConfirmed',
  'guideAssigned',
]);

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

  const blockers = CHECKLIST_ITEMS.filter(
    ({ key, field }) => !checklist[field] && BLOCKING_ITEMS.has(key),
  );

  // Зберігаємо порядок GROUP_LABELS, а не порядок появи пунктів
  const groups = (Object.keys(GROUP_LABELS) as ChecklistGroup[])
    .map((group) => [group, CHECKLIST_ITEMS.filter(({ key }) => ITEM_GROUP[key] === group)] as const)
    .filter(([, items]) => items.length > 0);

  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-dark to-slate-700 px-5 py-4 flex items-center gap-4">
        <div className="text-3xl font-bold font-mono text-brand-cyan leading-none">{pct}%</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white mb-1.5">Чекліст готовності виїзду</p>
          <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
            {/* Поки відкритий блокер — смуга червона, скільки б відсотків не було */}
            <div
              className={`h-full rounded-full ${blockers.length > 0 ? 'bg-brand-red' : occupancyColor(pct)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-caption text-white/40 font-mono mt-1">
            {doneCount} з {CHECKLIST_ITEMS.length} пунктів виконано
            {blockers.length > 0 && (
              <span className="text-brand-red ml-1">· {blockers.length} блокує виїзд</span>
            )}
          </p>
        </div>
        {daysLeft !== null && (
          <div className="text-center shrink-0">
            <div className="text-xl font-bold font-mono text-brand-gold leading-none">{daysLeft}</div>
            <div className="text-[10px] text-white/40 font-mono">{daysLeft === 1 ? 'день до виїзду' : 'днів до виїзду'}</div>
          </div>
        )}
      </div>

      {/* Items — згруповані за фазами підготовки */}
      <div>
        {groups.map(([group, items]) => (
          <div key={group}>
            <div className="px-4 pt-3 pb-1.5 text-micro uppercase tracking-eyebrow font-semibold text-content-tertiary bg-surface-2/60">
              {GROUP_LABELS[group]}
            </div>
            {items.map(({ key, field }) => {
              const done = Boolean(checklist[field]);
              const isBlocker = BLOCKING_ITEMS.has(key);
              const blocking = !done && isBlocker;

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => onToggle?.(key, !done)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2.5 border-b border-line last:border-0 text-left
                    transition-colors duration-fast
                    ${blocking ? 'bg-status-danger-bg/50' : !done ? 'bg-status-warning-bg/40' : ''}
                    ${canEdit ? 'hover:bg-surface-hover cursor-pointer' : 'cursor-default'}
                  `}
                >
                  {done ? (
                    <CheckCircle2 size={18} className="text-status-success shrink-0" aria-hidden="true" />
                  ) : blocking ? (
                    <TriangleAlert size={18} className="text-status-danger shrink-0" aria-hidden="true" />
                  ) : (
                    <Circle size={18} className="text-status-warning shrink-0" aria-hidden="true" />
                  )}

                  <span className={`text-sm flex-1 ${
                    done ? 'text-content-secondary'
                      : blocking ? 'text-status-danger-fg font-medium'
                      : 'text-content-primary'
                  }`}>
                    {ITEM_LABELS[key]}
                  </span>

                  {blocking && (
                    <span className="text-micro uppercase tracking-eyebrow font-bold text-status-danger shrink-0">
                      блокер
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgressChecklist;
