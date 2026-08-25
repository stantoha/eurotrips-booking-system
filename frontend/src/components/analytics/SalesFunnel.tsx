// ============================================================
// EUROTRIPS — analytics/SalesFunnel.tsx
// Воронка продажів як справжній горизонтальний бар-чарт Recharts
// (раніше — CSS-бари інлайном в Analytics.tsx).
// Ліди → Бронювання → Підтверджені, з конверсією на мітках.
// ============================================================

import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList,
} from 'recharts';
import {
  useChartColors, ChartTooltip, AXIS_TICK, CAT_TICK, formatNumber, type ChartColors,
} from './chartRuntime';

export type FunnelTone = 'cyan' | 'gold' | 'emerald' | 'blue' | 'red';

export interface FunnelStep {
  label: string;
  value: number;
  tone?: FunnelTone;
  /** Конверсія з попереднього кроку, % */
  conversionPct?: number | null;
}

export interface SalesFunnelProps {
  steps: FunnelStep[];
  height?: number;
  showConversion?: boolean;
  /** DS: анімація вимкнена за замовчуванням — у фонових вкладках браузер
   *  глушить rAF і графік залишався б назавжди на нулі */
  animate?: boolean;
  valueLabel?: string;
  emptyLabel?: string;
  className?: string;
}

const TONE_KEY: Record<FunnelTone, keyof ChartColors> = {
  cyan: 'cyan', gold: 'gold', emerald: 'success', blue: 'blue', red: 'red',
};

export const SalesFunnel: React.FC<SalesFunnelProps> = ({
  steps = [], height, showConversion = true, animate = false,
  valueLabel = 'Кількість', emptyLabel = 'Немає даних за обраний період.', className = '',
}) => {
  const c = useChartColors();
  const chartHeight = height ?? Math.max(140, steps.length * 52 + 24);

  if (steps.length === 0) return <p className="text-caption text-content-tertiary">{emptyLabel}</p>;

  const data = steps.map((s) => ({ ...s, fill: c[TONE_KEY[s.tone ?? 'cyan']] }));
  const tooltipTitle = (row: never, label?: string | number) => {
    const s = row as unknown as FunnelStep;
    return s.label + (showConversion && s.conversionPct != null ? ` · конверсія ${s.conversionPct}%` : String(label ?? ''));
  };

  // Значення + конверсія праворуч від бара — читається без наведення.
  // Типи LabelList у recharts надто широкі, тож розпаковуємо самі.
  const renderLabel = (props: unknown) => {
    const { x = 0, y = 0, width = 0, height: barHeight = 0, index = 0 } =
      (props ?? {}) as { x?: number; y?: number; width?: number; height?: number; index?: number };
    const s = data[index];
    if (!s) return <g />;
    const text = formatNumber(s.value) + (showConversion && s.conversionPct != null ? `  ·  ${s.conversionPct}%` : '');
    return (
      <text
        x={x + width + 8} y={y + barHeight / 2} dominantBaseline="middle"
        fontFamily="var(--font-mono)" fontSize="12" fontWeight="600" fill="var(--text-primary)"
      >
        {text}
      </text>
    );
  };

  return (
    <div className={`et-chart ${className}`.trim()}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 76, bottom: 4, left: 4 }} barSize={22}>
          <CartesianGrid horizontal={false} stroke={c.grid} strokeDasharray="2 4" />
          <XAxis type="number" tick={AXIS_TICK} stroke={c.grid} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" width={116} tick={CAT_TICK} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip title={tooltipTitle} />} />
          <Bar dataKey="value" name={valueLabel} radius={[0, 6, 6, 0]} isAnimationActive={animate}>
            {data.map((s) => <Cell key={s.label} fill={s.fill} />)}
            <LabelList content={renderLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SalesFunnel;
