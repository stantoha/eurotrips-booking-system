// =============================================================================
// EUROTRIPS — OPS-03: область унікальності місця в автобусі
//
// Бізнес-правило: місце унікальне в межах ВИЇЗДУ, а не бронювання. Дві різні
// родини на одному турі не можуть обидві сидіти на місці 14.
//
// Схема стверджувала протилежне — @@unique([bookingId, busSeaNumber]) — тобто
// БД дозволяла такий дубль. Сервіс частково компенсував це перевіркою
// SELECT ... FOR UPDATE, але констрейнт мусить відповідати правилу: FOR UPDATE
// на ще неіснуючих рядках нічого не блокує (це не gap-lock).
//
// Тут перевіряється рівень сервісу. Сам констрейнт БД перевіряється
// міграцією і тестом у test/integration/seat-uniqueness.test.ts.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole } from '@prisma/client';

const txMock = {
  bookingTourist: { findFirst: vi.fn(), update: vi.fn() },
  $queryRaw: vi.fn(),
};

vi.mock('../../shared/database/prisma', () => {
  const p = {
    $transaction: vi.fn(async (cb: any) => cb(txMock)),
    bookingTourist: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    booking: { findUnique: vi.fn() },
    tour: { findFirst: vi.fn(), findUnique: vi.fn() },
    hotelBooking: { findMany: vi.fn() },
  };
  return { default: p, prisma: p };
});

import prisma from '../../shared/database/prisma';
import { SeatMapService } from './seat-map.service';

const TOUR_ID = '77777777-7777-7777-7777-777777777777';
const TOURIST_ID = '88888888-8888-8888-8888-888888888888';

describe('OPS-03 · унікальність місця в межах виїзду', () => {
  let service: SeatMapService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SeatMapService();

    (prisma as any).bookingTourist.findFirst.mockResolvedValue({
      id: 'bt-001',
      bookingId: 'booking-001',
      tourId: TOUR_ID,
      touristId: TOURIST_ID,
    });
    txMock.$queryRaw.mockResolvedValue([]);
    txMock.bookingTourist.findFirst.mockResolvedValue(null);
    txMock.bookingTourist.update.mockResolvedValue({ id: 'bt-001', busSeatNumber: 14 });
  });

  it('шукає конфлікт по ВСЬОМУ туру, а не в межах одного бронювання', async () => {
    await service.assignSeatByTourist(TOUR_ID, TOURIST_ID, 14);

    expect(txMock.bookingTourist.findFirst).toHaveBeenCalledTimes(1);
    const where = txMock.bookingTourist.findFirst.mock.calls[0][0].where as any;

    // область пошуку — тур
    expect(where.tourId ?? where.booking?.tourId).toBe(TOUR_ID);
    // і НЕ звужена до одного бронювання
    expect(where.bookingId).toBeUndefined();
  });

  it('використовує busSeatNumber (виправлену назву), не busSeaNumber', async () => {
    await service.assignSeatByTourist(TOUR_ID, TOURIST_ID, 14);

    const where = txMock.bookingTourist.findFirst.mock.calls[0][0].where as any;
    expect(where).toHaveProperty('busSeatNumber', 14);
    expect(where).not.toHaveProperty('busSeaNumber');

    const data = txMock.bookingTourist.update.mock.calls[0][0].data as any;
    expect(data).toHaveProperty('busSeatNumber', 14);
    expect(data).not.toHaveProperty('busSeaNumber');
  });

  it('кидає SEAT_TAKEN, якщо місце вже зайняте іншим бронюванням того ж туру', async () => {
    txMock.bookingTourist.findFirst.mockResolvedValue({
      id: 'bt-999',
      bookingId: 'booking-999', // ІНШЕ бронювання, той самий тур
      tourId: TOUR_ID,
    });

    await expect(
      service.assignSeatByTourist(TOUR_ID, TOURIST_ID, 14),
    ).rejects.toMatchObject({ code: 'SEAT_TAKEN', statusCode: 409 });

    expect(txMock.bookingTourist.update).not.toHaveBeenCalled();
  });

  it('звільнення місця (null) не потребує перевірки конфлікту', async () => {
    (prisma as any).bookingTourist.update.mockResolvedValue({
      id: 'bt-001', busSeatNumber: null,
    });

    await service.assignSeatByTourist(TOUR_ID, TOURIST_ID, null);

    const data = (prisma as any).bookingTourist.update.mock.calls[0][0].data;
    expect(data).toEqual({ busSeatNumber: null });
  });
});
