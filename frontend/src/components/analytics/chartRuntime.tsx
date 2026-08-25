// ============================================================
// EUROTRIPS — analytics/chartRuntime.tsx
// Спільне «обрамлення» графіків: тултип, легенда, скелетон, стилі осей.
//
// Відмінність від дизайн-системи: DS тягне Recharts з CDN, бо має бути
// без залежностей. Тут recharts стоїть у package.json, тож імпортуємо
// напряму — це прибирає мигання при завантаженні й не порушує CSP.
//
// Осі/тултипи/легенда стилізовані ТОКЕНАМИ, а не дефолтами Recharts,
// тож темна тема працює автоматично.
// ============================================================

import React from 'react';

// ─── СТИЛІ ОСЕЙ (токени, не хардкод) ─────────────────────────

export const AXIS_TICK = { fontFamily: 'var(--font-mono)', fontSize: 11, fill: 'var(--text-tertiary)' } as const;
export const CAT_TICK = { fontFamily: 'var(--font-body)', fontSize: 12, fill: 'var(--text-secondary)' } as const;

/** Числа завжди у форматі uk-UA (правило DS: «числа несуть одиницю») */
export function formatNumber(n: number | string): string {
  return Number(n).toLocaleString('uk-UA');
}

// ─── КОЛЬОРИ З ТОКЕНІВ ───────────────────────────────────────

export interface ChartColors {
  cyan: string; cyanDark: string; red: string; gold: string;
  blue: string; success: string; grid: string; axis: string;
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Бренд-відтінки читаються з токенів у момент рендера, тож темна тема
 * підхоплюється сама. Recharts потребує РЕАЛЬНІ кольори (не var(...)),
 * бо малює в SVG/canvas-атрибути.
 */
export function chartColors(): ChartColors {
  return {
    cyan:     cssVar('--et-cyan', '#53c7d6'),
    cyanDark: cssVar('--et-cyan-dark', '#3fb4c3'),
    red:      cssVar('--et-red', '#f0366d'),
    gold:     cssVar('--et-gold', '#f9c01d'),
    blue:     cssVar('--et-blue', '#2d70b9'),
    success:  cssVar('--status-success', '#10b981'),
    grid:     cssVar('--border-1', '#dde3ef'),
    axis:     cssVar('--text-tertiary', '#8b98b5'),
  };
}

/** Перечитує кольори при зміні теми (клас .dark на <html>) */
export function useChartColors(): ChartColors {
  const [colors, setColors] = React.useState<ChartColors>(chartColors);

  React.useEffect(() => {
    const update = () => setColors(chartColors());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return colors;
}

// ─── ТУЛТИП ──────────────────────────────────────────────────

interface TooltipPayloadItem {
  dataKey?: string | number;
  name?: string;
  value?: number | string;
  color?: string;
  fill?: string;
  unit?: string;
  payload?: Record<string, unknown>;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  unit?: string;
  /** Кастомний заголовок з рядка даних */
  title?: (row: never, label?: string | number) => string;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label, unit, title }) => {
  if (!active || !payload || payload.length === 0) return null;
  const head = title ? title(payload[0].payload as never, label) : label;

  return (
    <div className="et-chart__tip">
      {head != null && <div className="et-chart__tipHead">{head}</div>}
      {payload.map((p, i) => (
        <div className="et-chart__tipRow" key={`${p.dataKey ?? i}`}>
          <span className="et-chart__tipDot" style={{ background: p.color ?? p.fill }} />
          <span className="et-chart__tipName">{p.name}</span>
          <span className="et-chart__tipVal">{formatNumber(p.value ?? 0)}{p.unit ?? unit ?? ''}</span>
        </div>
      ))}
    </div>
  );
};

// ─── ЛЕГЕНДА ─────────────────────────────────────────────────

export interface ChartLegendProps {
  payload?: { value: string; color?: string }[];
}

export const ChartLegend: React.FC<ChartLegendProps> = ({ payload = [] }) => (
  <div className="et-chart__legend">
    {payload.map((p) => (
      <span className="et-chart__legendItem" key={p.value}>
        <span className="et-chart__tipDot" style={{ background: p.color }} />
        {p.value}
      </span>
    ))}
  </div>
);

// ─── СКЕЛЕТОН ────────────────────────────────────────────────
// DS: завантаження — ЗАВЖДИ скелетон тієї ж висоти, щоб лейаут не стрибав.

export const ChartLoading: React.FC<{ height?: number; label?: string }> = ({
  height = 220, label = 'Побудова графіка…',
}) => (
  <div className="et-chart__loading" style={{ height }}>
    <div className="et-chart__loadingBars">
      {[62, 84, 48, 71].map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}
    </div>
    <p className="et-chart__loadingLbl">{label}</p>
  </div>
);
