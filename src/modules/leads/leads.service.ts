// =============================================================================
// EUROTRIPS — Leads Service
// PATCH /leads/:id/convert — головний ендпоінт:
//   1. Перевіряє лід і тур
//   2. Створює Booking зі статусом 'new' + linkує lead_id
//   3. Оновлює lead: status = 'won', convertedToBookingId = booking.id
// =============================================================================

import { LeadStatus, UserRole, Prisma } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { Errors, AppError } from '../../shared/utils/errors';
import { generateBookingNumber } from '../../shared/utils/booking-number';
import { calculateCommission } from '../../shared/utils/commission';
import type { JwtPayload } from '../auth/auth.types';
import type {
  LeadListQueryDto, CreateLeadDto, UpdateLeadDto, ConvertLeadDto,
} from './leads.schema';

export class LeadsService {

  // ── LIST ─────────────────────────────────────────────────────────────────
  async listLeads(query: LeadListQueryDto, user: JwtPayload) {
    const { status, source, managerId, tourId, search, dateFrom, dateTo, page, limit } = query;

    // Менеджер бачить тільки свої ліди (якщо не admin/director)
    const managerFilter =
      user.role === UserRole.manager
        ? { managerId: user.sub }
        : managerId
          ? { managerId }
          : {};

    const where: Prisma.LeadWhereInput = {
      ...managerFilter,
      ...(status && { status }),
      ...(source && { source }),
      ...(tourId && { tourId }),
      ...(dateFrom && { createdAt: { gte: new Date(dateFrom) } }),
      ...(dateTo   && { createdAt: { lte: new Date(dateTo) } }),
      ...(search   && {
        OR: [
          { interestNote: { contains: search, mode: 'insensitive' } },
          { tourist: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName:  { contains: search, mode: 'insensitive' } },
              { phone:     { contains: search, mode: 'insensitive' } },
            ],
          }},
        ],
      }),
    };

    const skip = (page - 1) * limit;

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tourist: { select: { id: true, firstName: true, lastName: true,
                               phone: true, email: true } },
          tour:    { select: { id: true, code: true, name: true, departureDate: true } },
          manager: { select: { id: true, firstName: true, lastName: true } },
          agent:   { select: { id: true, agencyName: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      data: leads,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ── CREATE ────────────────────────────────────────────────────────────────
  async createLead(dto: CreateLeadDto, user: JwtPayload) {
    let touristId = dto.touristId;

    // Якщо передали нові дані туриста — створюємо або знаходимо
    if (!touristId && dto.tourist) {
      const existing = dto.tourist.email
        ? await prisma.tourist.findUnique({ where: { email: dto.tourist.email } })
        : null;

      if (existing) {
        touristId = existing.id;
      } else {
        const created = await prisma.tourist.create({
          data: {
            firstName:     dto.tourist.firstName,
            lastName:      dto.tourist.lastName,
            email:         dto.tourist.email,
            phone:         dto.tourist.phone,
            sourceChannel: dto.source,
          },
        });
        touristId = created.id;
      }
    }

    // Менеджер — поточний юзер якщо роль manager
    const managerId = dto.managerId
      ?? (user.role === UserRole.manager ? user.sub : user.sub);

    const lead = await prisma.lead.create({
      data: {
        touristId:    touristId!,
        managerId,
        tourId:       dto.tourId,
        agentId:      dto.agentId,
        source:       dto.source,
        status:       LeadStatus.new,
        interestNote: dto.interestNote,
        budget:       dto.budget,
        personsCount: dto.personsCount,
        nextActionAt: dto.nextActionAt ? new Date(dto.nextActionAt) : undefined,
        notes:        dto.notes,
      },
      include: {
        tourist: { select: { id: true, firstName: true, lastName: true, phone: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return lead;
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────
  async updateLead(id: string, dto: UpdateLeadDto, user: JwtPayload) {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) throw Errors.notFound('Лід', id);

    // Менеджер може редагувати тільки свої ліди
    if (user.role === UserRole.manager && lead.managerId !== user.sub) {
      throw Errors.forbidden('Доступ до чужого ліда заборонено');
    }

    // Конвертований лід не можна редагувати
    if (lead.convertedToBookingId) {
      throw new AppError('LEAD_CONVERTED', 'Конвертований лід не можна редагувати', 422);
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        ...(dto.status       !== undefined && { status: dto.status }),
        ...(dto.tourId       !== undefined && { tourId: dto.tourId }),
        ...(dto.managerId    !== undefined && { managerId: dto.managerId }),
        ...(dto.agentId      !== undefined && { agentId: dto.agentId }),
        ...(dto.interestNote !== undefined && { interestNote: dto.interestNote }),
        ...(dto.budget       !== undefined && { budget: dto.budget }),
        ...(dto.personsCount !== undefined && { personsCount: dto.personsCount }),
        ...(dto.nextActionAt !== undefined && {
          nextActionAt: dto.nextActionAt ? new Date(dto.nextActionAt) : null,
        }),
        ...(dto.lossReason   !== undefined && { lossReason: dto.lossReason }),
        ...(dto.notes        !== undefined && { notes: dto.notes }),
      },
      include: {
        tourist: { select: { id: true, firstName: true, lastName: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return updated;
  }

  // ── CONVERT TO BOOKING ────────────────────────────────────────────────────
  // Найважливіший метод: бере дані ліда + ConvertLeadDto,
  // створює Booking зі статусом 'new', лінкує lead_id
  async convertToBooking(id: string, dto: ConvertLeadDto, user: JwtPayload) {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        tourist: true,
        agent:   { select: { id: true, commissionPct: true, coCommissionPct: true,
                             royaltyPct: true, agentType: true } },
      },
    });

    if (!lead)                       throw Errors.notFound('Лід', id);
    if (lead.convertedToBookingId)   throw new AppError('LEAD_ALREADY_CONVERTED',
      `Лід вже конвертований у бронювання ${lead.convertedToBookingId}`, 409);

    // Перевіряємо тур
    const tour = await prisma.tour.findFirst({
      where: {
        id: dto.tourId,
        isArchived: false,
        availableSeats: { gte: dto.personsCount ?? lead.personsCount ?? 1 },
        status: { in: ['open', 'active', 'almost_full'] },
      },
    });

    if (!tour) {
      const exists = await prisma.tour.findUnique({ where: { id: dto.tourId } });
      if (!exists) throw Errors.notFound('Тур', dto.tourId);
      throw Errors.seatsUnavailable();
    }

    const personsCount = dto.personsCount ?? lead.personsCount ?? 1;
    const effectiveAgentId = dto.agentId ?? lead.agentId;
    const balanceAmount    = Number(dto.totalAmount) - Number(dto.depositAmount);

    return await prisma.$transaction(async (tx) => {
      // Знімаємо місця
      await tx.tour.update({
        where: { id: dto.tourId },
        data:  { availableSeats: { decrement: personsCount } },
      });

      const bookingNumber = await generateBookingNumber();

      // Створюємо бронювання зі статусом 'new' і lead_id
      const booking = await tx.booking.create({
        data: {
          bookingNumber,
          tourId:           dto.tourId,
          leadId:           id,   // ← ключовий зв'язок
          bookingType:      dto.bookingType as any,
          contactTouristId: lead.touristId!,
          managerId:        lead.managerId ?? user.sub,
          agentId:          effectiveAgentId,
          personsCount,
          totalAmount:      dto.totalAmount,
          depositAmount:    dto.depositAmount,
          balanceAmount,
          depositDeadline:  dto.depositDeadline ? new Date(dto.depositDeadline) : undefined,
          balanceDeadline:  dto.balanceDeadline ? new Date(dto.balanceDeadline) : undefined,
          comment:          dto.comment,
          sourceChannel:    lead.source,
          status:           'new',
          paymentStatus:    'unpaid',
        },
      });

      // Базовий учасник — контактний турист
      await tx.bookingTourist.create({
        data: {
          bookingId: booking.id,
          touristId: lead.touristId!,
          role:      'contact',
        },
      });

      // Комісія якщо є агент
      if (effectiveAgentId && lead.agent) {
        const commResult = calculateCommission(
          Number(tour.basePrice), personsCount, lead.agent as any
        );
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            agentCommissionRate:   lead.agent.commissionPct,
            agentCommissionAmount: commResult.grossAmount,
            commissionStatus:      'pending',
          },
        });
        await tx.agentCommission.create({
          data: {
            bookingId:      booking.id,
            agentId:        effectiveAgentId,
            grossAmount:    commResult.grossAmount,
            agentAmount:    commResult.agentAmount,
            coAmount:       commResult.coAmount,
            royaltyAmount:  commResult.royaltyAmount,
            commissionRate: Number(lead.agent.commissionPct),
            status:         'pending',
          },
        });
      }

      // Оновлюємо лід: status = won, convertedToBookingId = booking.id
      const updatedLead = await tx.lead.update({
        where: { id },
        data: {
          status:                LeadStatus.won,
          convertedToBookingId:  booking.id,
        },
      });

      return {
        lead:    updatedLead,
        booking: { id: booking.id, bookingNumber: booking.bookingNumber, status: booking.status },
      };
    });
  }
}
