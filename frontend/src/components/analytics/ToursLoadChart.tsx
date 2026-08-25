// ============================================================
// EUROTRIPS — analytics/ToursLoadChart.tsx
// Заповнюваність виїздів як бар-чарт із намальованими бізнес-порогами.
//
// ⚠️ Пороги розходяться по продукту: тут 80%/95% (успадковано з
// Analytics.tsx), а OccupancyBar червоніє з 80%. Обидва винесені
// в пропси (warnAt/fullAt), поки продукт не вирішить, який правильний.
// ============================================================

import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine, LabelList,
} from 'recharts';
import { useChartColors, ChartTooltip, AXIS_TICK, CAT_TICK } from './chartRuntime';

export interface TourLoadRow {
  id: string;
  code: string;
  name: string;
  departure_date: string;
  occupancy_pct: number;
  sold_seats?: number;
  total_seats?: number;
}

export interface ToursLoadChartProps {
  tours: TourLoadRow[];
  height?: number;
  /** Поріг «майже повний», % */
  warnAt?: number;
  /** Поріг «повний», % */
  fullAt?: number;
  showThresholds?: boolean;
  animate?: boolean;
  emptyLabel?: string;
  className?: string;
}

export function loadTone(pct: number, warnAt = 80, fullAt = 95): 'ok' | 'warn' | 'err' {
  return pct >= fullAt ? 'err' : pct >= warnAt ? 'warn' : 'ok';
}

const formatDate = (s: string) => new Date(s).toLocaleDateString('uk-UA');

export const ToursLoadChart: React.FC<ToursLoadChartProps> = ({
  tours = [], height, warnAt = 80, fullAt = 95, showThresholds = true, animate = false,
  emptyLabel = 'Немає турів за обраний період.', className = '',
}) => {
  const c = useChartColors();
  // Висота росте з кількістю рядів — інакше бари злипаються
  const chartHeight = height ?? Math.max(160, tours.length * 34 + 40);

  if (tours.length === 0) return <p className="text-caption text-content-tertiary">{emptyLabel}</p>;

  const data = tours.map((t) => ({ ...t, pct: t.occupancy_pct }));
  const fillOf = (pct: number) => (pct >= fullAt ? c.red : pct >= warnAt ? c.gold : c.cyan);
  const tooltipTitle = (row: never) => {
    const t = row as unknown as TourLoadRow;
    return `${t.name} · ${t.code} · ${formatDate(t.departure_date)}`;
  };

  return (
    <div className={`et-chart ${className}`.trim()}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }} barSize={16}>
          <CartesianGrid horizontal={false} stroke={c.grid} strokeDasharray="2 4" />
          <XAxis
            type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%"
            tick={AXIS_TICK} tickLine={false} axisLine={false}
          />
          <YAxis type="category" dataKey="code" width={104} tick={CAT_TICK} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip unit="%" title={tooltipTitle} />} />

          {showThresholds && (
            <ReferenceLine
              x={warnAt} stroke={c.gold} strokeDasharray="4 4"
              label={{ value: `${warnAt}%`, position: 'top', fontSize: 10, fill: c.gold, fontFamily: 'var(--font-mono)' }}
            />
          )}
          {showThresholds && (
            <ReferenceLine
              x={fullAt} stroke={c.red} strokeDasharray="4 4"
              label={{ value: `${fullAt}%`, position: 'top', fontSize: 10, fill: c.red, fontFamily: 'var(--font-mono)' }}
            />
          )}

          <Bar dataKey="pct" name="Заповненість" radius={[0, 5, 5, 0]} isAnimationActive={animate}>
            {data.map((t) => <Cell key={t.id} fill={fillOf(t.pct)} />)}
            <LabelList
              dataKey="pct" position="right" formatter={(v: number) => `${v}%`}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fill: 'var(--text-secondary)' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ToursLoadChart;
