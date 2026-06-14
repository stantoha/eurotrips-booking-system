// =============================================================================
// EUROTRIPS — Tours Service
// BR-01: availableSeats — тільки через транзакцію
// BR-04: costPrice НІКОЛИ не повертається агентам/туристам
// OPS-01: тур не може відкритись без затвердженої структури
// =============================================================================

import { TourStatus, UserRole, Prisma } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { Errors, AppError } from '../../shared/utils/errors';
import {
  ALLOWED_STATUS_TRANSITIONS,
  type CreateTourDto,
  type UpdateTourDto,
  type ChangeStatusDto,
  type TourListQueryDto,
} from './tours.schema';
import {
  COST_PRICE_VISIBLE_ROLES,
  type TourListItem,
  type TourDetailAdmin,
  type TourDetailPublic,
  type TourAvailability,
} from './tours.types';
import type { JwtPayload } from '../auth/auth.types';

export class ToursService {

  // ── LIST ─────────────────────────────────────────────────────────────────
  async listTours(query: TourListQueryDto, user: JwtPayload) {
    const {
      status, tourType, departureDateFrom, departureDateTo,
      product, direction, departureCity,
      tags, availableOnly,
      page, limit, sortBy, sortOrder,
    } = query;

    const where: Prisma.TourWhereInput = {
      isArchived: false,
      ...(status && { status }),
      ...(tourType && { tourType }),
      ...(product && { product: { contains: product, mode: 'insensitive' } }),
      ...(direction && { direction: { contains: direction, mode: 'insensitive' } }),
      ...(departureCity && { departureCity: { contains: departureCity, mode: 'insensitive' } }),
      ...(departureDateFrom && { departureDate: { gte: new Date(departureDateFrom) } }),
      ...(departureDateTo && {
        departureDate: {
          ...(departureDateFrom ? { gte: new Date(departureDateFrom) } : {}),
          lte: new Date(departureDateTo),
        },
      }),
      ...(availableOnly && { availableSeats: { gt: 0 } }),
      ...(tags && {
        tags: { hasSome: tags.split(',').map((t) => t.trim()) },
      }),
    };

    const orderBy = this.buildOrderBy(sortBy, sortOrder);
    const skip = (page - 1) * limit;

    const [tours, total] = await Promise.all([
      prisma.tour.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: this.listSelect(),
      }),
      prisma.tour.count({ where }),
    ]);

    return {
      data: tours.map((t) => this.toListItem(t, user.role)),
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ── GET BY ID ─────────────────────────────────────────────────────────────
  async getTourById(
    id: string,
    user: JwtPayload
  ): Promise<TourDetailAdmin | TourDetailPublic> {
    const tour = await prisma.tour.findFirst({
      where: { id, isArchived: false },
      include: {
        cancelPolicy: { select: { id: true, name: true, rules: true } },
        guide: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });

    if (!tour) throw Errors.notFound('Тур', id);

    const canSeeCostPrice = COST_PRICE_VISIBLE_ROLES.includes(user.role);

    return {
      id: tour.id,
      code: tour.code,
      name: tour.name,
      product: tour.product,
      direction: tour.direction,
      countries: tour.countries,
      tourType: tour.tourType,
      format: tour.format,
      departureDate: tour.departureDate.toISOString().split('T')[0],
      returnDate: tour.returnDate.toISOString().split('T')[0],
      durationDays: tour.durationDays,
      departureCity: tour.departureCity,
      arrivalCity: tour.arrivalCity,
      basePrice: Number(tour.basePrice),
      currency: tour.currency,
      depositAmount: tour.depositAmount ? Number(tour.depositAmount) : null,
      depositDeadline: tour.depositDeadline
        ? tour.depositDeadline.toISOString().split('T')[0]
        : null,
      agentCommissionPct: Number(tour.agentCommissionPct),
      totalSeats: tour.totalSeats,
      availableSeats: tour.availableSeats,
      status: tour.status,
      tags: tour.tags,
      isFamily: tour.isFamily,
      isPremium: tour.isPremium,
      isCorporate: tour.isCorporate,
      isFirstExperience: tour.isFirstExperience,
      audience: tour.audience,
      difficulty: tour.difficulty,
      included: tour.included,
      notIncluded: tour.notIncluded,
      asanaLink: tour.asanaLink,
      // BR-04: costPrice тільки для внутрішніх ролей
      ...(canSeeCostPrice && { costPrice: tour.costPrice ? Number(tour.costPrice) : null }),
      createdAt: tour.createdAt.toISOString(),
      updatedAt: tour.updatedAt.toISOString(),
    } as TourDetailAdmin;
  }

  // ── AVAILABILITY ──────────────────────────────────────────────────────────
  async checkAvailability(id: string): Promise<TourAvailability> {
    const tour = await prisma.tour.findFirst({
      where: { id, isArchived: false },
      select: {
        id: true, code: true, name: true,
        totalSeats: true, availableSeats: true, status: true,
      },
    });

    if (!tour) throw Errors.notFound('Тур', id);

    const bookedSeats = tour.totalSeats - tour.availableSeats;
    const occupancyPct = Math.round((bookedSeats / tour.totalSeats) * 100);

    return {
      tourId: tour.id,
      code: tour.code,
      name: tour.name,
      totalSeats: tour.totalSeats,
      availableSeats: tour.availableSeats,
      bookedSeats,
      occupancyPct,
      status: tour.status,
      isAvailable:
        tour.availableSeats > 0 &&
        ([TourStatus.open, TourStatus.active, TourStatus.almost_full] as TourStatus[]).includes(tour.status),
    };
  }

  // ── CREATE ────────────────────────────────────────────────────────────────
  async createTour(dto: CreateTourDto, createdById: string) {
    // Перевірити унікальність коду
    const existing = await prisma.tour.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new AppError('TOUR_CODE_EXISTS', `Тур з кодом "${dto.code}" вже існує`, 409);
    }

    const tour = await prisma.tour.create({
      data: {
        code: dto.code,
        name: dto.name,
        product: dto.product,
        direction: dto.direction,
        countries: dto.countries,
        tourType: dto.tourType,
        format: dto.format,
        departureDate: new Date(dto.departureDate),
        returnDate: new Date(dto.returnDate),
        durationDays: dto.durationDays,
        departureCity: dto.departureCity,
        arrivalCity: dto.arrivalCity,
        basePrice: dto.basePrice,
        currency: dto.currency,
        depositAmount: dto.depositAmount,
        depositDeadline: dto.depositDeadline ? new Date(dto.depositDeadline) : undefined,
        cancelPolicyId: dto.cancelPolicyId,
        agentCommissionPct: dto.agentCommissionPct,
        totalSeats: dto.totalSeats,
        availableSeats: dto.totalSeats, // спочатку всі місця вільні
        costPrice: dto.costPrice,
        included: dto.included,
        notIncluded: dto.notIncluded,
        tags: dto.tags,
        audience: dto.audience,
        difficulty: dto.difficulty,
        isFamily: dto.isFamily,
        isPremium: dto.isPremium,
        isCorporate: dto.isCorporate,
        isFirstExperience: dto.isFirstExperience,
        asanaLink: dto.asanaLink,
        status: TourStatus.draft,
      },
    });

    // Логуємо в audit
    await this.audit(createdById, 'CREATE', tour.id, null, { code: tour.code, name: tour.name });

    return tour;
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────
  async updateTour(id: string, dto: UpdateTourDto, updatedById: string) {
    const tour = await prisma.tour.findFirst({ where: { id, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', id);

    // Не можна редагувати завершений або скасований тур
    if (([TourStatus.completed, TourStatus.cancelled] as TourStatus[]).includes(tour.status)) {
      throw new AppError(
        'TOUR_IMMUTABLE',
        `Тур зі статусом "${tour.status}" не можна редагувати`,
        422
      );
    }

    // Якщо змінюється totalSeats — перераховуємо availableSeats
    let availableSeatsUpdate: number | undefined;
    if (dto.totalSeats !== undefined && dto.totalSeats !== tour.totalSeats) {
      const bookedSeats = tour.totalSeats - tour.availableSeats;
      if (dto.totalSeats < bookedSeats) {
        throw new AppError(
          'SEATS_REDUCE_CONFLICT',
          `Не можна зменшити місця до ${dto.totalSeats}: вже заброньовано ${bookedSeats} місць`,
          409
        );
      }
      availableSeatsUpdate = dto.totalSeats - bookedSeats;
    }

    const updated = await prisma.tour.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.product !== undefined && { product: dto.product }),
        ...(dto.direction !== undefined && { direction: dto.direction }),
        ...(dto.countries !== undefined && { countries: dto.countries }),
        ...(dto.tourType !== undefined && { tourType: dto.tourType }),
        ...(dto.format !== undefined && { format: dto.format }),
        ...(dto.departureDate !== undefined && { departureDate: new Date(dto.departureDate) }),
        ...(dto.returnDate !== undefined && { returnDate: new Date(dto.returnDate) }),
        ...(dto.durationDays !== undefined && { durationDays: dto.durationDays }),
        ...(dto.departureCity !== undefined && { departureCity: dto.departureCity }),
        ...(dto.arrivalCity !== undefined && { arrivalCity: dto.arrivalCity }),
        ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
        ...(dto.depositAmount !== undefined && { depositAmount: dto.depositAmount }),
        ...(dto.depositDeadline !== undefined && { depositDeadline: new Date(dto.depositDeadline) }),
        ...(dto.cancelPolicyId !== undefined && { cancelPolicyId: dto.cancelPolicyId }),
        ...(dto.agentCommissionPct !== undefined && { agentCommissionPct: dto.agentCommissionPct }),
        ...(dto.totalSeats !== undefined && { totalSeats: dto.totalSeats }),
        ...(availableSeatsUpdate !== undefined && { availableSeats: availableSeatsUpdate }),
        ...(dto.costPrice !== undefined && { costPrice: dto.costPrice }),
        ...(dto.included !== undefined && { included: dto.included }),
        ...(dto.notIncluded !== undefined && { notIncluded: dto.notIncluded }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.audience !== undefined && { audience: dto.audience }),
        ...(dto.difficulty !== undefined && { difficulty: dto.difficulty }),
        ...(dto.isFamily !== undefined && { isFamily: dto.isFamily }),
        ...(dto.isPremium !== undefined && { isPremium: dto.isPremium }),
        ...(dto.isCorporate !== undefined && { isCorporate: dto.isCorporate }),
        ...(dto.isFirstExperience !== undefined && { isFirstExperience: dto.isFirstExperience }),
        ...(dto.asanaLink !== undefined && { asanaLink: dto.asanaLink }),
        ...(dto.guideId !== undefined && { guideId: dto.guideId }),
      },
    });

    await this.audit(updatedById, 'UPDATE', id, { status: tour.status }, dto);

    return updated;
  }

  // ── CHANGE STATUS ─────────────────────────────────────────────────────────
  async changeTourStatus(id: string, dto: ChangeStatusDto, changedById: string) {
    const tour = await prisma.tour.findFirst({ where: { id, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', id);

    const allowed = ALLOWED_STATUS_TRANSITIONS[tour.status];
    if (!allowed.includes(dto.status)) {
      throw Errors.invalidStatusTransition(tour.status, dto.status);
    }

    // OPS-01: тур не може перейти в 'open' без затвердженої структури
    // (перевірка hotel_bookings.structure_status)
    if (dto.status === TourStatus.open) {
      const unapprovedHotelBookings = await prisma.hotelBooking.count({
        where: {
          tourId: id,
          structureStatus: { not: 'approved' },
          isFastLaunch: false,
        },
      });

      if (unapprovedHotelBookings > 0) {
        throw new AppError(
          'STRUCTURE_NOT_APPROVED',
          `Тур не може бути відкритий: ${unapprovedHotelBookings} готельних бронювань без затвердженої структури (OPS-01)`,
          422
        );
      }
    }

    const updated = await prisma.tour.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.audit(changedById, 'STATUS_CHANGE', id,
      { status: tour.status },
      { status: dto.status, reason: dto.reason }
    );

    return updated;
  }

  // ── ARCHIVE ───────────────────────────────────────────────────────────────
  async archiveTour(id: string, archivedById: string) {
    const tour = await prisma.tour.findFirst({ where: { id, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', id);

    if (tour.status === TourStatus.on_tour) {
      throw new AppError('TOUR_ON_TOUR', 'Не можна архівувати тур під час поїздки', 422);
    }

    const updated = await prisma.tour.update({
      where: { id },
      data: { isArchived: true },
    });

    await this.audit(archivedById, 'ARCHIVE', id, null, null);
    return updated;
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────────────────────

  private listSelect() {
    return {
      id: true, code: true, name: true, product: true,
      direction: true, countries: true, tourType: true,
      departureDate: true, returnDate: true, durationDays: true,
      departureCity: true, basePrice: true, currency: true,
      depositAmount: true, agentCommissionPct: true,
      totalSeats: true, availableSeats: true, status: true,
      tags: true, isFamily: true, isPremium: true,
      // costPrice навмисно відсутній у SELECT — фільтруємо на рівні БД
    } as const;
  }

  private toListItem(tour: any, role: UserRole): TourListItem {
    return {
      id: tour.id,
      code: tour.code,
      name: tour.name,
      product: tour.product,
      direction: tour.direction,
      countries: tour.countries,
      tourType: tour.tourType,
      departureDate: tour.departureDate.toISOString().split('T')[0],
      returnDate: tour.returnDate.toISOString().split('T')[0],
      durationDays: tour.durationDays,
      departureCity: tour.departureCity,
      basePrice: Number(tour.basePrice),
      currency: tour.currency,
      depositAmount: tour.depositAmount ? Number(tour.depositAmount) : null,
      agentCommissionPct: Number(tour.agentCommissionPct),
      totalSeats: tour.totalSeats,
      availableSeats: tour.availableSeats,
      status: tour.status,
      tags: tour.tags,
      isFamily: tour.isFamily,
      isPremium: tour.isPremium,
    };
  }

  private buildOrderBy(
    sortBy: string = 'departureDate',
    sortOrder: 'asc' | 'desc' = 'asc'
  ): Prisma.TourOrderByWithRelationInput {
    return { [sortBy]: sortOrder };
  }

  private async audit(
    userId: string,
    action: string,
    recordId: string,
    oldData: unknown,
    newData: unknown
  ) {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        tableName: 'tours',
        recordId,
        oldData: oldData as Prisma.InputJsonValue,
        newData: newData as Prisma.InputJsonValue,
      },
    }).catch(() => {}); // Не ламаємо основний flow якщо аудит впав
  }
}
