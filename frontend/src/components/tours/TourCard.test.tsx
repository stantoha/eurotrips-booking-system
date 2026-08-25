// ============================================================
// EUROTRIPS — TourCard · медіа-область
//
// Знайдено візуально: карусель зʼявлялась лише на турах, чия назва
// збіглася з довідником маршрутів. Каталог виходив рваним — частина
// карток із медіа, частина без, різної висоти. Тепер медіа-область
// має бути на КОЖНІЙ картці.
// ============================================================

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TourCard } from './TourCard';
import type { Tour } from '../../types';

function makeTour(overrides: Partial<Tour> = {}): Tour {
  return {
    id: 't1',
    code: 'LP26010301',
    name: 'Лапландія — Країна Санти',
    direction: 'Фінляндія',
    countries: ['Фінляндія'],
    tour_type: 'combined',
    departure_date: '2026-01-03',
    return_date: '2026-01-10',
    duration_days: 8,
    departure_city: 'Київ',
    base_price: 1290,
    currency: 'EUR',
    agent_commission_pct: 0.14,
    total_seats: 52,
    available_seats: 10,
    status: 'open',
    tags: ['family'],
    ...overrides,
  } as Tour;
}

const mediaSlots = (c: HTMLElement) => c.querySelectorAll('.et-carousel__slot');

describe('TourCard · медіа-область є завжди', () => {
  it('тур із відомим маршрутом бере зупинки як підписи', () => {
    const { container } = render(
      <TourCard tour={makeTour({ name: 'Париж + Нормандія', countries: ['Франція'] })} />,
    );
    expect(mediaSlots(container).length).toBeGreaterThan(1);
    expect(screen.getAllByText('Прага').length).toBeGreaterThan(0);
  });

  it('тур БЕЗ маршруту в довіднику все одно має медіа — з країн туру', () => {
    const { container } = render(<TourCard tour={makeTour()} />);
    expect(mediaSlots(container).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Фінляндія').length).toBeGreaterThan(0);
  });

  it('без маршруту й без країн падає на напрямок', () => {
    const { container } = render(
      <TourCard tour={makeTour({ name: 'Невідомий тур', countries: [], direction: 'Іспанія' })} />,
    );
    expect(mediaSlots(container).length).toBe(1);
    expect(screen.getAllByText('Іспанія').length).toBeGreaterThan(0);
  });

  it('showPhotos=false прибирає медіа (для щільних списків)', () => {
    const { container } = render(<TourCard tour={makeTour()} showPhotos={false} />);
    expect(mediaSlots(container)).toHaveLength(0);
  });

  it('код туру й статус лягають поверх медіа, а не дублюються нижче', () => {
    const { container } = render(<TourCard tour={makeTour()} />);
    expect(container.querySelector('.et-carousel__codeOn')?.textContent).toBe('LP26010301');
    // у шапці під фото коду вже немає
    expect(container.querySelectorAll('code')).toHaveLength(1);
  });
});
