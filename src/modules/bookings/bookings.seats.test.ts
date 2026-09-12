// =============================================================================
// EUROTRIPS — BR-01: атомарне списання місць
//
// Регресія на гонку овербукінгу. Перевірка наявності місць і декремент мають
// бути ОДНИМ SQL-стейтментом (`updateMany` з умовою у WHERE), інакше на
// дефолтному для PostgreSQL READ COMMITTED дві паралельні транзакції обидві
// проходять перевірку і обидві віднімають місця.
//
// Транзакція від цього не рятує — вона не бере блокування на прочитаний рядок.
//
// Ці тести навмисно перевіряють ФОРМУ запиту, а не результат: результат на
// моках виглядає правильним і в зламаному коді. Реальний конкурентний тест —
// у bookings.seats.concurrency.test.ts, він потребує живої БД.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole } from '@prisma/client';

// ── Моки ──────────────────────────────────────────────────────────────────

const txMock = {
  tour: {
    updateMany: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  booking: { create: vi.fn(), update: vi.fn() },
  bookingTourist: { create: vi.fn(), createMany: vi.fn() },
  agent: { findUnique: vi.fn() },
  agentCommission: { create: vi.fn() },
  auditLog: { create: vi.fn() },
};

vi.mock('../../shared/database/prisma', () => {
  const p = {
    $transaction: vi.fn(async (cb: any) => cb(txMock)),
    tour: { findFirst: vi.fn(), findUnique: vi.fn() },
    lead: { findUnique: vi.fn() },
    booking: { findFirst: vi.fn() },
  };
  return { default: p, prisma: p };
});

vi.mock('../../shared/utils/booking-number', () => ({
  generateBookingNumber: vi.fn().mockResolvedValue('ET-2026-00001'),
}));

vi.mock('../communications/email.queue', () => ({
  getEmailQueue: vi.fn(),
  schedulePaymentReminders: vi.fn().mockResolvedValue(undefined),
  schedulePreDepartureEmail: vi.fn().mockResolvedValue(undefined),
  cancelBookingEmailJobs: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../communications/telegram.service', () => ({
  notifyBookingConfirmed: vi.fn().mockResolvedValue(undefined),
}));

import prisma from '../../shared/database/prisma';
import { BookingsService } from './bookings.service';
import type { JwtPayload } from '../auth/auth.types';

const manager: JwtPayload = {
  sub: 'user-manager-001',
  email: 'manager@eurotrips.ua',
  role: UserRole.manager,
  agentId: null,
  agentType: null,
  networkId: null,
  touristId: null,
};

const TOUR_ID = '11111111-1111-1111-1111-111111111111';

const dto: any = {
  tourId: TOUR_ID,
  bookingType: 'direct',
  contactTouristId: '22222222-2222-2222-2222-222222222222',
  personsCount: 2,
  totalAmount: 1000,
  depositAmount: 300,
};

function resetMocks() {
  vi.clearAllMocks();
  txMock.tour.updateMany.mockResolvedValue({ count: 1 });
  txMock.tour.findFirst.mockResolvedValue({
    id: TOUR_ID,
    basePrice: 500,
    totalSeats: 50,
    availableSeats: 48,
    departureDate: new Date('2026-12-01'),
    cancelPolicy: null,
  });
  txMock.tour.findUnique.mockResolvedValue({ id: TOUR_ID });
  txMock.booking.create.mockResolvedValue({ id: 'booking-001', tourId: TOUR_ID });
  txMock.bookingTourist.create.mockResolvedValue({});
  txMock.bookingTourist.createMany.mockResolvedValue({ count: 1 });
  txMock.agent.findUnique.mockResolvedValue(null);
  txMock.auditLog.create.mockResolvedValue({});
}

describe('BR-01 · createBooking: атомарне списання місць', () => {
  let service: BookingsService;

  beforeEach(() => {
    resetMocks();
    service = new BookingsService();
  });

  it('claims місця одним updateMany з умовою availableSeats у WHERE', async () => {
    await service.createBooking(dto, manager);

    expect(txMock.tour.updateMany).toHaveBeenCalledTimes(1);

    const call = txMock.tour.updateMany.mock.calls[0][0] as any;

    // Умова наявності місць мусить бути саме у WHERE того ж стейтменту,
    // що й декремент — інакше між перевіркою і записом є вікно гонки.
    expect(call.where).toMatchObject({
      id: TOUR_ID,
      availableSeats: { gte: dto.personsCount },
    });
    expect(call.data).toEqual({
      availableSeats: { decrement: dto.personsCount },
    });
  });

  it('НЕ використовує неатомарний tour.update для списання місць', async () => {
    await service.createBooking(dto, manager);

    const decremented = txMock.tour.update.mock.calls.some(
      (c: any[]) => c[0]?.data?.availableSeats?.decrement !== undefined,
    );
    expect(decremented).toBe(false);
  });

  it('кидає SEATS_UNAVAILABLE, коли claim не спрацював (count === 0)', async () => {
    txMock.tour.updateMany.mockResolvedValue({ count: 0 });
    txMock.tour.findUnique.mockResolvedValue({ id: TOUR_ID }); // тур існує

    await expect(service.createBooking(dto, manager)).rejects.toMatchObject({
      code: 'SEATS_UNAVAILABLE',
      statusCode: 409,
    });

    expect(txMock.booking.create).not.toHaveBeenCalled();
  });

  it('кидає NOT_FOUND, коли туру взагалі немає', async () => {
    txMock.tour.updateMany.mockResolvedValue({ count: 0 });
    txMock.tour.findUnique.mockResolvedValue(null);

    await expect(service.createBooking(dto, manager)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('claim відбувається всередині транзакції, не повз неї', async () => {
    await service.createBooking(dto, manager);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // updateMany викликано на tx-об'єкті (txMock), а не на кореневому prisma
    expect((prisma as any).tour.updateMany).toBeUndefined();
    expect(txMock.tour.updateMany).toHaveBeenCalled();
  });
});
