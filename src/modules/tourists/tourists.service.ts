// =============================================================================
// EUROTRIPS — Tourists Service
// Мінімальний модуль: пошук + створення. Потрібен для форми бронювання
// (POST /bookings вимагає існуючий contactTouristId).
// =============================================================================

import prisma from '../../shared/database/prisma';
import { Errors } from '../../shared/utils/errors';
import type { TouristListQueryDto, CreateTouristDto } from './tourists.schema';

export class TouristsService {

  // ── LIST / SEARCH ────────────────────────────────────────────────────────
  async list(query: TouristListQueryDto) {
    const { search, page, limit } = query;

    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName:  { contains: search, mode: 'insensitive' as const } },
            { email:     { contains: search, mode: 'insensitive' as const } },
            { phone:     { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.tourist.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.tourist.count({ where }),
    ]);

    return {
      data: items,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ── CREATE ───────────────────────────────────────────────────────────────
  async create(dto: CreateTouristDto) {
    if (dto.email) {
      const existing = await prisma.tourist.findUnique({ where: { email: dto.email } });
      if (existing) throw Errors.conflict('Турист з таким email вже існує');
    }

    return prisma.tourist.create({
      data: {
        firstName:   dto.firstName,
        lastName:    dto.lastName,
        email:       dto.email || undefined,
        phone:       dto.phone,
        nationality: dto.nationality,
      },
    });
  }
}
