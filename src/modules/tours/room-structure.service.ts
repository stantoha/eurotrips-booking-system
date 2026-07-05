// =============================================================================
// EUROTRIPS — Room Structure Service
// OPS-01: структура номерів по готелю (planned twin/double/triple/single)
// OPS-09/OPS-10: статусна машина draft → approved → final + валідація місткості
// BR-09: тур не може відкритись (draft→open) без approved-структури (tours.service.ts)
// BR-10: sum(twin×2 + double×2 + triple×3 + single×1) ≤ tour.totalSeats
// =============================================================================

import { RoomingStatus, UserRole } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { Errors, AppError } from '../../shared/utils/errors';
import type {
  SetRoomStructureDto,
  ApproveRoomStructureDto,
  FinalizeRoomStructureDto,
} from './room-structure.schema';
import type { JwtPayload } from '../auth/auth.types';

export class RoomStructureService {

  // ── GET структура по всіх готелях туру ──────────────────────────────────────
  async getStructure(tourId: string) {
    const tour = await prisma.tour.findFirst({ where: { id: tourId, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', tourId);

    const hotelBookings = await prisma.hotelBooking.findMany({
      where: { tourId },
      include: { hotel: { select: { name: true, city: true } } },
      orderBy: { checkInDate: 'asc' },
    });

    return {
      tourId: tour.id,
      tourCode: tour.code,
      totalSeats: tour.totalSeats,
      hotelBookings: hotelBookings.map((hb) => ({
        id: hb.id,
        hotelName: hb.hotel.name,
        city: hb.city,
        checkInDate: hb.checkInDate,
        plannedTwin: hb.plannedTwin,
        plannedDouble: hb.plannedDouble,
        plannedTriple: hb.plannedTriple,
        plannedSingle: hb.plannedSingle,
        capacity: this.calcCapacity(hb),
        structureStatus: hb.structureStatus,
        structureApprovedBy: hb.structureApprovedBy,
        structureApprovedAt: hb.structureApprovedAt,
        isFastLaunch: hb.isFastLaunch,
      })),
    };
  }

  // ── PUT — записати/оновити структуру ────────────────────────────────────────
  async setStructure(tourId: string, dto: SetRoomStructureDto, user: JwtPayload) {
    const tour = await prisma.tour.findFirst({ where: { id: tourId, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', tourId);

    const hotelBooking = await prisma.hotelBooking.findFirst({
      where: { id: dto.hotelBookingId, tourId },
    });
    if (!hotelBooking) throw Errors.notFound('Готельне бронювання', dto.hotelBookingId);

    // Після APPROVED — тільки admin може змінювати (OPS-10)
    if (hotelBooking.structureStatus !== RoomingStatus.draft && user.role !== UserRole.admin) {
      throw Errors.forbidden(
        'Структуру затверджено — редагування дозволено тільки адміністратору'
      );
    }

    const capacity =
      dto.plannedTwin * 2 + dto.plannedDouble * 2 + dto.plannedTriple * 3 + dto.plannedSingle * 1;

    if (capacity > tour.totalSeats) {
      throw new AppError(
        'ROOM_CAPACITY_EXCEEDED',
        `Місткість структури (${capacity}) перевищує кількість місць туру (${tour.totalSeats})`,
        422
      );
    }

    const updated = await prisma.hotelBooking.update({
      where: { id: dto.hotelBookingId },
      data: {
        plannedTwin: dto.plannedTwin,
        plannedDouble: dto.plannedDouble,
        plannedTriple: dto.plannedTriple,
        plannedSingle: dto.plannedSingle,
      },
    });

    await this.audit(user.sub, 'ROOM_STRUCTURE_SET', dto.hotelBookingId, {
      plannedTwin: hotelBooking.plannedTwin,
      plannedDouble: hotelBooking.plannedDouble,
      plannedTriple: hotelBooking.plannedTriple,
      plannedSingle: hotelBooking.plannedSingle,
    }, dto);

    return updated;
  }

  // ── APPROVE — draft → approved (admin/director) ─────────────────────────────
  async approveStructure(tourId: string, dto: ApproveRoomStructureDto, user: JwtPayload) {
    const hotelBooking = await prisma.hotelBooking.findFirst({
      where: { id: dto.hotelBookingId, tourId },
    });
    if (!hotelBooking) throw Errors.notFound('Готельне бронювання', dto.hotelBookingId);

    if (hotelBooking.structureStatus !== RoomingStatus.draft) {
      throw Errors.conflict(
        `Структуру не можна затвердити зі статусу "${hotelBooking.structureStatus}" (очікувався draft)`
      );
    }

    const updated = await prisma.hotelBooking.update({
      where: { id: dto.hotelBookingId },
      data: {
        structureStatus: RoomingStatus.approved,
        structureApprovedBy: user.sub,
        structureApprovedAt: new Date(),
      },
    });

    await this.audit(user.sub, 'ROOM_STRUCTURE_APPROVE', dto.hotelBookingId,
      { structureStatus: RoomingStatus.draft },
      { structureStatus: RoomingStatus.approved }
    );

    return updated;
  }

  // ── FINALIZE — approved → final (ops/admin) ─────────────────────────────────
  async finalizeStructure(tourId: string, dto: FinalizeRoomStructureDto, user: JwtPayload) {
    const hotelBooking = await prisma.hotelBooking.findFirst({
      where: { id: dto.hotelBookingId, tourId },
    });
    if (!hotelBooking) throw Errors.notFound('Готельне бронювання', dto.hotelBookingId);

    if (hotelBooking.structureStatus !== RoomingStatus.approved) {
      throw Errors.conflict(
        `Структуру не можна фіналізувати зі статусу "${hotelBooking.structureStatus}" (очікувався approved)`
      );
    }

    const updated = await prisma.hotelBooking.update({
      where: { id: dto.hotelBookingId },
      data: { structureStatus: RoomingStatus.final },
    });

    await this.audit(user.sub, 'ROOM_STRUCTURE_FINALIZE', dto.hotelBookingId,
      { structureStatus: RoomingStatus.approved },
      { structureStatus: RoomingStatus.final }
    );

    return updated;
  }

  // ── PRIVATE ──────────────────────────────────────────────────────────────────
  private calcCapacity(hb: { plannedTwin: number; plannedDouble: number; plannedTriple: number; plannedSingle: number }) {
    return hb.plannedTwin * 2 + hb.plannedDouble * 2 + hb.plannedTriple * 3 + hb.plannedSingle * 1;
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
