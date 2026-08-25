// ============================================================
// EUROTRIPS — графіки аналітики (Recharts).
// Перевіряємо порожні стани, бізнес-пороги заповненості, BR-04
// (комісія ховається на агентських поверхнях) і формат чисел uk-UA.
//
// Recharts у jsdom не має розмірів контейнера, тож ResponsiveContainer
// нічого не малює — задаємо ширину/висоту явно через мок.
// ============================================================

import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';

// ResponsiveContainer у jsdom має нульовий розмір, тож графік не малюється
// зовсім. Підміняємо його на прокидання явних width/height у сам чарт —
// інакше Recharts рендерить порожнечу і тест нічого не перевіряє.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children, height }: { children: React.ReactElement; height?: number }) =>
      React.cloneElement(children, { width: 800, height: typeof height === 'number' ? height : 300 }),
  };
});

import { SalesFunnel } from './SalesFunnel';
import { ToursLoadChart } from './ToursLoadChart';
import { RevenueTrendChart } from './RevenueTrendChart';
import { AgentsRevenueChart } from './AgentsRevenueChart';
import { ChartTooltip, formatNumber } from './chartRuntime';

beforeAll(() => {
  // Recharts вимірює SVG — у jsdom розміри нульові
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 300 });
});

// ─── ПОРОЖНІ СТАНИ ───────────────────────────────────────────
// Правило DS: порожній стан ніколи не буває мовчазним

describe('порожні стани', () => {
  it('SalesFunnel без кроків повідомляє про це', () => {
    render(<SalesFunnel steps={[]} />);
    expect(screen.getByText('Немає даних за обраний період.')).toBeInTheDocument();
  });

  it('ToursLoadChart без турів повідомляє про це', () => {
    render(<ToursLoadChart tours={[]} />);
    expect(screen.getByText('Немає турів за обраний період.')).toBeInTheDocument();
  });

  it('AgentsRevenueChart без агентів повідомляє про це', () => {
    render(<AgentsRevenueChart agents={[]} />);
    expect(screen.getByText('Немає агентських бронювань за період.')).toBeInTheDocument();
  });

  it('RevenueTrendChart з однією точкою не малює «тренд»', () => {
    render(<RevenueTrendChart points={[{ label: 'сер 26', revenue: 100, bookings: 1 }]} />);
    expect(screen.getByText('Недостатньо даних для тренду.')).toBeInTheDocument();
  });
});

// ─── РЕНДЕР ДАНИХ ────────────────────────────────────────────

describe('SalesFunnel', () => {
  const steps = [
    { label: 'Ліди', value: 120, tone: 'cyan' as const },
    { label: 'Бронювання', value: 45, tone: 'gold' as const, conversionPct: 37.5 },
    { label: 'Підтверджені', value: 30, tone: 'emerald' as const, conversionPct: 66.7 },
  ];

  it('рендерить підпис кожного етапу', () => {
    const { container } = render(<SalesFunnel steps={steps} />);
    expect(container.querySelector('.recharts-wrapper')).toBeTruthy();
    for (const s of steps) expect(screen.getAllByText(s.label).length).toBeGreaterThan(0);
  });

  it('показує значення та конверсію просто на графіку (без наведення)', () => {
    render(<SalesFunnel steps={steps} />);
    // Мітка бара = «значення · конверсія»; саме число 120 є ще й на осі,
    // тож перевіряємо унікальну комбінацію
    expect(screen.getByText(/45\s*·\s*37\.5%/)).toBeInTheDocument();
    expect(screen.getByText(/30\s*·\s*66\.7%/)).toBeInTheDocument();
  });

  it('showConversion=false ховає конверсію', () => {
    render(<SalesFunnel steps={steps} showConversion={false} />);
    expect(screen.queryByText(/37\.5%/)).not.toBeInTheDocument();
  });
});

describe('ToursLoadChart · бізнес-пороги', () => {
  const tours = [
    { id: '1', code: 'LP26010301', name: 'Лапландія', departure_date: '2026-01-03', occupancy_pct: 45 },
    { id: '2', code: 'PN26052301', name: 'Париж', departure_date: '2026-05-23', occupancy_pct: 85 },
    { id: '3', code: 'SW26052401', name: 'Швейцарія', departure_date: '2026-05-24', occupancy_pct: 98 },
  ];

  it('малює лінії порогів 80% і 95%', () => {
    render(<ToursLoadChart tours={tours} />);
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  it('пороги налаштовуються пропсами (продукт ще не вирішив, які правильні)', () => {
    render(<ToursLoadChart tours={tours} warnAt={70} fullAt={90} />);
    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('showThresholds=false прибирає лінії порогів', () => {
    render(<ToursLoadChart tours={tours} showThresholds={false} />);
    expect(screen.queryByText('80%')).not.toBeInTheDocument();
  });

  it('підписує кожен виїзд його кодом', () => {
    render(<ToursLoadChart tours={tours} />);
    for (const t of tours) expect(screen.getAllByText(t.code).length).toBeGreaterThan(0);
  });
});

describe('AgentsRevenueChart · BR-04', () => {
  const agents = [
    { agency_name: 'Тревел Плюс', total_amount: 12000, total_commission: 1680, bookings_count: 14 },
  ];

  it('за замовчуванням показує і оборот, і комісію', () => {
    render(<AgentsRevenueChart agents={agents} />);
    expect(screen.getByText('Оборот')).toBeInTheDocument();
    expect(screen.getByText('Комісія')).toBeInTheDocument();
  });

  it('showCommission=false ховає комісію (агентські поверхні)', () => {
    render(<AgentsRevenueChart agents={agents} showCommission={false} />);
    expect(screen.getByText('Оборот')).toBeInTheDocument();
    expect(screen.queryByText('Комісія')).not.toBeInTheDocument();
  });
});

describe('RevenueTrendChart', () => {
  const points = [
    { label: 'чер 26', revenue: 8400, bookings: 10 },
    { label: 'лип 26', revenue: 12900, bookings: 15 },
    { label: 'сер 26', revenue: 0, bookings: 0 },
  ];

  it('малює обидві серії — оборот і кількість бронювань', () => {
    render(<RevenueTrendChart points={points} />);
    expect(screen.getByText('Оборот, EUR')).toBeInTheDocument();
    expect(screen.getByText('Бронювань')).toBeInTheDocument();
  });

  it('порожні місяці не ламають графік', () => {
    const { container } = render(<RevenueTrendChart points={points} />);
    expect(container.querySelector('.recharts-wrapper')).toBeTruthy();
  });
});

// ─── ФОРМАТУВАННЯ ────────────────────────────────────────────

describe('формат чисел (правило DS: групування uk-UA)', () => {
  it('formatNumber групує тисячі', () => {
    // uk-UA використовує нерозривний пробіл як розділювач розрядів
    expect(formatNumber(12000).replace(/\s| | /g, ' ')).toBe('12 000');
  });

  it('тултип не рендериться, поки неактивний', () => {
    const { container } = render(<ChartTooltip active={false} payload={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('тултип показує назву серії та значення', () => {
    render(
      <ChartTooltip
        active
        label="сер 26"
        payload={[{ dataKey: 'revenue', name: 'Оборот, EUR', value: 12900, color: '#53c7d6' }]}
      />,
    );
    expect(screen.getByText('сер 26')).toBeInTheDocument();
    expect(screen.getByText('Оборот, EUR')).toBeInTheDocument();
    expect(screen.getByText(/12\s*900/)).toBeInTheDocument();
  });
});
