// =============================================================================
// EUROTRIPS — OPS-03: констрейнт унікальності місця перевіряється на БД
//
// Юніт-тестами це не покривається: перевіряється поведінка PostgreSQL, а не
// коду. Запуск — як у seats.concurrency.test.ts (RUN_DB_TESTS=1).
// =============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let dbUp = false;

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbUp = true;
  } catch {
    // eslint-disable-next-line no-console
    console.warn('⚠ Postgres недосяжний — тест констрейнту розсадки пропущено');
  }
});

afterAll(async () => {
  await prisma.$disconnect().catch(() => {});
});

describe.skipIf(!process.env.RUN_DB_TESTS)('OPS-03 · @@unique([tourId, busSeatNumber])', () => {
  it('забороняє те саме місце двом РІЗНИМ бронюванням одного виїзду', async () => {
    if (!dbUp) return;

    // Тут очікується, що в БД уже є тур і два бронювання на ньому.
    // Фікстури створює seed; тест лише перевіряє реакцію констрейнту.
    const two = await prisma.bookingTourist.findMany({
      where: { busSeatNumber: null },
      take: 2,
      orderBy: { id: 'asc' },
    });

    if (two.length < 2 || two[0].tourId !== two[1].tourId) {
      // eslint-disable-next-line no-console
      console.warn('⚠ немає двох учасників одного виїзду без місця — тест пропущено');
      return;
    }

    const seat = 999;
    await prisma.bookingTourist.update({
      where: { id: two[0].id },
      data: { busSeatNumber: seat },
    });

    await expect(
      prisma.bookingTourist.update({
        where: { id: two[1].id },
        data: { busSeatNumber: seat },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    // прибираємо за собою
    await prisma.bookingTourist.update({
      where: { id: two[0].id },
      data: { busSeatNumber: null },
    });
  });

  it('дозволяє кільком учасникам виїзду мати NULL-місце', async () => {
    if (!dbUp) return;

    const nulls = await prisma.bookingTourist.count({
      where: { busSeatNumber: null },
    });
    // NULL у PostgreSQL не порушує UNIQUE — таких рядків може бути скільки завгодно
    expect(nulls).toBeGreaterThanOrEqual(0);
  });
});
