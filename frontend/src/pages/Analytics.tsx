// ============================================================
// EUROTRIPS — pages/Analytics.tsx
// Маршрут: /analytics   Ролі: admin, director, manager
// Аналітика на графіках Recharts дизайн-системи: воронка продажів,
// тренд обороту, оборот агенцій, заповнюваність виїздів.
//
// Раніше все це були CSS-бари інлайном; тепер — компоненти DS
// (components/analytics/*), стилізовані токенами.
// ============================================================

import React, { useState } from 'react';
import { Filter, TrendingDown, Users2, BusFront, LineChart, X } from 'lucide-react';
import { useSalesFunnel, useToursLoad, useAgentsTop, useRevenueTrend } from '../hooks/useAnalytics';
import { useAuth } from '../hooks/useAuth';
import { SalesFunnel } from '../components/analytics/SalesFunnel';
import { ToursLoadChart } from '../components/analytics/ToursLoadChart';
import { RevenueTrendChart } from '../components/analytics/RevenueTrendChart';
import { AgentsRevenueChart } from '../components/analytics/AgentsRevenueChart';
import { ChartLoading } from '../components/analytics/chartRuntime';
import { Card, Input, Button, EmptyState } from '../components/ui';

interface PeriodProps { dateFrom?: string; dateTo?: string }

const ErrorNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-sm text-status-danger-fg">{children}</p>
);

// ─── ВОРОНКА ПРОДАЖІВ ─────────────────────────────────────────

const FunnelSection: React.FC<PeriodProps> = ({ dateFrom, dateTo }) => {
  const { data, isLoading, isError } = useSalesFunnel({ dateFrom, dateTo });

  if (isLoading) return <ChartLoading height={190} label="Завантаження воронки…" />;
  if (isError || !data) return <ErrorNote>Не вдалося завантажити воронку продажів.</ErrorNote>;

  return (
    <SalesFunnel
      steps={[
        { label: 'Ліди', value: data.funnel.leads, tone: 'cyan' },
        { label: 'Бронювання', value: data.funnel.bookings, tone: 'gold', conversionPct: data.conversion.lead_to_booking_pct },
        { label: 'Підтверджені', value: data.funnel.confirmed, tone: 'emerald', conversionPct: data.conversion.booking_to_confirmed_pct },
      ]}
    />
  );
};

// ─── ТРЕНД ОБОРОТУ ────────────────────────────────────────────

const RevenueTrendSection: React.FC<PeriodProps> = ({ dateFrom, dateTo }) => {
  const { data, isLoading, isError } = useRevenueTrend({ dateFrom, dateTo });

  if (isLoading) return <ChartLoading height={240} />;
  if (isError || !data) return <ErrorNote>Не вдалося завантажити тренд обороту.</ErrorNote>;

  return (
    <>
      <div className="flex items-baseline gap-4 mb-3">
        <div>
          <p className="text-micro uppercase tracking-eyebrow text-content-tertiary">Оборот за період</p>
          <p className="font-mono text-h3 font-bold text-content-primary">
            {data.totals.revenue.toLocaleString('uk-UA')} <span className="text-sm font-normal text-content-tertiary">EUR</span>
          </p>
        </div>
        <div>
          <p className="text-micro uppercase tracking-eyebrow text-content-tertiary">Бронювань</p>
          <p className="font-mono text-h3 font-bold text-content-primary">{data.totals.bookings}</p>
        </div>
      </div>
      <RevenueTrendChart points={data.points} />
    </>
  );
};

// ─── ЗАПОВНЮВАНІСТЬ ВИЇЗДІВ ───────────────────────────────────

const ToursLoadSection: React.FC<PeriodProps> = ({ dateFrom, dateTo }) => {
  const { data, isLoading, isError } = useToursLoad({ dateFrom, dateTo });

  if (isLoading) return <ChartLoading height={240} />;
  if (isError || !data) return <ErrorNote>Не вдалося завантажити заповнюваність.</ErrorNote>;

  return <ToursLoadChart tours={data} />;
};

// ─── ОБОРОТ АГЕНЦІЙ ───────────────────────────────────────────

const AgentsSection: React.FC<PeriodProps> = ({ dateFrom, dateTo }) => {
  const { data, isLoading, isError } = useAgentsTop({ dateFrom, dateTo });

  if (isLoading) return <ChartLoading height={240} />;
  if (isError || !data) return <ErrorNote>Не вдалося завантажити топ агентів.</ErrorNote>;

  return <AgentsRevenueChart agents={data.agents} />;
};

// ─── MAIN PAGE ────────────────────────────────────────────────

const AnalyticsPage: React.FC = () => {
  const { isAdmin, isDirector, isManager } = useAuth();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  if (!(isAdmin || isDirector || isManager)) {
    return (
      <div className="p-page max-w-content mx-auto">
        <EmptyState
          title="Аналітика недоступна"
          description="Розділ бачать лише адміністратор, директор і менеджер."
        />
      </div>
    );
  }

  const period = { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };

  return (
    <div className="p-page max-w-content mx-auto">
      <h1 className="font-heading text-h2 font-bold text-content-primary mb-1">Аналітика</h1>
      <p className="text-sm text-content-tertiary mb-5">
        Воронка продажів, тренд обороту, оборот агенцій, заповнюваність виїздів.
      </p>

      {/* Смуга фільтрів періоду */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Filter size={14} className="text-content-tertiary" aria-hidden="true" />
        <Input
          type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          aria-label="Період від" className="w-auto"
        />
        <span className="text-content-tertiary text-sm">—</span>
        <Input
          type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          aria-label="Період до" className="w-auto"
        />
        {(dateFrom || dateTo) && (
          <Button
            variant="ghost" size="sm"
            iconLeft={<X size={13} aria-hidden="true" />}
            onClick={() => { setDateFrom(''); setDateTo(''); }}
          >
            Скинути період
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card title={<span className="flex items-center gap-1.5"><TrendingDown size={15} aria-hidden="true" /> Воронка продажів</span>}>
          <FunnelSection {...period} />
        </Card>

        <Card title={<span className="flex items-center gap-1.5"><LineChart size={15} aria-hidden="true" /> Тренд обороту</span>}>
          <RevenueTrendSection {...period} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title={<span className="flex items-center gap-1.5"><Users2 size={15} aria-hidden="true" /> Оборот агенцій</span>}>
          <AgentsSection {...period} />
        </Card>

        <Card title={<span className="flex items-center gap-1.5"><BusFront size={15} aria-hidden="true" /> Заповнюваність виїздів</span>}>
          <ToursLoadSection {...period} />
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsPage;
