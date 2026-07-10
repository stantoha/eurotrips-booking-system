// =============================================================================
// EUROTRIPS — Rooming Trigger Scanner (BR-11)
// Періодичне сканування HotelBooking на предмет тригерів румінгу:
//   Тригер A: confirmedTourists >= 30 по туру
//   Тригер Б: (departureDate - today) <= 14 днів
// Дедуплікація: не повторювати протягом 7 днів (roomingTriggerSentAt).
// Виняток: isFastLaunch === true → тригер не спрацьовує (CLAUDE.md BR-11).
// Після спрацювання: opsRoomingRequired = true.
// =============================================================================

import { PrismaClient, BookingStatus } from '@prisma/client';
import { notifyRoomingRequired } from '../communications/telegram.service';

const CONFIRMED_AND_BEYOND: BookingStatus[] = [
  BookingStatus.confirmed,
  BookingStatus.docs_collected,
  BookingStatus.ready_to_depart,
  BookingStatus.on_trip,
  BookingStatus.completed,
];

const CONFIRMED_TOURISTS_THRESHOLD = 30;
const DAYS_BEFORE_DEPARTURE_THRESHOLD = 14;
const DEDUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface RoomingTriggerResult {
  hotelBookingId: string;
  tourId: string;
  tourCode: string;
  reason: 'confirmed_tourists' | 'departure_proximity';
  confirmedTourists: number;
  daysToDeparture: number;
}

/**
 * Сканує всі HotelBooking, де тригер ще не спрацював, і повертає
 * список тих, для яких умова BR-11 виконана зараз. Оновлює
 * roomingTriggerSentAt/opsRoomingRequired для кожного спрацьованого запису.
 */
export async function scanRoomingTriggers(
  prisma: PrismaClient,
  logger: { info: (msg: string, meta?: object) => void; warn: (msg: string, meta?: object) => void },
): Promise<RoomingTriggerResult[]> {
  const now = new Date();

  const candidates = await prisma.hotelBooking.findMany({
    where: { opsRoomingRequired: false, isFastLaunch: false },
    include: { tour: { select: { id: true, code: true, departureDate: true } } },
  });

  const triggered: RoomingTriggerResult[] = [];

  for (const hb of candidates) {
    // Дедуплікація — не перевіряти повторно, якщо вже сповіщали цього тижня
    if (hb.roomingTriggerSentAt && now.getTime() - hb.roomingTriggerSentAt.getTime() < DEDUP_WINDOW_MS) {
      continue;
    }

    const confirmedTourists = await prisma.bookingTourist.count({
      where: { booking: { tourId: hb.tourId, status: { in: CONFIRMED_AND_BEYOND } } },
    });

    const daysToDeparture = Math.ceil(
      (hb.tour.departureDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );

    const byCount = confirmedTourists >= CONFIRMED_TOURISTS_THRESHOLD;
    const byDate = daysToDeparture <= DAYS_BEFORE_DEPARTURE_THRESHOLD;

    if (!byCount && !byDate) continue;

    await prisma.hotelBooking.update({
      where: { id: hb.id },
      data: { roomingTriggerSentAt: now, opsRoomingRequired: true },
    });

    const result: RoomingTriggerResult = {
      hotelBookingId: hb.id,
      tourId: hb.tourId,
      tourCode: hb.tour.code,
      reason: byCount ? 'confirmed_tourists' : 'departure_proximity',
      confirmedTourists,
      daysToDeparture,
    };
    triggered.push(result);

    logger.info(
      `🛏 BR-11: тур ${hb.tour.code} потребує румінгу (${result.reason}, ${confirmedTourists} туристів, ${daysToDeparture} днів до виїзду)`
    );

    // C5: Telegram-нотифікація ops (fire-and-forget — збій не повинен зупиняти скан)
    notifyRoomingRequired(prisma, logger, {
      tourCode: result.tourCode,
      reason: result.reason,
      confirmedTourists: result.confirmedTourists,
      daysToDeparture: result.daysToDeparture,
    }).catch((err) => logger.info(`Telegram BR-11 нотифікація: помилка ${err instanceof Error ? err.message : err}`));
  }

  return triggered;
}
