// ============================================================
// EUROTRIPS — DeadlineIndicator Component
// Індикатор дедлайну (готелі, транспорт, фінанси) — OPS UX C-3.
// ok (>3 дні) · warn (1-3 дні) · err (сьогодні / прострочено)
// ============================================================

import React from 'react';
import { Clock, AlertTriangle, AlertOctagon } from 'lucide-react';

export interface DeadlineIndicatorProps {
  /** Дата дедлайну (ISO-рядок або Date) */
  date: string | Date | null | undefined;
  /** Підпис перед датою, напр. "Опція готелю" */
  label?: string;
  className?: string;
}

type DeadlineTone = 'ok' | 'warn' | 'err';

export function deadlineTone(date: string | Date): DeadlineTone {
  const target = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const daysLeft = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (daysLeft < 0 || daysLeft === 0) return 'err';
  if (daysLeft <= 3) return 'warn';
  return 'ok';
}

const TONE_STYLES: Record<DeadlineTone, { text: string; Icon: React.FC<{ size?: number; className?: string }> }> = {
  ok:   { text: 'text-emerald-600 dark:text-emerald-400', Icon: Clock },
  warn: { text: 'text-brand-gold-dark dark:text-brand-gold', Icon: AlertTriangle },
  err:  { text: 'text-brand-red dark:text-brand-red', Icon: AlertOctagon },
};

function formatDaysLeft(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (daysLeft < 0) return `прострочено на ${Math.abs(daysLeft)} дн.`;
  if (daysLeft === 0) return 'сьогодні';
  if (daysLeft === 1) return 'завтра';
  return `${daysLeft} дн.`;
}

export const DeadlineIndicator: React.FC<DeadlineIndicatorProps> = ({ date, label, className = '' }) => {
  if (!date) {
    return <span className={`text-xs text-slate-400 ${className}`}>—</span>;
  }

  const tone = deadlineTone(date);
  const { text, Icon } = TONE_STYLES[tone];
  const d = new Date(date);

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${text} ${className}`}>
      <Icon size={12} className="shrink-0" />
      {label && <span className="text-slate-500 dark:text-slate-400 font-normal">{label}:</span>}
      {d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })}
      <span className="font-normal">({formatDaysLeft(d)})</span>
    </span>
  );
};

export default DeadlineIndicator;
