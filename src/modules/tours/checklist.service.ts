// =============================================================================
// EUROTRIPS — Tour Checklist Service
// OPS-18: 9-пунктний чекліст готовності виїзду. readinessPercent — auto-calc.
// Гейт: Tour.status closed → on_tour дозволено тільки при readinessPercent = 100
// (перевірка в tours.service.ts::changeTourStatus).
// =============================================================================

import prisma from '../../shared/database/prisma';
import { Errors } from '../../shared/utils/errors';
import { CHECKLIST_ITEMS, type PatchChecklistItemDto } from './checklist.schema';
import type { JwtPayload } from '../auth/auth.types';

export class ChecklistService {

  // ── GET — повертає чекліст, створює порожній при першому зверненні ─────────
  async getChecklist(tourId: string) {
    const tour = await prisma.tour.findFirst({ where: { id: tourId, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', tourId);

    return prisma.tourChecklist.upsert({
      where: { tourId },
      create: { tourId },
      update: {},
    });
  }

  // ── PATCH — оновити один пункт + перерахувати readinessPercent ─────────────
  async patchItem(tourId: string, dto: PatchChecklistItemDto, user: JwtPayload) {
    const tour = await prisma.tour.findFirst({ where: { id: tourId, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', tourId);

    const existing = await prisma.tourChecklist.upsert({
      where: { tourId },
      create: { tourId },
      update: {},
    });

    const timestampField = `${dto.item}At` as const;

    const updated = await prisma.tourChecklist.update({
      where: { tourId },
      data: {
        [dto.item]: dto.value,
        [timestampField]: dto.value ? new Date() : null,
      },
    });

    const readinessPercent = this.calcReadiness(updated);

    const final = await prisma.tourChecklist.update({
      where: { tourId },
      data: { readinessPercent },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.sub,
        action: 'CHECKLIST_ITEM_UPDATE',
        tableName: 'tour_checklists',
        recordId: existing.id,
        oldData: { [dto.item]: existing[dto.item] } as any,
        newData: { [dto.item]: dto.value } as any,
      },
    }).catch(() => {});

    return final;
  }

  /** Використовується tours.service.ts для гейту closed → on_tour */
  async isFullyReady(tourId: string): Promise<boolean> {
    const checklist = await prisma.tourChecklist.findUnique({ where: { tourId } });
    return checklist?.readinessPercent === 100;
  }

  private calcReadiness(checklist: Record<string, unknown>): number {
    const doneCount = CHECKLIST_ITEMS.filter((item) => checklist[item] === true).length;
    return Math.round((doneCount / CHECKLIST_ITEMS.length) * 100);
  }
}
