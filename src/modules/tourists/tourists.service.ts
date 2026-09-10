// =============================================================================
// EUROTRIPS — Tourists Service
// Мінімальний модуль: пошук + створення. Потрібен для форми бронювання
// (POST /bookings вимагає існуючий contactTouristId).
// =============================================================================

import prisma from '../../shared/database/prisma';
import { Errors } from '../../shared/utils/errors';
import { findExistingTourist } from '../../shared/utils/tourist-identity';
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
    // Каскад ідентичності: паспорт+ДН → email → створити нового.
    // Раніше перевірка була тільки по email при Tourist.email @unique —
    // агентське бронювання на двох осіб зі спільною адресою падало з 409.
    const existing = await findExistingTourist(prisma, {
      passportNumber: dto.passportNumber,
      dateOfBirth:    dto.dateOfBirth,
      email:          dto.email,
    });

    if (existing) {
      // Збіг за паспортом і ДН — це справді та сама людина, конфлікт.
      // Збіг лише за email конфліктом не вважаємо: спільна адреса на
      // родину — нормальний сценарій, повертаємо наявний профіль.
      if (dto.passportNumber && dto.dateOfBirth) {
        throw Errors.conflict('Турист із таким паспортом і датою народження вже існує');
      }
      return existing;
    }

    return prisma.tourist.create({
      data: {
        firstName:      dto.firstName,
        lastName:       dto.lastName,
        email:          dto.email || undefined,
        phone:          dto.phone,
        nationality:    dto.nationality,
        passportNumber: dto.passportNumber,
        dateOfBirth:    dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
  }
}
