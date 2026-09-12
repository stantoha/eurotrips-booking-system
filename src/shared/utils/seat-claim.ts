// =============================================================================
// EUROTRIPS — BR-01: атомарне списання місць туру
//
// Чому не findFirst + update:
//   PostgreSQL за замовчуванням працює на READ COMMITTED. SELECT не бере
//   блокування на прочитаний рядок, тому дві паралельні транзакції обидві
//   бачать availableSeats = 1, обидві проходять перевірку і обидві роблять
//   decrement. Результат — availableSeats = -1 і овербукінг, який виявляється
//   на посадці в автобус.
//
//   `updateMany` з умовою у WHERE виконує перевірку й запис одним SQL-
//   стейтментом. UPDATE бере блокування рядка, тож друга транзакція чекає,
//   перечитує актуальне значення і її WHERE вже не збігається → count = 0.
//
// Альтернативи, свідомо не обрані:
//   SELECT ... FOR UPDATE — зайвий round-trip, той самий ефект;
//   SERIALIZABLE — потребує retry-логіки на 40001 по всьому проєкту;
//   CHECK (available_seats >= 0) — захищає БД, але дає 500 замість 409.
// =============================================================================

import { Prisma, TourStatus } from '@prisma/client';
import { Errors } from './errors';

/**
 * Статуси туру, у яких дозволено займати місця (BR-01).
 * Звірено з `enum TourStatus` у schema.prisma: draft/closed/on_tour/completed/
 * cancelled місць не продають.
 */
export const SEAT_CLAIMABLE_TOUR_STATUSES: TourStatus[] = [
  TourStatus.open,
  TourStatus.active,
  TourStatus.almost_full,
];

/**
 * Атомарно займає `seats` місць у турі.
 *
 * Викликати ТІЛЬКИ всередині транзакції — щоб claim відкотився разом зі
 * створенням бронювання, якщо подальші кроки впадуть.
 *
 * @throws AppError NOT_FOUND      — туру не існує
 * @throws AppError SEATS_UNAVAILABLE — тур є, але місць не вистачає або
 *                                     статус не дозволяє продаж
 */
export async function claimSeats(
  tx: Prisma.TransactionClient,
  tourId: string,
  seats: number,
): Promise<void> {
  const claimed = await tx.tour.updateMany({
    where: {
      id: tourId,
      isArchived: false,
      availableSeats: { gte: seats },
      status: { in: SEAT_CLAIMABLE_TOUR_STATUSES },
    },
    data: { availableSeats: { decrement: seats } },
  });

  if (claimed.count === 0) {
    // Розрізняємо «туру немає» і «місць немає» — різні коди для клієнта
    const exists = await tx.tour.findUnique({ where: { id: tourId } });
    if (!exists) throw Errors.notFound('Тур', tourId);
    throw Errors.seatsUnavailable();
  }
}
