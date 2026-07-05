// ============================================================
// EUROTRIPS — OccupancyBar Component
// Прогрес-бар заповненості місць туру (OPS UX-компонент C-3).
// Кольори: brand-cyan (<60%), brand-gold (60-80%), brand-red (>80%)
// ============================================================

import React from 'react';

export interface OccupancyBarProps {
  /** Заброньовано місць */
  current: number;
  /** Всього місць */
  max: number;
  /** Показувати текстовий підпис (N/M · %) */
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/** Відсоток заповненості 0-100 */
export function occupancyPct(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((current / max) * 100));
}

/** Brand-колір бару за відсотком заповненості */
export function occupancyColor(pct: number): string {
  if (pct >= 80) return 'bg-brand-red';
  if (pct >= 60) return 'bg-brand-gold';
  return 'bg-brand-cyan';
}

/** Текстовий колір, узгоджений з occupancyColor — для цифр поряд з баром */
export function occupancyTextColor(pct: number): string {
  if (pct >= 80) return 'text-brand-red';
  if (pct >= 60) return 'text-brand-gold-dark';
  return 'text-brand-cyan-dark';
}

export const OccupancyBar: React.FC<OccupancyBarProps> = ({
  current, max, showLabel = true, size = 'md', className = '',
}) => {
  const pct = occupancyPct(current, max);
  const barHeight = size === 'sm' ? 'h-1' : 'h-1.5';

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
          <span>{current}/{max} місць</span>
          <span className={`font-medium ${occupancyTextColor(pct)}`}>{pct}%</span>
        </div>
      )}
      <div className={`${barHeight} bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all ${occupancyColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default OccupancyBar;
