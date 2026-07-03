// =============================================================================
// EUROTRIPS — Tourists Service
// Мінімальний модуль: пошук + створення. Потрібен для форми бронювання
// (POST /bookings вимагає існуючий contactTouristId).
// =============================================================================

import prisma from '../../shared/database/prisma';
import { Errors } from '../../shared/utils/errors';
import type { TouristListQueryDto, CreateTouristDto, UpdateTouristProfileDto } from './tourists.schema';

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

  // ── GET BY ID ────────────────────────────────────────────────────────────
  async getById(id: string) {
    const tourist = await prisma.tourist.findUnique({ where: { id } });
    if (!tourist) throw Errors.notFound('Турист', id);
    return tourist;
  }

  // ── UPDATE PROFILE (self-service) ───────────────────────────────────────
  async updateProfile(id: string, dto: UpdateTouristProfileDto) {
    await this.getById(id); // 404 якщо не існує

    return prisma.tourist.update({
      where: { id },
      data: {
        ...(dto.phone               !== undefined && { phone: dto.phone }),
        ...(dto.dateOfBirth         !== undefined && { dateOfBirth: new Date(dto.dateOfBirth) }),
        ...(dto.passportNumber      !== undefined && { passportNumber: dto.passportNumber }),
        ...(dto.passportExpiry      !== undefined && { passportExpiry: new Date(dto.passportExpiry) }),
        ...(dto.nationality         !== undefined && { nationality: dto.nationality }),
        ...(dto.allergies           !== undefined && { allergies: dto.allergies }),
        ...(dto.dietaryRestrictions !== undefined && { dietaryRestrictions: dto.dietaryRestrictions }),
      },
    });
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
