// =============================================================================
// EUROTRIPS — Rooming Service (факт-розселення)
// OPS-14: попередній румінг (призначення кімнати кожному туристу)
// OPS-15: тип кімнати + харчування
// OPS-16: фіналізація румінгу (блокує подальші self-service зміни, BR-12)
// =============================================================================

import { BookingStatus } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { Errors } from '../../shared/utils/errors';
import type { AssignRoomDto } from './rooming.schema';

const CONFIRMED_AND_BEYOND: BookingStatus[] = [
  BookingStatus.confirmed,
  BookingStatus.docs_collected,
  BookingStatus.ready_to_depart,
  BookingStatus.on_trip,
  BookingStatus.completed,
];

export class RoomingService {

  // ── OPS-14/15: призначити кімнату + харчування туристу ───────────────────────
  async assignRoom(tourId: string, touristId: string, dto: AssignRoomDto, userId: string) {
    const bookingTourist = await prisma.bookingTourist.findFirst({
      where: { touristId, booking: { tourId } },
    });
    if (!bookingTourist) throw Errors.notFound('Учасник туру', touristId);

    // OPS-16: після фіналізації змінювати розселення можна тільки продакту/адміну через окремий процес
    const hotelBookings = await prisma.hotelBooking.findMany({ where: { tourId } });
    if (hotelBookings.some((hb) => hb.finalRoomingDone)) {
      throw Errors.forbidden('Румінг вже фіналізовано — зміна розселення заблокована');
    }

    const updated = await prisma.bookingTourist.update({
      where: { id: bookingTourist.id },
      data: {
        actualRoomNumber: dto.actualRoomNumber,
        ...(dto.actualRoomType !== undefined && { actualRoomType: dto.actualRoomType }),
        ...(dto.mealType !== undefined && { mealType: dto.mealType }),
        ...(dto.roommatePreference !== undefined && { roommatePreference: dto.roommatePreference }),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId, action: 'ROOMING_ASSIGN', tableName: 'booking_tourists', recordId: bookingTourist.id,
        oldData: { actualRoomNumber: bookingTourist.actualRoomNumber } as any,
        newData: dto as any,
      },
    }).catch(() => {});

    return updated;
  }

  // ── OPS-16: фіналізувати румінг для готелю ───────────────────────────────────
  async finalizeRooming(tourId: string, hotelBookingId: string, userId: string) {
    const hotelBooking = await prisma.hotelBooking.findFirst({ where: { id: hotelBookingId, tourId } });
    if (!hotelBooking) throw Errors.notFound('Готельне бронювання', hotelBookingId);

    if (hotelBooking.finalRoomingDone) {
      throw Errors.conflict('Румінг для цього готелю вже фіналізовано');
    }

    // OPS-16 edge case: є туристи без кімнати → фіналізація заблокована
    const withoutRoom = await prisma.bookingTourist.count({
      where: {
        booking: { tourId, status: { in: CONFIRMED_AND_BEYOND } },
        actualRoomNumber: null,
      },
    });

    if (withoutRoom > 0) {
      throw Errors.badRequest(`Неможливо фіналізувати: ${withoutRoom} турист(ів) без призначеної кімнати`);
    }

    const updated = await prisma.hotelBooking.update({
      where: { id: hotelBookingId },
      data: { finalRoomingDone: true, finalRoomingAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId, action: 'ROOMING_FINALIZE', tableName: 'hotel_bookings', recordId: hotelBookingId,
        oldData: { finalRoomingDone: false } as any,
        newData: { finalRoomingDone: true } as any,
      },
    }).catch(() => {});

    return updated;
  }
}
