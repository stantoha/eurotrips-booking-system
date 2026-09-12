// =============================================================================
// EUROTRIPS — BR-01 у зміні totalSeats
//
// Тут транзакції не було взагалі: читання туру, обчислення bookedSeats і запис
// нового availableSeats — три окремі кроки на кореневому prisma. Бронювання,
// що встигло пройти між читанням і записом, губилося: availableSeats
// перезаписувався абсолютним значенням, порахованим ДО нього.
//
// Рішення сильніше за буквальну вимогу ТЗ («обгорнути транзакцією»):
// availableSeats зсувається на ту саму дельту, що й totalSeats (кількість
// проданих місць не змінюється), а не присвоюється абсолютно. Плюс guard у
// WHERE не дає піти в мінус. Так паралельне бронювання не губиться.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

const txMock = {
  tour: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  auditLog: { create: vi.fn() },
};

vi.mock('../../shared/database/prisma', () => {
  const p = {
    $transaction: vi.fn(async (cb: any) => cb(txMock)),
    tour: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  return { default: p, prisma: p };
});

import prisma from '../../shared/database/prisma';
import { ToursService } from './tours.service';

const TOUR_ID = '66666666-6666-6666-6666-666666666666';

// 50 всього, 20 вільних → 30 продано
const baseTour = {
  id: TOUR_ID,
  status: 'open',
  isArchived: false,
  totalSeats: 50,
  availableSeats: 20,
  basePrice: 500,
  costPrice: 300,
  departureDate: new Date('2026-12-01'),
};

describe('BR-01 · updateTour: перерахунок місць', () => {
  let service: ToursService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ToursService();

    txMock.tour.findFirst.mockResolvedValue({ ...baseTour });
    txMock.tour.updateMany.mockResolvedValue({ count: 1 });
    txMock.tour.findUniqueOrThrow.mockResolvedValue({
      ...baseTour, totalSeats: 60, availableSeats: 30,
    });
    txMock.tour.update.mockResolvedValue({ ...baseTour });
    txMock.auditLog.create.mockResolvedValue({});
    (prisma as any).auditLog.create.mockResolvedValue({});
  });

  it('перерахунок місць виконується всередині транзакції', async () => {
    await service.updateTour(TOUR_ID, { totalSeats: 60 } as any, 'user-001');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // читання туру мусить бути на tx, а не на кореневому prisma
    expect(txMock.tour.findFirst).toHaveBeenCalled();
    expect((prisma as any).tour.findFirst).not.toHaveBeenCalled();
  });

  it('зсуває availableSeats на ту саму дельту, а не присвоює абсолютно', async () => {
    await service.updateTour(TOUR_ID, { totalSeats: 60 } as any, 'user-001');

    expect(txMock.tour.updateMany).toHaveBeenCalledTimes(1);
    const call = txMock.tour.updateMany.mock.calls[0][0] as any;

    expect(call.data.totalSeats).toBe(60);
    // 50 → 60, тобто +10 місць; продані 30 лишаються проданими
    expect(call.data.availableSeats).toEqual({ increment: 10 });
  });

  it('при зменшенні ставить guard у WHERE, щоб не піти в мінус', async () => {
    txMock.tour.findUniqueOrThrow.mockResolvedValue({
      ...baseTour, totalSeats: 40, availableSeats: 10,
    });

    await service.updateTour(TOUR_ID, { totalSeats: 40 } as any, 'user-001');

    const call = txMock.tour.updateMany.mock.calls[0][0] as any;
    // дельта -10 → потрібно щонайменше 10 вільних місць
    expect(call.where).toMatchObject({ id: TOUR_ID, availableSeats: { gte: 10 } });
    expect(call.data.availableSeats).toEqual({ increment: -10 });
  });

  it('відхиляє зменшення нижче кількості проданих (claim не спрацював)', async () => {
    // продано 30, просимо 20 → guard не пройде, count = 0
    txMock.tour.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateTour(TOUR_ID, { totalSeats: 20 } as any, 'user-001'),
    ).rejects.toMatchObject({ code: 'SEATS_REDUCE_CONFLICT', statusCode: 409 });
  });

  it('без зміни totalSeats місця не чіпає', async () => {
    txMock.tour.update.mockResolvedValue({ ...baseTour, name: 'Нова назва' });

    await service.updateTour(TOUR_ID, { name: 'Нова назва' } as any, 'user-001');

    expect(txMock.tour.updateMany).not.toHaveBeenCalled();
    const call = txMock.tour.update.mock.calls[0][0] as any;
    expect(call.data.availableSeats).toBeUndefined();
    expect(call.data.totalSeats).toBeUndefined();
  });
});
