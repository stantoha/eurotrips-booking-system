// =============================================================================
// EUROTRIPS — OPS Dashboard Service
// Головний екран операційного менеджера (/ops, UX Wireframe C-1 "sp-root").
// 4 блоки: дедлайни готелів · виїзди наступних 7 днів · прогрес чеклістів ·
// нові підтверджені туристи сьогодні.
// =============================================================================

import { BookingStatus, TourStatus } from '@prisma/client';
import prisma from '../../shared/database/prisma';

const IN_PREPARATION_STATUSES: TourStatus[] = [
  TourStatus.open, TourStatus.active, TourStatus.almost_full, TourStatus.closed,
];

const CONFIRMED_AND_BEYOND: BookingStatus[] = [
  BookingStatus.confirmed,
  BookingStatus.docs_collected,
  BookingStatus.ready_to_depart,
  BookingStatus.on_trip,
  BookingStatus.completed,
];

export class OpsDashboardService {

  // ── 🚨 Дедлайни готелів (<3 дні), ще не підтверджені ─────────────────────────
  private async getHotelDeadlines() {
    const in3Days = new Date();
    in3Days.setDate(in3Days.getDate() + 3);

    const hotelBookings = await prisma.hotelBooking.findMany({
      where: {
        optionDeadline: { lte: in3Days },
        confirmationStatus: { in: ['searching', 'option'] },
        tour: { isArchived: false },
      },
      include: {
        hotel: { select: { name: true } },
        tour: { select: { id: true, code: true, name: true } },
      },
      orderBy: { optionDeadline: 'asc' },
      take: 20,
    });

    return hotelBookings.map((hb) => ({
      hotelBookingId: hb.id,
      tourId: hb.tour.id,
      tourCode: hb.tour.code,
      tourName: hb.tour.name,
      hotelName: hb.hotel.name,
      city: hb.city,
      optionDeadline: hb.optionDeadline,
    }));
  }

  // ── 📅 Виїзди наступних 7 днів + 📊 прогрес чеклістів ────────────────────────
  private async getUpcomingTours() {
    const now = new Date();
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);

    const tours = await prisma.tour.findMany({
      where: {
        isArchived: false,
        departureDate: { gte: now, lte: in7Days },
        status: { notIn: [TourStatus.cancelled, TourStatus.completed] },
      },
      include: { checklist: true },
      orderBy: { departureDate: 'asc' },
    });

    return tours.map((t) => ({
      tourId: t.id,
      code: t.code,
      name: t.name,
      departureDate: t.departureDate,
      totalSeats: t.totalSeats,
      availableSeats: t.availableSeats,
      status: t.status,
      readinessPercent: t.checklist?.readinessPercent ?? 0,
    }));
  }

  // ── 📊 Прогрес чеклістів по всіх турах у підготовці (ширший набір) ──────────
  private async getChecklistProgress() {
    const tours = await prisma.tour.findMany({
      where: { isArchived: false, status: { in: IN_PREPARATION_STATUSES } },
      include: { checklist: true },
      orderBy: { departureDate: 'asc' },
      take: 15,
    });

    return tours
      .map((t) => ({
        tourId: t.id,
        code: t.code,
        name: t.name,
        departureDate: t.departureDate,
        readinessPercent: t.checklist?.readinessPercent ?? 0,
      }))
      .sort((a, b) => a.readinessPercent - b.readinessPercent);
  }

  // ── 👥 Нові підтверджені туристи сьогодні ────────────────────────────────────
  private async getNewTouristsToday() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: CONFIRMED_AND_BEYOND },
        updatedAt: { gte: todayStart },
      },
      include: {
        tour: { select: { id: true, code: true, name: true } },
        contactTourist: { select: { firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    return bookings.map((b) => ({
      bookingId: b.id,
      bookingNumber: b.bookingNumber,
      tourId: b.tour.id,
      tourCode: b.tour.code,
      tourName: b.tour.name,
      contactName: `${b.contactTourist.lastName} ${b.contactTourist.firstName}`,
      personsCount: b.personsCount,
      updatedAt: b.updatedAt,
    }));
  }

  async getDashboard() {
    const [hotelDeadlines, upcomingTours, checklistProgress, newTourists] = await Promise.all([
      this.getHotelDeadlines(),
      this.getUpcomingTours(),
      this.getChecklistProgress(),
      this.getNewTouristsToday(),
    ]);

    return { hotelDeadlines, upcomingTours, checklistProgress, newTourists };
  }
}
