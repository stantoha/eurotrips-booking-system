// =============================================================================
// EUROTRIPS — Finance Routes (MVP)
// TC-RBAC-002: GET /finance/summary → 403 для агента
// TC-RBAC-003: GET /finance/debts   → 403 для агента
// TC-RBAC-004: GET /finance/summary → НЕ 401 для менеджера
// TC-RBAC-016: GET /finance/summary → 401 без токену
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';
import { getCurrentUser } from '../../shared/guards/jwt.guard';
import prisma from '../../shared/database/prisma';

// Ролі, що мають доступ до фінансів
const FINANCE_ROLES = ['admin', 'director', 'manager', 'accountant'] as const;

export async function financeRoutes(app: FastifyInstance) {

  // ── GET /finance/summary ─────────────────────────────────────────────────
  app.get(
    '/summary',
    {
      preHandler: [requireAuth, requireRoles(...FINANCE_ROLES)],
      schema: {
        summary: 'Фінансовий зведений звіт',
        description: 'Доступно: admin, director, manager, accountant. Агент → 403.',
        tags: ['Finance'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      // MVP: реальні агреговані дані
      const [
        totalBookings,
        totalConfirmed,
        revenueResult,
      ] = await Promise.all([
        prisma.booking.count(),
        prisma.booking.count({ where: { status: { in: ['confirmed', 'completed', 'ready_to_depart', 'on_trip'] } } }),
        prisma.booking.aggregate({
          _sum: { totalAmount: true, depositPaid: true, balancePaid: true },
          where: { status: { not: 'cancelled_client' } },
        }),
      ]);

      return reply.code(200).send({
        data: {
          totalBookings,
          confirmedBookings: totalConfirmed,
          totalRevenue: Number(revenueResult._sum.totalAmount ?? 0),
          collectedRevenue: Number((revenueResult._sum.depositPaid ?? 0)) +
                            Number((revenueResult._sum.balancePaid ?? 0)),
          currency: 'EUR',
          generatedAt: new Date().toISOString(),
        },
      });
    }
  );

  // ── GET /finance/debts ───────────────────────────────────────────────────
  app.get(
    '/debts',
    {
      preHandler: [requireAuth, requireRoles(...FINANCE_ROLES)],
      schema: {
        summary: 'Дебіторська заборгованість',
        description: 'Бронювання з неповною оплатою. Агент → 403.',
        tags: ['Finance'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const query = req.query as { page?: string; limit?: string };
      const page  = parseInt(query.page  ?? '1', 10);
      const limit = parseInt(query.limit ?? '20', 10);

      const debts = await prisma.booking.findMany({
        where: {
          paymentStatus: { in: ['unpaid', 'deposit_paid', 'partially_paid', 'overdue'] },
          status: { notIn: ['cancelled_client', 'cancelled_operator', 'refund', 'no_show'] },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { balanceDeadline: 'asc' },
        select: {
          id: true,
          bookingNumber: true,
          totalAmount: true,
          depositPaid: true,
          balancePaid: true,
          balanceDeadline: true,
          paymentStatus: true,
          status: true,
          contactTourist: { select: { firstName: true, lastName: true, phone: true } },
          tour: { select: { code: true, name: true, departureDate: true } },
        },
      });

      return reply.code(200).send({ data: debts });
    }
  );

  // ── GET /finance/tours/:id/summary ──────────────────────────────────────
  // RBAC: admin, director, manager (НЕ agent — BR-04)
  app.get<{ Params: { id: string } }>(
    '/tours/:id/summary',
    {
      preHandler: [requireAuth, requireRoles('admin', 'director', 'manager')],
      schema: {
        summary: 'Фінансове зведення по туру',
        description: 'Доходи, витрати, прибуток по конкретному туру. Агент → 403 (BR-04).',
        tags: ['Finance'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = req.params;

      const tour = await prisma.tour.findFirst({
        where: { id, isArchived: false },
        select: {
          id: true, code: true, name: true,
          basePrice: true, costPrice: true,
          totalSeats: true, availableSeats: true,
          _count: { select: { bookings: true } },
        },
      });

      if (!tour) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Тур не знайдено' } });
      }

      const [revenueAgg, commissionsAgg, extrasAgg] = await Promise.all([
        prisma.booking.aggregate({
          where: { tourId: id, status: { notIn: ['cancelled_client', 'cancelled_operator', 'refund'] } },
          _sum: { totalAmount: true, depositPaid: true, balancePaid: true },
          _count: { id: true },
        }),
        prisma.agentCommission.aggregate({
          where: { booking: { tourId: id }, status: { in: ['to_pay', 'paid'] } },
          _sum: { amount: true },
        }),
        prisma.tourExtra.aggregate({
          where: { tourId: id },
          _sum: { costEur: true },
        }),
      ]);

      const revenue          = Number(revenueAgg._sum.totalAmount ?? 0);
      const collected        = Number(revenueAgg._sum.depositPaid ?? 0) + Number(revenueAgg._sum.balancePaid ?? 0);
      const bookingsCount    = revenueAgg._count.id;
      const hotelCosts       = Number(tour.costPrice ?? 0) * bookingsCount;
      const transportCosts   = 0; // TODO: transport_bookings aggregate
      const extrasCosts      = Number(extrasAgg._sum.costEur ?? 0);
      const commissionsPaid  = Number(commissionsAgg._sum.amount ?? 0);
      const grossProfit      = revenue - hotelCosts - transportCosts - extrasCosts;
      const netProfit        = grossProfit - commissionsPaid;
      const marginPct        = revenue > 0 ? Math.round((netProfit / revenue) * 10000) / 100 : 0;

      return reply.code(200).send({
        data: {
          tourId: tour.id, code: tour.code, name: tour.name,
          bookingsCount,
          revenue,
          collected,
          hotel_costs:       hotelCosts,
          transport_costs:   transportCosts,
          extras_costs:      extrasCosts,
          commissions_paid:  commissionsPaid,
          gross_profit:      grossProfit,
          net_profit:        netProfit,
          margin_pct:        marginPct,
          currency:          'EUR',
          generatedAt:       new Date().toISOString(),
        },
      });
    }
  );

  // ── GET /finance/tours/:id/pnl ───────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/tours/:id/pnl',
    {
      preHandler: [requireAuth, requireRoles('admin', 'director', 'accountant')],
      schema: {
        summary: 'P&L по туру',
        tags: ['Finance'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const tour = await prisma.tour.findFirst({
        where: { id: req.params.id, isArchived: false },
        select: {
          id: true, code: true, name: true,
          basePrice: true, costPrice: true,
          totalSeats: true, availableSeats: true,
          _count: { select: { bookings: true } },
        },
      });

      if (!tour) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Тур не знайдено' } });
      }

      const revenue = await prisma.booking.aggregate({
        where: { tourId: req.params.id, status: { notIn: ['cancelled_client', 'cancelled_operator'] } },
        _sum: { totalAmount: true, depositPaid: true, balancePaid: true },
        _count: { id: true },
      });

      const totalRevenue    = Number(revenue._sum.totalAmount ?? 0);
      const totalCost       = Number(tour.costPrice ?? 0) * revenue._count.id;
      const grossProfit     = totalRevenue - totalCost;
      const bookedSeats     = tour.totalSeats - tour.availableSeats;
      const occupancyPct    = Math.round((bookedSeats / tour.totalSeats) * 100);

      return reply.code(200).send({
        data: {
          tourId: tour.id, code: tour.code, name: tour.name,
          totalRevenue, totalCost, grossProfit,
          bookingsCount: revenue._count.id,
          bookedSeats, totalSeats: tour.totalSeats, occupancyPct,
          currency: 'EUR',
        },
      });
    }
  );
}
