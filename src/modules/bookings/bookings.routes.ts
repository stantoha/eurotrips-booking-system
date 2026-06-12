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
  type BookingListQueryDto, type CreateBookingDto,
  type ChangeStatusDto, type AddPaymentDto, type CancelBookingDto,
} from './bookings.schema';
import { requireAuth } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';
import { getCurrentUser } from '../../shared/guards/jwt.guard';

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
