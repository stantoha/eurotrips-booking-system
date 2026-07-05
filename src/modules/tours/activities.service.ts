// =============================================================================
// EUROTRIPS — Tour Activities Service
// OPS-11: створення активності; OPS-12: прив'язка гіда; OPS-13: підтвердження
// =============================================================================

import prisma from '../../shared/database/prisma';
import { Errors } from '../../shared/utils/errors';
import type { CreateActivityDto, PatchActivityDto } from './activities.schema';

/** HH:MM → Date з фіксованою датою-заглушкою (Prisma @db.Time зберігає лише час) */
function timeStringToDate(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

export class ActivitiesService {

  async listActivities(tourId: string) {
    const tour = await prisma.tour.findFirst({ where: { id: tourId, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', tourId);

    return prisma.tourActivity.findMany({
      where: { tourId },
      orderBy: [{ activityDate: 'asc' }, { startTime: 'asc' }],
    });
  }

  // ── OPS-11: створити активність ─────────────────────────────────────────────
  async createActivity(tourId: string, dto: CreateActivityDto, userId: string) {
    const tour = await prisma.tour.findFirst({ where: { id: tourId, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', tourId);

    const activityDate = new Date(dto.activityDate);

    // OPS-11 edge case: дата поза діапазоном туру → попередження, збереження дозволено
    const outOfRange = activityDate < tour.departureDate || activityDate > tour.returnDate;

    const activity = await prisma.tourActivity.create({
      data: {
        tourId,
        city: dto.city,
        programType: dto.programType,
        activityDate,
        activityName: dto.activityName,
        startTime: dto.startTime ? timeStringToDate(dto.startTime) : undefined,
        guideName: dto.guideName,
        guidePhone: dto.guidePhone,
        costEur: dto.costEur,
        notes: dto.notes,
        status: 'очікує',
      },
    });

    await this.audit(userId, 'CREATE', activity.id, null, dto);

    return {
      activity,
      warning: outOfRange
        ? 'Дата активності виходить за межі дат туру (departureDate..returnDate)'
        : null,
    };
  }

  // ── OPS-12/OPS-13: оновити активність (гід, статус, тощо) ───────────────────
  async patchActivity(tourId: string, activityId: string, dto: PatchActivityDto, userId: string) {
    const activity = await prisma.tourActivity.findFirst({ where: { id: activityId, tourId } });
    if (!activity) throw Errors.notFound('Активність', activityId);

    const updated = await prisma.tourActivity.update({
      where: { id: activityId },
      data: {
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.programType !== undefined && { programType: dto.programType }),
        ...(dto.activityDate !== undefined && { activityDate: new Date(dto.activityDate) }),
        ...(dto.activityName !== undefined && { activityName: dto.activityName }),
        ...(dto.startTime !== undefined && { startTime: timeStringToDate(dto.startTime) }),
        ...(dto.guideName !== undefined && { guideName: dto.guideName }),
        ...(dto.guidePhone !== undefined && { guidePhone: dto.guidePhone }),
        ...(dto.costEur !== undefined && { costEur: dto.costEur }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    await this.audit(userId, 'UPDATE', activityId, activity, dto);

    return updated;
  }

  private async audit(userId: string, action: string, recordId: string, oldData: unknown, newData: unknown) {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        tableName: 'tour_activities',
        recordId,
        oldData: oldData as any,
        newData: newData as any,
      },
    }).catch(() => {});
  }
}
