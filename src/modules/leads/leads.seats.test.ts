// =============================================================================
// EUROTRIPS — BR-01 у конверсії ліда
//
// Тут гонка гірша, ніж у createBooking: перевірка наявності місць виконувалась
// через кореневий `prisma`, тобто ПОЗА транзакцією, а всередині транзакції був
// голий decrement без жодної умови.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole } from '@prisma/client';

const txMock = {
  tour: { updateMany: vi.fn(), update: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  booking: { create: vi.fn(), update: vi.fn() },
  bookingTourist: { create: vi.fn() },
  lead: { update: vi.fn() },
  agentCommission: { create: vi.fn() },
  auditLog: { create: vi.fn() },
};

vi.mock('../../shared/database/prisma', () => {
  const p = {
    $transaction: vi.fn(async (cb: any) => cb(txMock)),
    lead: { findUnique: vi.fn(), update: vi.fn() },
    tour: { findFirst: vi.fn(), findUnique: vi.fn() },
    tourist: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  };
  return { default: p, prisma: p };
});

vi.mock('../../shared/utils/booking-number', () => ({
  generateBookingNumber: vi.fn().mockResolvedValue('ET-2026-00002'),
}));

import prisma from '../../shared/database/prisma';
import { LeadsService } from './leads.service';
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

const TOUR_ID = '33333333-3333-3333-3333-333333333333';
const LEAD_ID = '44444444-4444-4444-4444-444444444444';

const dto: any = {
  tourId: TOUR_ID,
  bookingType: 'direct',
  personsCount: 3,
  totalAmount: 1500,
  depositAmount: 500,
};

describe('BR-01 · convertToBooking: атомарне списання місць', () => {
  let service: LeadsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LeadsService();

    (prisma as any).lead.findUnique.mockResolvedValue({
      id: LEAD_ID,
      touristId: '55555555-5555-5555-5555-555555555555',
      managerId: manager.sub,
      agentId: null,
      agent: null,
      tourist: {},
      source: 'site',
      personsCount: 3,
      convertedToBookingId: null,
    });

    txMock.tour.updateMany.mockResolvedValue({ count: 1 });
    txMock.tour.findFirst.mockResolvedValue({ id: TOUR_ID, basePrice: 400 });
    txMock.tour.findUnique.mockResolvedValue({ id: TOUR_ID });
    txMock.booking.create.mockResolvedValue({ id: 'booking-002', tourId: TOUR_ID });
    txMock.bookingTourist.create.mockResolvedValue({});
    txMock.lead.update.mockResolvedValue({});
    txMock.auditLog.create.mockResolvedValue({});
  });

  it('claims місця одним updateMany з умовою у WHERE', async () => {
    await service.convertToBooking(LEAD_ID, dto, manager);

    expect(txMock.tour.updateMany).toHaveBeenCalledTimes(1);
    const call = txMock.tour.updateMany.mock.calls[0][0] as any;

    expect(call.where).toMatchObject({
      id: TOUR_ID,
      availableSeats: { gte: dto.personsCount },
    });
    expect(call.data).toEqual({
      availableSeats: { decrement: dto.personsCount },
    });
  });

  it('перевірка місць НЕ виконується повз транзакцію через кореневий prisma', async () => {
    await service.convertToBooking(LEAD_ID, dto, manager);

    // До правки тут був prisma.tour.findFirst з умовою availableSeats —
    // тобто перевірка жила поза транзакцією.
    const leakedCheck = (prisma as any).tour.findFirst.mock.calls.some(
      (c: any[]) => c[0]?.where?.availableSeats !== undefined,
    );
    expect(leakedCheck).toBe(false);
  });

  it('кидає SEATS_UNAVAILABLE, коли claim не спрацював', async () => {
    txMock.tour.updateMany.mockResolvedValue({ count: 0 });
    txMock.tour.findUnique.mockResolvedValue({ id: TOUR_ID });

    await expect(service.convertToBooking(LEAD_ID, dto, manager)).rejects.toMatchObject({
      code: 'SEATS_UNAVAILABLE',
    });

    expect(txMock.booking.create).not.toHaveBeenCalled();
  });
});
