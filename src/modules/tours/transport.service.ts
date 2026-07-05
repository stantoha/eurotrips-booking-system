// =============================================================================
// EUROTRIPS — Transport Booking Service
// OPS-08: реєстрація перевізника; OPS-09: авторозрахунок км×тариф+пальне;
// OPS-10: підтвердження + аванс перевізнику
// =============================================================================

import { BookingStatus, TransportBooking } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { Errors } from '../../shared/utils/errors';
import type { CreateTransportDto, PatchTransportDto } from './transport.schema';

const CONFIRMED_AND_BEYOND: BookingStatus[] = [
  BookingStatus.confirmed,
  BookingStatus.docs_collected,
  BookingStatus.ready_to_depart,
  BookingStatus.on_trip,
  BookingStatus.completed,
];

/** OPS-09: авторозрахунок вартості перевезення */
function withComputedCost(tb: TransportBooking, bookedTourists: number) {
  const kmTotal = tb.kmTotalPlan
    ? Number(tb.kmTotalPlan)
    : Number(tb.kmGoogle ?? 0) + Number(tb.kmExtras ?? 0);
  const baseCost = kmTotal * Number(tb.ratePerKm ?? 0);
  const totalCost = baseCost + Number(tb.fuelSurcharge ?? 0) + Number(tb.wifiOrDeliveryFee ?? 0);
  const paid = Number(tb.paidAdvanceEur ?? 0) + Number(tb.paidCashEur ?? 0);

  return {
    ...tb,
    kmTotalComputed: kmTotal,
    baseTransportCost: Math.round(baseCost * 100) / 100,
    totalTransportCost: Math.round(totalCost * 100) / 100,
    // OPS-09 edge case: bookedTourists = 0 → costPerPerson = null (не ділити на 0)
    costPerPerson: bookedTourists > 0 ? Math.round((totalCost / bookedTourists) * 100) / 100 : null,
    remainingAmount: Math.round((totalCost - paid) * 100) / 100,
  };
}

export class TransportService {

  async listTransport(tourId: string) {
    const tour = await prisma.tour.findFirst({ where: { id: tourId, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', tourId);

    const bookedTourists = await prisma.bookingTourist.count({
      where: { booking: { tourId, status: { in: CONFIRMED_AND_BEYOND } } },
    });

    const items = await prisma.transportBooking.findMany({
      where: { tourId },
      orderBy: { createdAt: 'asc' },
    });

    return items.map((tb) => withComputedCost(tb, bookedTourists));
  }

  // ── OPS-08: реєстрація перевізника ───────────────────────────────────────────
  async createTransport(tourId: string, dto: CreateTransportDto, userId: string) {
    const tour = await prisma.tour.findFirst({ where: { id: tourId, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', tourId);

    const transport = await prisma.transportBooking.create({
      data: {
        tourId,
        transportType: dto.transportType,
        connectionType: dto.connectionType,
        carrierName: dto.carrierName,
        busBrand: dto.busBrand,
        departureDate: dto.departureDate ? new Date(dto.departureDate) : undefined,
        returnDate: dto.returnDate ? new Date(dto.returnDate) : undefined,
        kmGoogle: dto.kmGoogle,
        kmExtras: dto.kmExtras,
        kmTotalPlan: dto.kmGoogle !== undefined || dto.kmExtras !== undefined
          ? (dto.kmGoogle ?? 0) + (dto.kmExtras ?? 0)
          : undefined,
        ratePerKm: dto.ratePerKm,
        fuelSurcharge: dto.fuelSurcharge,
        wifiOrDeliveryFee: dto.wifiOrDeliveryFee,
        notes: dto.notes,
        status: 'planned',
      },
    });

    await this.audit(userId, 'CREATE', transport.id, null, dto);

    const bookedTourists = await prisma.bookingTourist.count({
      where: { booking: { tourId, status: { in: CONFIRMED_AND_BEYOND } } },
    });

    return withComputedCost(transport, bookedTourists);
  }

  // ── OPS-09/OPS-10: оновити / підтвердити / зафіксувати аванс ────────────────
  async patchTransport(tourId: string, transportId: string, dto: PatchTransportDto, userId: string) {
    const existing = await prisma.transportBooking.findFirst({ where: { id: transportId, tourId } });
    if (!existing) throw Errors.notFound('Транспортне бронювання', transportId);

    const kmChanged = dto.kmGoogle !== undefined || dto.kmExtras !== undefined;
    const nextKmGoogle = dto.kmGoogle ?? Number(existing.kmGoogle ?? 0);
    const nextKmExtras = dto.kmExtras ?? Number(existing.kmExtras ?? 0);

    const updated = await prisma.transportBooking.update({
      where: { id: transportId },
      data: {
        ...(dto.transportType !== undefined && { transportType: dto.transportType }),
        ...(dto.connectionType !== undefined && { connectionType: dto.connectionType }),
        ...(dto.carrierName !== undefined && { carrierName: dto.carrierName }),
        ...(dto.busBrand !== undefined && { busBrand: dto.busBrand }),
        ...(dto.departureDate !== undefined && { departureDate: new Date(dto.departureDate) }),
        ...(dto.returnDate !== undefined && { returnDate: new Date(dto.returnDate) }),
        ...(dto.kmGoogle !== undefined && { kmGoogle: dto.kmGoogle }),
        ...(dto.kmExtras !== undefined && { kmExtras: dto.kmExtras }),
        ...(kmChanged && { kmTotalPlan: nextKmGoogle + nextKmExtras }),
        ...(dto.ratePerKm !== undefined && { ratePerKm: dto.ratePerKm }),
        ...(dto.fuelSurcharge !== undefined && { fuelSurcharge: dto.fuelSurcharge }),
        ...(dto.wifiOrDeliveryFee !== undefined && { wifiOrDeliveryFee: dto.wifiOrDeliveryFee }),
        ...(dto.paidAdvanceEur !== undefined && { paidAdvanceEur: dto.paidAdvanceEur }),
        ...(dto.paidCashEur !== undefined && { paidCashEur: dto.paidCashEur }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    await this.audit(userId, 'UPDATE', transportId, existing, dto);

    const bookedTourists = await prisma.bookingTourist.count({
      where: { booking: { tourId, status: { in: CONFIRMED_AND_BEYOND } } },
    });

    return withComputedCost(updated, bookedTourists);
  }

  private async audit(userId: string, action: string, recordId: string, oldData: unknown, newData: unknown) {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        tableName: 'transport_bookings',
        recordId,
        oldData: oldData as any,
        newData: newData as any,
      },
    }).catch(() => {});
  }
}
