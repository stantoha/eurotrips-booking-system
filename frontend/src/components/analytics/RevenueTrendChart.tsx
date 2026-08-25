// ============================================================
// EUROTRIPS — analytics/RevenueTrendChart.tsx
// Місячний оборот (area) проти кількості бронювань (line) на другій осі.
// Дані: GET /analytics/revenue-trend (скасовані бронювання виключено).
// ============================================================

import React from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { useChartColors, ChartTooltip, ChartLegend, ChartEmpty, AXIS_TICK, CAT_TICK } from './chartRuntime';

export interface RevenuePoint {
  label: string;
  revenue: number;
  bookings: number;
}

export interface RevenueTrendChartProps {
  points: RevenuePoint[];
  height?: number;
  animate?: boolean;
  revenueLabel?: string;
  countLabel?: string;
  emptyLabel?: string;
  className?: string;
}

export const RevenueTrendChart: React.FC<RevenueTrendChartProps> = ({
  points = [], height = 240, animate = false,
  revenueLabel = 'Оборот, EUR', countLabel = 'Бронювань',
  emptyLabel = 'Недостатньо даних для тренду.', className = '',
}) => {
  const c = useChartColors();

  // Тренд з однієї точки — не тренд
  if (points.length < 2) {
    return <ChartEmpty label={emptyLabel} hint="Тренд будується щонайменше з двох місяців." height={height} />;
  }

  return (
    <div className={`et-chart ${className}`.trim()}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="etRevFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.cyan} stopOpacity={0.28} />
              <stop offset="100%" stopColor={c.cyan} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="2 4" />
          <XAxis dataKey="label" tick={CAT_TICK} tickLine={false} axisLine={{ stroke: c.grid }} />
          <YAxis yAxisId="l" tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} />
          <YAxis yAxisId="r" orientation="right" tick={AXIS_TICK} tickLine={false} axisLine={false} width={36} />
          <Tooltip cursor={{ stroke: c.grid }} content={<ChartTooltip />} />
          <Legend content={<ChartLegend />} verticalAlign="top" height={26} />
          <Area
            yAxisId="l" type="monotone" dataKey="revenue" name={revenueLabel}
            stroke={c.cyan} strokeWidth={2} fill="url(#etRevFill)" isAnimationActive={animate}
          />
          <Line
            yAxisId="r" type="monotone" dataKey="bookings" name={countLabel}
            stroke={c.red} strokeWidth={2}
            dot={{ r: 3, fill: c.red, strokeWidth: 0 }} activeDot={{ r: 5 }}
            isAnimationActive={animate}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RevenueTrendChart;
