// =============================================================================
// EUROTRIPS — Seat Map & Preferences Service
// GET  /bookings/:id/seat-map                          — схема автобуса туру
// PATCH /bookings/:id/tourist/:tId/preferences (BR-12)  — self-service побажань
//
// ПРИМІТКА: роль 'tourist' навмисно НЕ підключена до PATCH preferences —
// JwtPayload не містить touristId (self-service кабінет туриста був
// реалізований і відкочений — див. git log). Без touristId неможливо
// перевірити власність (IDOR), тому зараз побажання вносить тільки
// manager/ops від імені туриста. Підключити 'tourist' після того як
// з'явиться touristId у токені.
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

    // Місце в автобусі унікальне в межах усього туру, не одного booking —
    // тому збираємо зайняті місця по ВСІХ бронюваннях цього туру.
    const occupied = await prisma.bookingTourist.findMany({
      where: {
        busSeaNumber: { not: null },
        booking: { tourId },
      },
      select: {
        busSeaNumber: true,
        touristId: true,
        tourist: { select: { firstName: true, lastName: true } },
      },
    });

    const occupiedBySeat = new Map(occupied.map((o) => [o.busSeaNumber as number, o]));

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
      where: { touristId, booking: { tourId } },
    });
    if (!bookingTourist) throw Errors.notFound('Учасник туру', touristId);

    if (seatNumber === null) {
      const updated = await prisma.bookingTourist.update({
        where: { id: bookingTourist.id },
        data: { busSeaNumber: null },
      });
      return updated;
    }

    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT bt.id FROM booking_tourists bt
        JOIN bookings b ON b.id = bt.booking_id
        WHERE b.tour_id = ${tourId}::uuid AND bt.bus_seat_number = ${seatNumber}
        FOR UPDATE
      `);

      const conflict = await tx.bookingTourist.findFirst({
        where: {
          busSeaNumber: seatNumber,
          id: { not: bookingTourist.id },
          booking: { tourId },
        },
      });
      if (conflict) {
        throw new AppError('SEAT_TAKEN', `Місце ${seatNumber} вже зайняте`, 409);
      }

      return tx.bookingTourist.update({
        where: { id: bookingTourist.id },
        data: { busSeaNumber: seatNumber },
      });
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

    // Унікальність місця в автобусі в межах туру — SELECT ... FOR UPDATE + перевірка
    if (dto.busSeaNumber !== undefined && dto.busSeaNumber !== null) {
      const seatNumber = dto.busSeaNumber;

      const updated = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`
          SELECT bt.id FROM booking_tourists bt
          JOIN bookings b ON b.id = bt.booking_id
          WHERE b.tour_id = ${booking.tourId}::uuid AND bt.bus_seat_number = ${seatNumber}
          FOR UPDATE
        `);

        const conflict = await tx.bookingTourist.findFirst({
          where: {
            busSeaNumber: seatNumber,
            id: { not: bookingTourist.id },
            booking: { tourId: booking.tourId },
          },
        });
        if (conflict) {
          throw new AppError('SEAT_TAKEN', `Місце ${seatNumber} вже зайняте`, 409);
        }

        return tx.bookingTourist.update({
          where: { id: bookingTourist.id },
          data: {
            busSeaNumber: seatNumber,
            ...(dto.preferredRoomType !== undefined && { preferredRoomType: dto.preferredRoomType }),
            ...(dto.roommatePreference !== undefined && { roommatePreference: dto.roommatePreference }),
          },
        });
      });

      return { applied: true, data: updated };
    }

    const updated = await prisma.bookingTourist.update({
      where: { id: bookingTourist.id },
      data: {
        ...(dto.preferredRoomType !== undefined && { preferredRoomType: dto.preferredRoomType }),
        ...(dto.busSeaNumber === null && { busSeaNumber: null }),
        ...(dto.roommatePreference !== undefined && { roommatePreference: dto.roommatePreference }),
      },
    });

    return { applied: true, data: updated };
  }
}
