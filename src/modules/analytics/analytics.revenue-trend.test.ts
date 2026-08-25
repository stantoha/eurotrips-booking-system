// =============================================================================
// EUROTRIPS — Analytics · getRevenueTrend
// Живить RevenueTrendChart дизайн-системи. Перевіряємо саме те, що легко
// зламати: місячні бакети (UTC), порожні місяці, виключення скасованих
// бронювань з обороту та перехід через межу року.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingStatus } from '@prisma/client';

const findMany = vi.fn();

vi.mock('../../shared/database/prisma', () => ({
  default: { booking: { findMany: (...args: unknown[]) => findMany(...args) } },
}));

import { AnalyticsService } from './analytics.service';

const service = new AnalyticsService();

/** Кінець періоду фіксуємо, щоб тест не «плив» із реальною датою */
const TO = new Date('2026-08-25T00:00:00Z');

beforeEach(() => findMany.mockReset());

describe('getRevenueTrend', () => {
  it('повертає рівно `months` точок, включно з порожніми місяцями', async () => {
    findMany.mockResolvedValue([]);

    const res = await service.getRevenueTrend({ dateTo: TO, months: 12 });

    expect(res.points).toHaveLength(12);
    expect(res.points[0].label).toBe('вер 25');
    expect(res.points[11].label).toBe('сер 26');
    // Порожні місяці мають бути в ряду, інакше лінія тренду «стрибає»
    expect(res.points.every((p) => p.revenue === 0 && p.bookings === 0)).toBe(true);
  });

  it('розкладає бронювання по правильних місяцях і рахує підсумки', async () => {
    findMany.mockResolvedValue([
      { createdAt: new Date('2026-08-02T10:00:00Z'), totalAmount: 840 },
      { createdAt: new Date('2026-08-20T10:00:00Z'), totalAmount: 1290 },
      { createdAt: new Date('2026-05-23T10:00:00Z'), totalAmount: 790 },
    ]);

    const res = await service.getRevenueTrend({ dateTo: TO, months: 12 });
    const aug = res.points.find((p) => p.label === 'сер 26');
    const may = res.points.find((p) => p.label === 'тра 26');

    expect(aug).toMatchObject({ revenue: 2130, bookings: 2 });
    expect(may).toMatchObject({ revenue: 790, bookings: 1 });
    expect(res.totals).toEqual({ revenue: 2920, bookings: 3 });
  });

  it('виключає скасовані та no-show з обороту (інакше тренд бреше)', async () => {
    findMany.mockResolvedValue([]);

    await service.getRevenueTrend({ dateTo: TO, months: 6 });

    const where = findMany.mock.calls[0][0].where;
    expect(where.status.notIn).toEqual(
      expect.arrayContaining([
        BookingStatus.cancelled_client,
        BookingStatus.cancelled_operator,
        BookingStatus.refund,
        BookingStatus.no_show,
      ]),
    );
  });

  it('коректно переходить через межу року', async () => {
    findMany.mockResolvedValue([]);

    const res = await service.getRevenueTrend({ dateTo: new Date('2026-02-15T00:00:00Z'), months: 4 });

    expect(res.points.map((p) => p.label)).toEqual(['лис 25', 'гру 25', 'січ 26', 'лют 26']);
  });

  it('бронювання поза періодом до ряду не потрапляє', async () => {
    findMany.mockResolvedValue([
      { createdAt: new Date('2020-01-01T10:00:00Z'), totalAmount: 9999 },
      { createdAt: new Date('2026-08-02T10:00:00Z'), totalAmount: 100 },
    ]);

    const res = await service.getRevenueTrend({ dateTo: TO, months: 12 });

    expect(res.totals.revenue).toBe(100);
    expect(res.totals.bookings).toBe(1);
  });
});
