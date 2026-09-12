// =============================================================================
// EUROTRIPS — Seat Map & Preferences Service
// GET  /bookings/:id/seat-map                          — схема автобуса туру
// PATCH /bookings/:id/tourist/:tId/preferences (BR-12)  — self-service побажань
//
// Роль 'tourist' підключена: ownership перевіряється через user.touristId
// (JWT, User.touristId → Tourist.id) — турист може редагувати побажання
// ТІЛЬКИ свого запису bookingTourist (:tId param має збігатись з
// user.touristId), інакше 403 (IDOR-захист).
// =============================================================================

import { BookingStatus, RoomingStatus, UserRole, Prisma } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { Errors, AppError } from '../../shared/utils/errors';
import type { PatchPreferencesDto } from './seat-map.schema';
import type { JwtPayload } from '../auth/auth.types';

/** BR-12: побажання дозволені тільки з цього статусу і далі (щасливий шлях) */
const STATUSES_AT_LEAST_CONFIRMED: BookingStatus[] = [
  BookingStatus.confirmed,
  BookingStatus.docs_collected,
  BookingStatus.ready_to_depart,
  BookingStatus.on_trip,
  BookingStatus.completed,
];

export class SeatMapService {

  // ── GET /bookings/:id/seat-map ───────────────────────────────────────────────
  async getSeatMap(bookingId: string, user: JwtPayload) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw Errors.notFound('Бронювання', bookingId);

    // IDOR: агент бачить тільки своє бронювання
    if (user.role === UserRole.agent && booking.agentId !== user.agentId) {
      throw Errors.forbidden('Доступ до чужого бронювання заборонено');
    }

