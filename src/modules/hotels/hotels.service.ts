// =============================================================================
// EUROTRIPS — Hotels Service
// Каталог готелів (563+ записів з CSV, CLAUDE.md §6: GET /hotels?country=&city=&stars=)
//
// Soft-delete: модель Hotel не має булевого isArchived — статус вільний рядок
// status ('active' | 'inactive' | 'archived', @db.VarChar(30)). Список за
// замовчуванням приховує 'archived', деталі за id доступні завжди.
// =============================================================================

import { Prisma } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { Errors } from '../../shared/utils/errors';
import type { HotelListQueryDto } from './hotels.schema';

const HOTEL_LIST_SELECT = {
  id:                true,
  name:              true,
  country:           true,
  city:              true,
  district:          true,
  accommodationType: true,
  stars:             true,
  reviewScore:       true,
  reviewCount:        true,
  distanceFromCentre: true,
  priceApr:          true,
  priceJun:          true,
  priceOct:          true,
  isFamilyFriendly:  true,
  isVerified:        true,
  status:            true,
} as const;

export class HotelsService {

  // ── LIST ─────────────────────────────────────────────────────────────────
  async listHotels(query: HotelListQueryDto) {
    const { country, city, stars, search, page, limit, sortBy, sortOrder } = query;

    const where: Prisma.HotelWhereInput = {
      status: { not: 'archived' },
      ...(country && { country: { equals: country, mode: 'insensitive' } }),
      ...(city    && { city:    { equals: city,    mode: 'insensitive' } }),
      ...(stars !== undefined && { stars }),
      ...(search && {
        OR: [
          { name:    { contains: search, mode: 'insensitive' } },
          { city:    { contains: search, mode: 'insensitive' } },
          { country: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.HotelOrderByWithRelationInput =
      sortBy === 'city'  ? { city: sortOrder } :
      sortBy === 'stars' ? { stars: sortOrder } :
      sortBy === 'createdAt' ? { createdAt: sortOrder } :
      { name: sortOrder };

    const [total, hotels] = await Promise.all([
      prisma.hotel.count({ where }),
      prisma.hotel.findMany({
        where,
        orderBy,
        skip:  (page - 1) * limit,
        take:  limit,
        select: HOTEL_LIST_SELECT,
      }),
    ]);

    return {
      data: hotels,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ── GET ONE ──────────────────────────────────────────────────────────────
  async getHotel(id: string) {
    const hotel = await prisma.hotel.findUnique({
      where: { id },
      include: {
        _count: { select: { hotelBookings: true } },
      },
    });

    if (!hotel) throw Errors.notFound('Готель', id);
    return hotel;
  }
}
