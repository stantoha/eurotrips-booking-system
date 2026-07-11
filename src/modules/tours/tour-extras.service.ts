// =============================================================================
// EUROTRIPS — Tour Extras Service
// ДОПи туру. totalCost — сума всіх cost-полів, рахується автоматично.
// Soft delete: status='відмінено' (CLAUDE.md §10 — без фізичного видалення).
// =============================================================================

import prisma from '../../shared/database/prisma';
import { Errors } from '../../shared/utils/errors';
import type { CreateTourExtraDto, PatchTourExtraDto } from './tour-extras.schema';

const COST_FIELDS = [
  'guideCost', 'parkingCost', 'cityEntriesCost', 'giftsCost', 'insuranceCost', 'otherCost',
] as const;

function sumCosts(fields: Partial<Record<(typeof COST_FIELDS)[number], number | null | undefined>>): number {
  return COST_FIELDS.reduce((sum, key) => sum + Number(fields[key] ?? 0), 0);
}

export class TourExtrasService {

  async listExtras(tourId: string) {
    const tour = await prisma.tour.findFirst({ where: { id: tourId, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', tourId);

    return prisma.tourExtra.findMany({ where: { tourId }, orderBy: { id: 'asc' } });
  }

  async createExtra(tourId: string, dto: CreateTourExtraDto) {
    const tour = await prisma.tour.findFirst({ where: { id: tourId, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', tourId);

    return prisma.tourExtra.create({
      data: {
        tourId,
        connectionType: dto.connectionType,
        guideCost: dto.guideCost,
        parkingCost: dto.parkingCost,
        cityEntriesCost: dto.cityEntriesCost,
        giftsCost: dto.giftsCost,
        insuranceCost: dto.insuranceCost,
        otherCost: dto.otherCost,
        totalCost: sumCosts(dto),
        personsCount: dto.personsCount,
        status: dto.status ?? 'planned',
        notes: dto.notes,
      },
    });
  }

  async patchExtra(tourId: string, extraId: string, dto: PatchTourExtraDto) {
    const existing = await prisma.tourExtra.findFirst({ where: { id: extraId, tourId } });
    if (!existing) throw Errors.notFound('ДОП', extraId);

    const merged = {
      guideCost: dto.guideCost !== undefined ? dto.guideCost : Number(existing.guideCost ?? 0),
      parkingCost: dto.parkingCost !== undefined ? dto.parkingCost : Number(existing.parkingCost ?? 0),
      cityEntriesCost: dto.cityEntriesCost !== undefined ? dto.cityEntriesCost : Number(existing.cityEntriesCost ?? 0),
      giftsCost: dto.giftsCost !== undefined ? dto.giftsCost : Number(existing.giftsCost ?? 0),
      insuranceCost: dto.insuranceCost !== undefined ? dto.insuranceCost : Number(existing.insuranceCost ?? 0),
      otherCost: dto.otherCost !== undefined ? dto.otherCost : Number(existing.otherCost ?? 0),
    };

    return prisma.tourExtra.update({
      where: { id: extraId },
      data: {
        ...(dto.connectionType !== undefined && { connectionType: dto.connectionType }),
        ...merged,
        totalCost: sumCosts(merged),
        ...(dto.personsCount !== undefined && { personsCount: dto.personsCount }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async cancelExtra(tourId: string, extraId: string) {
    const existing = await prisma.tourExtra.findFirst({ where: { id: extraId, tourId } });
    if (!existing) throw Errors.notFound('ДОП', extraId);

    await prisma.tourExtra.update({ where: { id: extraId }, data: { status: 'відмінено' } });
  }
}
