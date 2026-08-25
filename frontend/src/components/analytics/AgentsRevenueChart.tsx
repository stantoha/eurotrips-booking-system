// ============================================================
// EUROTRIPS — analytics/AgentsRevenueChart.tsx
// Оборот агенцій проти комісії, згруповані бари.
//
// ⚠️ BR-04: НІКОЛИ не рендерити на поверхнях для ролі agent —
// агент не має бачити чужі обороти й комісії.
// ============================================================

import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { useChartColors, ChartTooltip, ChartLegend, ChartEmpty, AXIS_TICK, CAT_TICK } from './chartRuntime';

export interface AgentRevenueRow {
  agency_name: string | null;
  total_amount: number;
  total_commission: number;
  bookings_count: number;
}

export interface AgentsRevenueChartProps {
  agents: AgentRevenueRow[];
  height?: number;
  showCommission?: boolean;
  animate?: boolean;
  emptyLabel?: string;
  className?: string;
}

export const AgentsRevenueChart: React.FC<AgentsRevenueChartProps> = ({
  agents = [], height = 240, showCommission = true, animate = false,
  emptyLabel = 'Немає агентських бронювань за період.', className = '',
}) => {
  const c = useChartColors();

  if (agents.length === 0) {
    return <ChartEmpty label={emptyLabel} hint="Бронювання від агенцій за цей період відсутні." height={height} />;
  }

  const data = agents.map((a) => ({
    name: a.agency_name ?? '—',
    turnover: a.total_amount,
    commission: a.total_commission,
    bookings: a.bookings_count,
  }));

  const tooltipTitle = (row: never) => {
    const r = row as unknown as { name: string; bookings: number };
    return `${r.name} · ${r.bookings} броней`;
  };

  return (
    <div className={`et-chart ${className}`.trim()}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barGap={4} maxBarSize={34}>
          <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="2 4" />
          <XAxis dataKey="name" tick={CAT_TICK} tickLine={false} axisLine={{ stroke: c.grid }} interval={0} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} />
          <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip unit=" EUR" title={tooltipTitle} />} />
          <Legend content={<ChartLegend />} verticalAlign="top" height={26} />
          <Bar dataKey="turnover" name="Оборот" fill={c.cyan} radius={[5, 5, 0, 0]} isAnimationActive={animate} />
          {showCommission && (
            <Bar dataKey="commission" name="Комісія" fill={c.blue} radius={[5, 5, 0, 0]} isAnimationActive={animate} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AgentsRevenueChart;
