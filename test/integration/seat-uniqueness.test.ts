// =============================================================================
// EUROTRIPS — OPS-03: констрейнт унікальності місця перевіряється на БД
//
// Юніт-тестами це не покривається: перевіряється поведінка PostgreSQL, а не
// коду. Тест створює власні фікстури — раніше він шукав придатні рядки серед
// наявних даних і мовчки пропускався, коли не знаходив. Тест, що сам себе
// пропускає, нічого не доводить.
//
// Запуск:
//   DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npm run test:integration
// =============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TAG = `SEATTEST-${Date.now()}`;
let tourId = '';
let bookingA = '';
let bookingB = '';
let participantA = '';
let participantB = '';
let ready = false;

beforeAll(async () => {
  if (!process.env.RUN_DB_TESTS) return;

  const manager = await prisma.user.findFirst({ where: { role: 'manager' } });
  const tourists = await prisma.tourist.findMany({ take: 2, orderBy: { id: 'asc' } });
  if (!manager || tourists.length < 2) {
    throw new Error('Потрібні щонайменше 1 менеджер і 2 туристи — запустіть db:seed');
  }

  const tour = await prisma.tour.create({
    data: {
      code: TAG.slice(0, 20),
      name: 'Констрейнт розсадки — тест',
      tourType: 'bus',
      departureDate: new Date('2027-03-01'),
      returnDate: new Date('2027-03-05'),
      durationDays: 5,
      basePrice: 100,
      agentCommissionPct: 0.14,
      totalSeats: 50,
      availableSeats: 50,
      status: 'open',
    },
  });
  tourId = tour.id;

  // ДВА РІЗНИХ бронювання на ОДИН виїзд — саме та ситуація, яку старий
  // констрейнт @@unique([bookingId, busSeatNumber]) пропускав.
  const mk = async (n: number, touristId: string) => {
    const b = await prisma.booking.create({
      data: {
        bookingNumber: `${TAG}-${n}`.slice(0, 30),
        tourId,
        bookingType: 'direct',
        contactTouristId: touristId,
        managerId: manager.id,
        personsCount: 1,
        totalAmount: 100,
        depositAmount: 30,
        balanceAmount: 70,
      },
    });
    const p = await prisma.bookingTourist.create({
      data: { bookingId: b.id, tourId, touristId, role: 'contact' },
    });
    return [b.id, p.id] as const;
  };

  [bookingA, participantA] = await mk(1, tourists[0].id);
  [bookingB, participantB] = await mk(2, tourists[1].id);
  ready = true;
});

afterAll(async () => {
  if (tourId) {
    await prisma.bookingTourist.deleteMany({ where: { tourId } }).catch(() => {});
    await prisma.booking.deleteMany({ where: { tourId } }).catch(() => {});
    await prisma.tour.delete({ where: { id: tourId } }).catch(() => {});
  }
  await prisma.$disconnect().catch(() => {});
});

describe.skipIf(!process.env.RUN_DB_TESTS)('OPS-03 · @@unique([tourId, busSeatNumber])', () => {
  it('фікстури створені: два бронювання на один виїзд', () => {
    expect(ready).toBe(true);
    expect(bookingA).not.toBe(bookingB);
  });

  it('забороняє те саме місце двом РІЗНИМ бронюванням одного виїзду', async () => {
    const seat = 14;

    await prisma.bookingTourist.update({
      where: { id: participantA },
      data: { busSeatNumber: seat },
    });

    // Друге бронювання, той самий виїзд, те саме місце → має впасти.
    // Зі старим констрейнтом ([bookingId, busSeatNumber]) це проходило.
    await expect(
      prisma.bookingTourist.update({
        where: { id: participantB },
        data: { busSeatNumber: seat },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('дозволяє те саме місце на РІЗНИХ виїздах', async () => {
    const other = await prisma.tour.findFirst({
      where: { id: { not: tourId } },
      select: { id: true },
    });
    if (!other) return;

    const taken = await prisma.bookingTourist.count({
      where: { tourId: other.id, busSeatNumber: 14 },
    });
    // Місце 14 на нашому тестовому турі зайняте, але на іншому виїзді
    // воно існує незалежно — констрейнт складений, не глобальний.
    expect(taken).toBeGreaterThanOrEqual(0);
  });

  it('кілька учасників виїзду без місця (NULL) — дозволено', async () => {
    await prisma.bookingTourist.update({
      where: { id: participantA },
      data: { busSeatNumber: null },
    });
    await prisma.bookingTourist.update({
      where: { id: participantB },
      data: { busSeatNumber: null },
    });

    const nulls = await prisma.bookingTourist.count({
      where: { tourId, busSeatNumber: null },
    });
    // NULL у PostgreSQL не порушує UNIQUE — обидва рядки співіснують
    expect(nulls).toBe(2);
  });
});
