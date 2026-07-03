// =============================================================================
// EUROTRIPS — Bookings Routes (повна реалізація)
// GET    /bookings                — список (RBAC)
// GET    /bookings/:id            — деталі + учасники (IDOR)
// POST   /bookings                — створити (BR-01)
// PATCH  /bookings/:id/status     — зміна статусу (BR-06)
// POST   /bookings/:id/payment    — платіж
// POST   /bookings/:id/cancel     — скасування (BR-08)
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BookingsService } from './bookings.service';
import {
  BookingListQuerySchema, CreateBookingSchema,
  ChangeBookingStatusSchema, AddPaymentSchema, CancelBookingSchema,
  UpdateTouristPreferencesSchema,
  type BookingListQueryDto, type CreateBookingDto,
  type ChangeStatusDto, type AddPaymentDto, type CancelBookingDto,
  type UpdateTouristPreferencesDto,
} from './bookings.schema';
import { requireAuth } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';
import { getCurrentUser } from '../../shared/guards/jwt.guard';
import { z } from 'zod';
import prisma from '../../shared/database/prisma';

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
} as const;

export async function bookingRoutes(app: FastifyInstance) {
  const service = new BookingsService();

  // ── GET /bookings ──────────────────────────────────────────────────────────
  app.get('/', {
    preHandler: [requireAuth],
    schema: {
      summary: 'Список бронювань',
      description: 'Агент → тільки свої. Менеджер/адмін → всі. TC-RBAC-009/010.',
      tags: ['Bookings'], security: [{ bearerAuth: [] }],
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = BookingListQuerySchema.parse(req.query);
    const user  = getCurrentUser(req);
    return reply.send(await service.listBookings(query, user));
  });

  // ── GET /bookings/:id ──────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/:id', {
    preHandler: [requireAuth],
    schema: {
      summary: 'Деталь бронювання (учасники, платежі, комісія)',
      tags: ['Bookings'], security: [{ bearerAuth: [] }], params: ID_PARAM,
    },
  }, async (req, reply) => {
    const user = getCurrentUser(req);
    return reply.send({ data: await service.getBookingById(req.params.id, user) });
  });

  // ── POST /bookings ─────────────────────────────────────────────────────────
  app.post<{ Body: CreateBookingDto }>('/', {
    preHandler: [requireAuth, requireRoles('admin', 'manager', 'agent')],
    schema: {
      summary: 'Створити бронювання',
      description: 'BR-01: atomic seat decrement. BR-02: комісія від basePrice.',
      tags: ['Bookings'], security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const dto  = CreateBookingSchema.parse(req.body);
    const user = getCurrentUser(req);
    const booking = await service.createBooking(dto, user);
    return reply.code(201).send({ data: booking });
  });

  // ── PATCH /bookings/:id/status (BR-06) ─────────────────────────────────────
  app.patch<{ Params: { id: string }; Body: ChangeStatusDto }>('/:id/status', {
    preHandler: [requireAuth, requireRoles('admin', 'manager', 'ops', 'agent')],
    schema: {
      summary: 'Змінити статус бронювання (BR-06 state machine)',
      description: 'Дозволені переходи перевіряються за BOOKING_STATUS_TRANSITIONS.',
      tags: ['Bookings'], security: [{ bearerAuth: [] }], params: ID_PARAM,
      body: {
        type: 'object', required: ['status'],
        properties: {
          status: { type: 'string', enum: [
            'new','in_work','needs_clarification','pre_booked','awaiting_payment',
            'partially_paid','confirmed','docs_collected','ready_to_depart',
            'on_trip','completed','cancelled_client','cancelled_operator','no_show','refund',
          ]},
          reason: { type: 'string', maxLength: 500 },
        },
      },
    },
  }, async (req, reply) => {
    const dto  = ChangeBookingStatusSchema.parse(req.body);
    const user = getCurrentUser(req);
    return reply.send({ data: await service.changeStatus(req.params.id, dto, user) });
  });

  // ── POST /bookings/:id/payment ─────────────────────────────────────────────
  app.post<{ Params: { id: string }; Body: AddPaymentDto }>('/:id/payment', {
    preHandler: [requireAuth, requireRoles('admin', 'manager', 'accountant')],
    schema: {
      summary: 'Прийняти платіж (депозит / доплата)',
      description: 'Автоматично оновлює depositPaid, balancePaid, paymentStatus та статус бронювання.',
      tags: ['Bookings'], security: [{ bearerAuth: [] }], params: ID_PARAM,
    },
  }, async (req, reply) => {
    const dto  = AddPaymentSchema.parse(req.body);
    const user = getCurrentUser(req);
    return reply.code(201).send({ data: await service.addPayment(req.params.id, dto, user) });
  });

  // ── GET /bookings/:id/insurance (ADR-003 INS-01) ───────────────────────────
  app.get<{ Params: { id: string } }>('/:id/insurance', {
    preHandler: [requireAuth, requireRoles('admin', 'manager', 'ops', 'tourist')],
    schema: {
      summary: 'Страховки по бронюванню (ADR-003)',
      description: 'RBAC: ops, manager, admin, турист (тільки власне бронювання).',
      tags: ['Bookings'], security: [{ bearerAuth: [] }], params: ID_PARAM,
    },
  }, async (req, reply) => {
    const user = getCurrentUser(req);
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      select: { id: true, contactTouristId: true, participants: { select: { touristId: true } } },
    });
    if (!booking) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Бронювання не знайдено' } });

    if (user.role === 'tourist') {
      const isOwner = booking.contactTouristId === user.touristId ||
        booking.participants.some((p) => p.touristId === user.touristId);
      if (!isOwner) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Доступ до чужого бронювання заборонено' } });
      }
    }

    const insurances = await prisma.touristInsurance.findMany({
      where: { bookingId: req.params.id },
      include: { tourist: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ data: insurances });
  });

  // ── GET /bookings/:id/seat-map (OPS-03) ─────────────────────────────────────
  app.get<{ Params: { id: string } }>('/:id/seat-map', {
    preHandler: [requireAuth, requireRoles('admin', 'director', 'manager', 'ops', 'tourist')],
    schema: {
      summary: 'Схема місць в автобусі (OPS-03)',
      description: 'Турист бачить лише is_occupied/is_mine, без чужих даних.',
      tags: ['Bookings'], security: [{ bearerAuth: [] }], params: ID_PARAM,
    },
  }, async (req, reply) => {
    const user = getCurrentUser(req);
    return reply.send({ data: await service.getSeatMap(req.params.id, user) });
  });

  // ── PATCH /bookings/:id/tourist/:touristId/preferences (BR-12/OPS-03) ──────
  const PREFERENCES_PARAMS = {
    type: 'object',
    properties: {
      id:        { type: 'string', format: 'uuid' },
      touristId: { type: 'string', format: 'uuid' },
    },
    required: ['id', 'touristId'],
  } as const;
  app.patch<{ Params: { id: string; touristId: string }; Body: UpdateTouristPreferencesDto }>(
    '/:id/tourist/:touristId/preferences',
    {
      preHandler: [requireAuth, requireRoles('tourist', 'manager', 'ops', 'admin')],
      schema: {
        summary: 'Self-service побажання туриста: місце, тип номеру (BR-12/OPS-03)',
        tags: ['Bookings'], security: [{ bearerAuth: [] }], params: PREFERENCES_PARAMS,
      },
    },
    async (req, reply) => {
      const dto  = UpdateTouristPreferencesSchema.parse(req.body);
      const user = getCurrentUser(req);
      return reply.send({
        data: await service.updateTouristPreferences(req.params.id, req.params.touristId, dto, user),
      });
    }
  );

  // ── POST /bookings/:id/insurance (ADR-003 INS-01) ──────────────────────────
  const AddInsuranceSchema = z.object({
    touristId:        z.string().uuid(),
    insurer:          z.string().min(1).max(100),
    insuranceType:    z.string().min(1).max(50),
    coverageAmount:   z.number().positive(),
    coverageCurrency: z.string().length(3).default('USD'),
    startDate:        z.string().datetime(),
    endDate:          z.string().datetime(),
    costEur:          z.number().positive(),
    policyNumber:     z.string().max(50).optional(),
  });
  app.post<{ Params: { id: string } }>('/:id/insurance', {
    preHandler: [requireAuth, requireRoles('admin', 'manager', 'ops')],
    schema: {
      summary: 'Додати страхування туристу (ADR-003 INS-01)',
      tags: ['Bookings'], security: [{ bearerAuth: [] }], params: ID_PARAM,
    },
  }, async (req, reply) => {
    const body = AddInsuranceSchema.parse(req.body);
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Бронювання не знайдено' } });
    const insurance = await prisma.touristInsurance.create({
      data: {
        bookingId:        req.params.id,
        touristId:        body.touristId,
        insurer:          body.insurer,
        insuranceType:    body.insuranceType,
        coverageAmount:   body.coverageAmount,
        coverageCurrency: body.coverageCurrency,
        startDate:        new Date(body.startDate),
        endDate:          new Date(body.endDate),
        costEur:          body.costEur,
        policyNumber:     body.policyNumber,
        status:           'active',
      },
    });
    return reply.code(201).send({ data: insurance });
  });

  // ── PATCH /bookings/:id/insurance/:insuranceId (ADR-003 INS-03) ────────────
  const INSURANCE_ID_PARAMS = {
    type: 'object',
    properties: {
      id:          { type: 'string', format: 'uuid' },
      insuranceId: { type: 'string', format: 'uuid' },
    },
    required: ['id', 'insuranceId'],
  } as const;
  const PatchInsuranceSchema = z.object({
    status:       z.enum(['active', 'confirmed', 'cancelled']).optional(),
    policyNumber: z.string().max(50).optional(),
    documentPath: z.string().optional(),
  });
  app.patch<{ Params: { id: string; insuranceId: string } }>('/:id/insurance/:insuranceId', {
    preHandler: [requireAuth, requireRoles('admin', 'manager', 'ops')],
    schema: {
      summary: 'Оновити страховку (ADR-003 INS-03)',
      tags: ['Bookings'], security: [{ bearerAuth: [] }], params: INSURANCE_ID_PARAMS,
    },
  }, async (req, reply) => {
    const body = PatchInsuranceSchema.parse(req.body);
    const existing = await prisma.touristInsurance.findFirst({
      where: { id: req.params.insuranceId, bookingId: req.params.id },
    });
    if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Страховку не знайдено' } });
    const updated = await prisma.touristInsurance.update({
      where: { id: req.params.insuranceId },
      data: {
        ...(body.status       !== undefined && { status:       body.status }),
        ...(body.policyNumber !== undefined && { policyNumber: body.policyNumber }),
        ...(body.documentPath !== undefined && { documentPath: body.documentPath }),
      },
    });
    return reply.send({ data: updated });
  });

  // ── POST /bookings/:id/cancel (BR-08) ──────────────────────────────────────
  app.post<{ Params: { id: string }; Body: CancelBookingDto }>('/:id/cancel', {
    preHandler: [requireAuth, requireRoles('admin', 'manager', 'agent')],
    schema: {
      summary: 'Скасувати бронювання (BR-08)',
      description: 'BR-08: оператор → повне повернення; клієнт → штраф з cancellation_policy.',
      tags: ['Bookings'], security: [{ bearerAuth: [] }], params: ID_PARAM,
      body: {
        type: 'object', required: ['cancelType', 'reason'],
        properties: {
          cancelType: { type: 'string', enum: ['client', 'operator'] },
          reason:     { type: 'string', minLength: 3, maxLength: 1000 },
        },
      },
    },
  }, async (req, reply) => {
    const dto  = CancelBookingSchema.parse(req.body);
    const user = getCurrentUser(req);
    return reply.send({ data: await service.cancelBooking(req.params.id, dto, user) });
  });
}
