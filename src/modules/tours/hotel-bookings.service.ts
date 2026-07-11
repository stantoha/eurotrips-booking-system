// =============================================================================
// EUROTRIPS — Hotel Bookings Service
// OPS-04: додати готель до маршруту; OPS-05: дедлайн опції;
// OPS-06: депозит/фінальна оплата
//
// UI-статус (для HotelStatusBadge — searching/option/confirmed/
// deposit_paid/final_paid) обчислюється з наявних вільно-текстових
// полів confirmationStatus/depositStatus/factAmountEur, бо в схемі
// немає єдиного enum на цей 5-статусний workflow.
// =============================================================================

import prisma from '../../shared/database/prisma';
import { Errors } from '../../shared/utils/errors';
import type { CreateHotelBookingDto, PatchHotelBookingDto, CreateHotelCommunicationDto } from './hotel-bookings.schema';

export type HotelUiStatus = 'searching' | 'option' | 'confirmed' | 'deposit_paid' | 'final_paid';

function computeUiStatus(hb: { confirmationStatus: string | null; depositStatus: string | null; factAmountEur: unknown }): HotelUiStatus {
  if (hb.factAmountEur !== null && hb.factAmountEur !== undefined) return 'final_paid';
  if (hb.depositStatus === 'paid') return 'deposit_paid';
  if (hb.confirmationStatus === 'confirmed') return 'confirmed';
  if (hb.confirmationStatus === 'option') return 'option';
  return 'searching';
}

export class HotelBookingsService {

  async listHotelBookings(tourId: string) {
    const tour = await prisma.tour.findFirst({ where: { id: tourId, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', tourId);

    const items = await prisma.hotelBooking.findMany({
      where: { tourId },
      include: { hotel: { select: { name: true, city: true, country: true } } },
      orderBy: { checkInDate: 'asc' },
    });

    return items.map((hb) => ({ ...hb, uiStatus: computeUiStatus(hb) }));
  }

  // ── OPS-04: додати готель до маршруту ────────────────────────────────────────
  async createHotelBooking(tourId: string, dto: CreateHotelBookingDto, userId: string) {
    const tour = await prisma.tour.findFirst({ where: { id: tourId, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', tourId);

    let hotelId = dto.hotelId;

    // OPS-04 edge case: готелю немає в базі → створити мінімальний запис вручну
    if (!hotelId && dto.hotelName) {
      const hotel = await prisma.hotel.create({
        data: {
          name: dto.hotelName,
          city: dto.hotelCity ?? dto.city,
          country: dto.hotelCountry ?? 'н/д',
        },
      });
      hotelId = hotel.id;
    }

    if (!hotelId) throw Errors.badRequest('Не вдалося визначити готель');

    const hotelBooking = await prisma.hotelBooking.create({
      data: {
        tourId,
        hotelId,
        city: dto.city,
        checkInDate: new Date(dto.checkInDate),
        nightsCount: dto.nightsCount,
        priceTwin: dto.priceTwin, qtyTwin: dto.qtyTwin,
        priceDbl: dto.priceDbl, qtyDbl: dto.qtyDbl,
        priceTrpl: dto.priceTrpl, qtyTrpl: dto.qtyTrpl,
        priceSngl: dto.priceSngl, qtySngl: dto.qtySngl,
        budgetPerNight: dto.budgetPerNight,
        optionDeadline: dto.optionDeadline ? new Date(dto.optionDeadline) : undefined,
        confirmationStatus: 'searching',
        status: 'active',
      },
      include: { hotel: { select: { name: true, city: true, country: true } } },
    });

    await this.audit(userId, 'CREATE', hotelBooking.id, null, dto);

    return { ...hotelBooking, uiStatus: computeUiStatus(hotelBooking) };
  }

  // ── OPS-05/OPS-06: оновити дедлайн, статус, депозит/фінал ────────────────────
  async patchHotelBooking(tourId: string, hotelBookingId: string, dto: PatchHotelBookingDto, userId: string) {
    const existing = await prisma.hotelBooking.findFirst({ where: { id: hotelBookingId, tourId } });
    if (!existing) throw Errors.notFound('Готельне бронювання', hotelBookingId);

    // OPS-06 edge case: сума депозиту не може перевищувати загальну вартість
    if (dto.depositAmount !== undefined && existing.totalCost != null && dto.depositAmount > Number(existing.totalCost)) {
      throw Errors.badRequest('Сума депозиту перевищує загальну вартість готелю');
    }

    const updated = await prisma.hotelBooking.update({
      where: { id: hotelBookingId },
      data: {
        ...(dto.optionDeadline !== undefined && { optionDeadline: new Date(dto.optionDeadline) }),
        ...(dto.confirmationStatus !== undefined && { confirmationStatus: dto.confirmationStatus }),
        ...(dto.depositAmount !== undefined && { depositAmount: dto.depositAmount }),
        ...(dto.depositStatus !== undefined && { depositStatus: dto.depositStatus }),
        ...(dto.balanceAmount !== undefined && { balanceAmount: dto.balanceAmount }),
        ...(dto.factAmountEur !== undefined && { factAmountEur: dto.factAmountEur }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: { hotel: { select: { name: true, city: true, country: true } } },
    });

    await this.audit(userId, 'UPDATE', hotelBookingId, existing, dto);

    return { ...updated, uiStatus: computeUiStatus(updated) };
  }

  // ── Листування логіста з готелем (ручний лог) ────────────────────────────────
  async listCommunications(tourId: string, hotelBookingId: string) {
    const hb = await prisma.hotelBooking.findFirst({ where: { id: hotelBookingId, tourId } });
    if (!hb) throw Errors.notFound('Готельне бронювання', hotelBookingId);

    return prisma.communication.findMany({
      where: { hotelBookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCommunication(tourId: string, hotelBookingId: string, dto: CreateHotelCommunicationDto) {
    const hb = await prisma.hotelBooking.findFirst({ where: { id: hotelBookingId, tourId } });
    if (!hb) throw Errors.notFound('Готельне бронювання', hotelBookingId);

    return prisma.communication.create({
      data: {
        hotelBookingId,
        channel: 'email',
        direction: dto.direction,
        subject: dto.subject,
        body: dto.body,
        status: 'sent',
        sentAt: new Date(),
      },
    });
  }

  private async audit(userId: string, action: string, recordId: string, oldData: unknown, newData: unknown) {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        tableName: 'hotel_bookings',
        recordId,
        oldData: oldData as any,
        newData: newData as any,
      },
    }).catch(() => {});
  }
}
