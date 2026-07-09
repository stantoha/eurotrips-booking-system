// =============================================================================
// EUROTRIPS — Analytics Service
// Базова аналітика MVP (CLAUDE.md §16, Реліз 1): sales-funnel / tours-load /
// agents-top. RBAC [admin, director, manager] на рівні роутів; costPrice
// (собівартість) в tours-load повертається ТІЛЬКИ admin/director/accountant
// (за завданням — суворіше за загальний canSeeMargin з CLAUDE.md BR-04,
// тут менеджер теж НЕ бачить собівартість).
// =============================================================================

import { UserRole, BookingStatus, Prisma } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import type {
  AnalyticsPeriodQueryDto,
  ToursLoadQueryDto,
  AgentsTopQueryDto,
} from './analytics.schema';
import type { JwtPayload } from '../auth/auth.types';

/** Бронювання вважається "підтвердженим" з цього статусу і далі (BR-06) */
const CONFIRMED_OR_BEYOND: BookingStatus[] = [
  BookingStatus.confirmed,
  BookingStatus.docs_collected,
  BookingStatus.ready_to_depart,
  BookingStatus.on_trip,
  BookingStatus.completed,
];

/** Собівартість (costPrice) бачать тільки ці ролі — суворіше за canSeeMargin */
const CAN_SEE_COST_ROLES: UserRole[] = [UserRole.admin, UserRole.director, UserRole.accountant];

const DEFAULT_PERIOD_DAYS = 30;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Якщо період не вказано — останні 30 днів (типово для дашборду продажів) */
function resolvePeriod(dateFrom?: Date, dateTo?: Date): { from?: Date; to?: Date } {
  if (!dateFrom && !dateTo) {
    const to = new Date();
    const from = new Date(to.getTime() - DEFAULT_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    return { from, to };
  }
  return { from: dateFrom, to: dateTo };
}

function createdAtFilter(from?: Date, to?: Date): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from && { gte: from }),
    ...(to && { lte: to }),
  };
}

export class AnalyticsService {

  // ── SALES FUNNEL: ліди → бронювання → підтверджені ──────────────────────
  async getSalesFunnel(query: AnalyticsPeriodQueryDto) {
    const { from, to } = resolvePeriod(query.dateFrom, query.dateTo);
    const createdAt = createdAtFilter(from, to);

    const [leadsCount, bookingsCount, confirmedCount] = await Promise.all([
      prisma.lead.count({ where: { ...(createdAt && { createdAt }) } }),
      prisma.booking.count({ where: { ...(createdAt && { createdAt }) } }),
      prisma.booking.count({
        where: {
          ...(createdAt && { createdAt }),
          status: { in: CONFIRMED_OR_BEYOND },
        },
      }),
    ]);

    return {
      period: { dateFrom: from ?? null, dateTo: to ?? null },
      funnel: {
        leads: leadsCount,
        bookings: bookingsCount,
        confirmed: confirmedCount,
      },
      conversion: {
        leadToBookingPct: leadsCount > 0 ? round2((bookingsCount / leadsCount) * 100) : 0,
        bookingToConfirmedPct: bookingsCount > 0 ? round2((confirmedCount / bookingsCount) * 100) : 0,
      },
    };
  }

  // ── TOURS LOAD: заповнюваність (sold/total seats) ───────────────────────
  async getToursLoad(query: ToursLoadQueryDto, user: JwtPayload) {
    const canSeeCost = CAN_SEE_COST_ROLES.includes(user.role);

    const where: Prisma.TourWhereInput = {
      isArchived: false,
      ...(query.status && { status: query.status }),
      ...((query.dateFrom || query.dateTo) && {
        departureDate: {
          ...(query.dateFrom && { gte: query.dateFrom }),
          ...(query.dateTo && { lte: query.dateTo }),
        },
      }),
    };

    const tours = await prisma.tour.findMany({
      where,
      orderBy: { departureDate: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        direction: true,
        departureDate: true,
        status: true,
        totalSeats: true,
        availableSeats: true,
        basePrice: true,
        ...(canSeeCost && { costPrice: true }),
      },
    });

    return tours.map((t) => {
      const soldSeats = t.totalSeats - t.availableSeats;
      return {
        ...t,
        soldSeats,
        occupancyPct: t.totalSeats > 0 ? round2((soldSeats / t.totalSeats) * 100) : 0,
      };
    });
  }

  // ── AGENTS TOP: за кількістю бронювань за період ────────────────────────
  async getAgentsTop(query: AgentsTopQueryDto) {
    const { from, to } = resolvePeriod(query.dateFrom, query.dateTo);
    const createdAt = createdAtFilter(from, to);

    const grouped = await prisma.booking.groupBy({
      by: ['agentId'],
      where: {
        agentId: { not: null },
        ...(createdAt && { createdAt }),
      },
      _count: { _all: true },
      _sum: { totalAmount: true, agentCommissionAmount: true },
      orderBy: { _count: { agentId: 'desc' } },
      take: query.limit,
    });

    const agentIds = grouped
      .map((g) => g.agentId)
      .filter((id): id is string => id !== null);

    const agents = await prisma.agent.findMany({
      where: { id: { in: agentIds } },
      select: {
        id: true,
        agencyName: true,
        agentType: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
    const agentById = new Map(agents.map((a) => [a.id, a]));

    return {
      period: { dateFrom: from ?? null, dateTo: to ?? null },
      agents: grouped.map((g) => {
        const agent = g.agentId ? agentById.get(g.agentId) : undefined;
        return {
          agentId: g.agentId,
          agencyName: agent?.agencyName ?? null,
          agentType: agent?.agentType ?? null,
          managerName: agent ? `${agent.user.firstName} ${agent.user.lastName}` : null,
          bookingsCount: g._count._all,
          totalAmount: Number(g._sum.totalAmount ?? 0),
          totalCommission: Number(g._sum.agentCommissionAmount ?? 0),
        };
      }),
    };
  }
}
