// =============================================================================
// EUROTRIPS — Tour Tourists Service
// Зведений список туристів виїзду з підтверджених бронювань.
// Основа для румінгу та розсадки (BA: "Список туристів виїзду").
// =============================================================================

import { BookingStatus } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { Errors } from '../../shared/utils/errors';
import type { TourTouristsQueryDto } from './tourists.schema';

const CONFIRMED_AND_BEYOND: BookingStatus[] = [
  BookingStatus.confirmed,
  BookingStatus.docs_collected,
  BookingStatus.ready_to_depart,
  BookingStatus.on_trip,
  BookingStatus.completed,
];

export class TouristsService {

  async listTourTourists(tourId: string, query: TourTouristsQueryDto) {
    const tour = await prisma.tour.findFirst({ where: { id: tourId, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', tourId);

    const bookingTourists = await prisma.bookingTourist.findMany({
      where: { booking: { tourId, status: { in: CONFIRMED_AND_BEYOND } } },
      include: {
        tourist: true,
        booking: {
          select: {
            id: true, bookingNumber: true, status: true, paymentStatus: true,
            totalAmount: true, depositPaid: true, balancePaid: true, balanceAmount: true,
          },
        },
      },
      orderBy: [{ tourist: { lastName: 'asc' } }, { tourist: { firstName: 'asc' } }],
    });

    let rows = bookingTourists.map((bt) => {
      const balanceDue = Number(bt.booking.balanceAmount) - Number(bt.booking.balancePaid);
      return {
        touristId: bt.touristId,
        bookingTouristId: bt.id,
        firstName: bt.tourist.firstName,
        lastName: bt.tourist.lastName,
        dateOfBirth: bt.tourist.dateOfBirth,
        passportNumber: bt.tourist.passportNumber,
        phone: bt.tourist.phone,
        email: bt.tourist.email,
        allergies: bt.tourist.allergies,
        dietaryRestrictions: bt.tourist.dietaryRestrictions,
        bookingId: bt.booking.id,
        bookingNumber: bt.booking.bookingNumber,
        bookingStatus: bt.booking.status,
        paymentStatus: bt.booking.paymentStatus,
        balanceDue: balanceDue > 0 ? balanceDue : 0,
        seatNumber: bt.seatNumber,
        busSeaNumber: bt.busSeaNumber,
        roomType: bt.roomType,
        preferredRoomType: bt.preferredRoomType,
        actualRoomNumber: bt.actualRoomNumber,
        actualRoomType: bt.actualRoomType,
        mealType: bt.mealType,
        specialRequirements: bt.specialRequirements,
        specialNotes: bt.specialNotes,
      };
    });

    if (query.missingPassport) rows = rows.filter((r) => !r.passportNumber);
    if (query.hasDebt) rows = rows.filter((r) => r.balanceDue > 0);
    if (query.noRoom) rows = rows.filter((r) => !r.actualRoomNumber);

    return {
      tourId,
      totalConfirmed: bookingTourists.length,
      tourists: rows,
    };
  }
}
