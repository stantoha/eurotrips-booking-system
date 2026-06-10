// =============================================================================
// EUROTRIPS — Bookings Routes (MVP)
// GET  /api/v1/bookings         — список (RBAC: агент бачить тільки свої)
// GET  /api/v1/bookings/:id     — деталь (IDOR захист: 403 для чужих)
// TC-RBAC-009, TC-RBAC-010, TC-RBAC-011
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { requireAuth } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';
import { getCurrentUser } from '../../shared/guards/jwt.guard';
import { Errors } from '../../shared/utils/errors';
import type { JwtPayload } from '../auth/auth.types';

export async function bookingRoutes(app: FastifyInstance) {

  // ── GET /bookings ────────────────────────────────────────────────────────
  // TC-RBAC-009: агент бачить ТІЛЬКИ свої бронювання
  // TC-RBAC-010: менеджер бачить ВСІ бронювання
  app.get(
    '/',
    {
      preHandler: [requireAuth],
      schema: {
        summary: 'Список бронювань',
        description: 'Агент отримує тільки власні бронювання (agentId = поточний агент). Менеджер, адмін — всі.',
        tags: ['Bookings'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            status:   { type: 'string' },
            tourId:   { type: 'string' },
            page:     { type: 'string', default: '1' },
            limit:    { type: 'string', default: '20' },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = getCurrentUser(req);
      const query = req.query as { status?: string; tourId?: string; page?: string; limit?: string };

      const page  = parseInt(query.page  ?? '1',  10);
      const limit = parseInt(query.limit ?? '20', 10);
      const skip  = (page - 1) * limit;

      // RBAC фільтр: агент бачить тільки свої бронювання
      const agentFilter = user.role === UserRole.agent && user.agentId
        ? { agentId: user.agentId }
        : {};

      const where = {
        ...agentFilter,
        ...(query.status && { status: query.status as any }),
        ...(query.tourId && { tourId: query.tourId }),
      };

      const [bookings, total] = await Promise.all([
        prisma.booking.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            bookingNumber: true,
            tourId: true,
            bookingType: true,
            personsCount: true,
            totalAmount: true,
            depositPaid: true,
            balancePaid: true,
            paymentStatus: true,
            status: true,
            agentId: true,
            managerId: true,
            createdAt: true,
            updatedAt: true,
            tour: {
              select: { id: true, code: true, name: true, departureDate: true },
            },
            contactTourist: {
              select: { id: true, firstName: true, lastName: true, phone: true },
            },
          },
        }),
        prisma.booking.count({ where }),
      ]);

      return reply.code(200).send({
        data: bookings,
        meta: { total, page, limit, pages: Math.ceil(total / limit) },
      });
    }
  );

  // ── GET /bookings/:id ────────────────────────────────────────────────────
  // TC-RBAC-011: IDOR захист — агент отримує 403 для чужого бронювання
  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [requireAuth],
      schema: {
        summary: 'Деталь бронювання',
        description: 'IDOR захист: агент отримує 403 якщо бронювання не його.',
        tags: ['Bookings'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = getCurrentUser(req);
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: {
          tour: {
            select: { id: true, code: true, name: true, departureDate: true, returnDate: true, basePrice: true },
          },
          contactTourist: {
            select: { id: true, firstName: true, lastName: true, phone: true, email: true },
          },
          participants: {
            include: {
              tourist: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          payments: {
            select: { id: true, amount: true, paymentType: true, status: true, paidAt: true },
          },
        },
      });

      if (!booking) throw Errors.notFound('Бронювання', req.params.id);

      // IDOR захист: агент може бачити тільки своє бронювання (TC-RBAC-011)
      if (user.role === UserRole.agent) {
        if (booking.agentId !== user.agentId) {
          throw Errors.forbidden('Доступ до чужого бронювання заборонено');
        }
      }

      // Турист бачить тільки своє
      if (user.role === UserRole.tourist) {
        // Перевірка через tourist profile — спрощена версія
        const isParticipant = booking.participants.some(
          (p) => p.tourist.id === user.sub
        );
        if (!isParticipant && booking.contactTourist?.id !== user.sub) {
          throw Errors.forbidden('Доступ заборонено');
        }
      }

      return reply.code(200).send({ data: booking });
    }
  );
}