    return this.buildSeatMap(booking.tourId, user);
  }

  // ── GET /tours/:id/seat-map (OPS-17, без потреби в bookingId) ────────────────
  async getSeatMapByTour(tourId: string, user: JwtPayload) {
    const tour = await prisma.tour.findFirst({ where: { id: tourId, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', tourId);
    return this.buildSeatMap(tourId, user);
  }

  private async buildSeatMap(tourId: string, user: JwtPayload) {
    const tour = await prisma.tour.findUnique({ where: { id: tourId } });
    if (!tour) throw Errors.notFound('Тур', tourId);

    // Місце в автобусі унікальне в межах усього виїзду, не одного booking.
    // tourId тепер лежить на самому учаснику (денормалізація під констрейнт
    // @@unique([tourId, busSeatNumber])), тож join через booking не потрібен.
    const occupied = await prisma.bookingTourist.findMany({
      where: {
        busSeatNumber: { not: null },
        tourId,
      },
      select: {
        busSeatNumber: true,
        touristId: true,
        tourist: { select: { firstName: true, lastName: true } },
      },
    });

    const occupiedBySeat = new Map(occupied.map((o) => [o.busSeatNumber as number, o]));

    const seats = Array.from({ length: tour.totalSeats }, (_, i) => {
      const seatNumber = i + 1;
      const occupant = occupiedBySeat.get(seatNumber);
      const isOccupied = Boolean(occupant);

      // Турист бачить тільки is_occupied, без імен (CLAUDE.md розділ 6)
      if (user.role === UserRole.tourist) {
        return { seatNumber, isOccupied };
      }

      return {
        seatNumber,
        isOccupied,
        touristId: occupant?.touristId ?? null,
        touristName: occupant ? `${occupant.tourist.lastName} ${occupant.tourist.firstName}` : null,
      };
    });

    return { tourId: tour.id, totalSeats: tour.totalSeats, seats };
  }

  // ── PATCH /tours/:id/tourist/:touristId/seat (OPS-17, призначення ops) ───────
  async assignSeatByTourist(tourId: string, touristId: string, seatNumber: number | null) {
    const bookingTourist = await prisma.bookingTourist.findFirst({
      where: { touristId, tourId },
    });
    if (!bookingTourist) throw Errors.notFound('Учасник туру', touristId);

    if (seatNumber === null) {
      const updated = await prisma.bookingTourist.update({
        where: { id: bookingTourist.id },
        data: { busSeatNumber: null },
      });
      return updated;
    }

    return prisma.$transaction(async (tx) => {
      // SELECT ... FOR UPDATE лишається як швидкий шлях: він серіалізує
      // паралельні призначення на ВЖЕ зайняте місце і дає зрозумілий 409
      // замість помилки констрейнту. Але він не gap-lock: на ще неіснуючому
      // рядку (місце вільне) нічого не блокує. Останнє слово — за
      // @@unique([tourId, busSeatNumber]), який ловить решту гонок.
      await tx.$queryRaw(Prisma.sql`
        SELECT bt.id FROM booking_tourists bt
        WHERE bt.tour_id = ${tourId}::uuid AND bt.bus_seat_number = ${seatNumber}
        FOR UPDATE
      `);

      const conflict = await tx.bookingTourist.findFirst({
        where: {
          busSeatNumber: seatNumber,
          id: { not: bookingTourist.id },
          tourId,
        },
      });
      if (conflict) {
        throw new AppError('SEAT_TAKEN', `Місце ${seatNumber} вже зайняте`, 409);
      }

      try {
        return await tx.bookingTourist.update({
          where: { id: bookingTourist.id },
          data: { busSeatNumber: seatNumber },
        });
      } catch (err) {
        // P2002 = порушення unique. Означає, що місце перехопили між нашою
        // перевіркою і записом — віддаємо той самий 409, що й при conflict.
        if ((err as { code?: string }).code === 'P2002') {
          throw new AppError('SEAT_TAKEN', `Місце ${seatNumber} вже зайняте`, 409);
        }
        throw err;
      }
    });
  }

  // ── PATCH /bookings/:id/tourist/:tId/preferences (BR-12) ─────────────────────
  async setPreferences(
    bookingId: string,
    touristId: string,
    dto: PatchPreferencesDto,
    user: JwtPayload
  ) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw Errors.notFound('Бронювання', bookingId);

    if (user.role === UserRole.agent && booking.agentId !== user.agentId) {
      throw Errors.forbidden('Доступ до чужого бронювання заборонено');
    }

    // IDOR: турист редагує тільки власні побажання (touristId з JWT)
    if (user.role === UserRole.tourist && touristId !== user.touristId) {
      throw Errors.forbidden('Доступ до чужих побажань заборонено');
    }

    const bookingTourist = await prisma.bookingTourist.findFirst({
      where: { bookingId, touristId },
    });
    if (!bookingTourist) throw Errors.notFound('Учасник бронювання', touristId);

    // BR-12: перевірка статусу бронювання — щонайменше confirmed
    if (!STATUSES_AT_LEAST_CONFIRMED.includes(booking.status)) {
      throw Errors.forbidden(
        `Побажання можна вносити тільки з моменту підтвердження бронювання (поточний статус: ${booking.status})`
      );
    }

    const hotelBookings = await prisma.hotelBooking.findMany({ where: { tourId: booking.tourId } });

    // BR-12: якщо фінальний румінг уже закрито — self-service заблоковано
    if (hotelBookings.some((hb) => hb.finalRoomingDone)) {
      throw Errors.forbidden('Розміщення вже фіналізовано — зміна побажань неможлива');
    }

    // BR-12: якщо структура готелю ще в чернетці — інформаційне повідомлення, без запису
    const stillDraft = hotelBookings.length === 0 || hotelBookings.some((hb) => hb.structureStatus === RoomingStatus.draft);
    if (stillDraft) {
      return {
        applied: false,
        message: 'Розміщення ще готується. Спробуйте пізніше, коли структура номерів буде затверджена.',
      };
    }

    // Унікальність місця в межах ВИЇЗДУ: FOR UPDATE як швидкий шлях,
    // @@unique([tourId, busSeatNumber]) — як остаточна гарантія (див.
    // коментар у assignSeatByTourist).
    if (dto.busSeatNumber !== undefined && dto.busSeatNumber !== null) {
      const seatNumber = dto.busSeatNumber;

      const updated = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`
          SELECT bt.id FROM booking_tourists bt
          WHERE bt.tour_id = ${booking.tourId}::uuid AND bt.bus_seat_number = ${seatNumber}
          FOR UPDATE
        `);

        const conflict = await tx.bookingTourist.findFirst({
          where: {
            busSeatNumber: seatNumber,
            id: { not: bookingTourist.id },
            tourId: booking.tourId,
          },
        });
        if (conflict) {
          throw new AppError('SEAT_TAKEN', `Місце ${seatNumber} вже зайняте`, 409);
        }

        try {
          return await tx.bookingTourist.update({
            where: { id: bookingTourist.id },
            data: {
              busSeatNumber: seatNumber,
              ...(dto.preferredRoomType !== undefined && { preferredRoomType: dto.preferredRoomType }),
              ...(dto.roommatePreference !== undefined && { roommatePreference: dto.roommatePreference }),
            },
          });
        } catch (err) {
          if ((err as { code?: string }).code === 'P2002') {
            throw new AppError('SEAT_TAKEN', `Місце ${seatNumber} вже зайняте`, 409);
          }
          throw err;
        }
      });

      return { applied: true, data: updated };
    }

    const updated = await prisma.bookingTourist.update({
      where: { id: bookingTourist.id },
      data: {
        ...(dto.preferredRoomType !== undefined && { preferredRoomType: dto.preferredRoomType }),
        ...(dto.busSeatNumber === null && { busSeatNumber: null }),
        ...(dto.roommatePreference !== undefined && { roommatePreference: dto.roommatePreference }),
      },
    });

    return { applied: true, data: updated };
  }
}
