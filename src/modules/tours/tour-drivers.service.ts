// =============================================================================
// EUROTRIPS — Tour Driver Assignments Service
// Призначення водіїв (від перевізника) на тур. Ліміт 2 водії на тур.
// =============================================================================

import prisma from '../../shared/database/prisma';
import { Errors } from '../../shared/utils/errors';

const MAX_DRIVERS_PER_TOUR = 2;

export class TourDriversService {

  async listDrivers(tourId: string) {
    const tour = await prisma.tour.findFirst({ where: { id: tourId, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', tourId);

    return prisma.tourDriverAssignment.findMany({
      where: { tourId },
      include: { staff: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async assignDriver(tourId: string, staffId: string) {
    const tour = await prisma.tour.findFirst({ where: { id: tourId, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', tourId);

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw Errors.notFound('Персонал', staffId);
    if (staff.role !== 'driver') {
      throw Errors.badRequest('Призначити водієм можна тільки співробітника з роллю driver');
    }

    const existingCount = await prisma.tourDriverAssignment.count({ where: { tourId } });
    if (existingCount >= MAX_DRIVERS_PER_TOUR) {
      throw Errors.conflict(`На тур вже призначено максимум ${MAX_DRIVERS_PER_TOUR} водіїв`);
    }

    const alreadyAssigned = await prisma.tourDriverAssignment.findUnique({
      where: { tourId_staffId: { tourId, staffId } },
    });
    if (alreadyAssigned) throw Errors.conflict('Цей водій вже призначений на тур');

    return prisma.tourDriverAssignment.create({
      data: { tourId, staffId },
      include: { staff: true },
    });
  }

  async unassignDriver(tourId: string, staffId: string) {
    const assignment = await prisma.tourDriverAssignment.findUnique({
      where: { tourId_staffId: { tourId, staffId } },
    });
    if (!assignment) throw Errors.notFound('Призначення водія', staffId);

    await prisma.tourDriverAssignment.delete({ where: { id: assignment.id } });
  }
}
