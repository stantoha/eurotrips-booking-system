// =============================================================================
// EUROTRIPS — Hotel Bookings Routes
// GET   /tours/:id/hotels                  [ops, manager, admin, director]
// POST  /tours/:id/hotels                  [ops, admin]     — OPS-04
// PATCH /tours/:id/hotels/:hotelBookingId  [ops, admin]     — OPS-05/OPS-06
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { HotelBookingsService } from './hotel-bookings.service';
import {
  CreateHotelBookingSchema, PatchHotelBookingSchema,
  HOTEL_CONFIRMATION_STATUSES, HOTEL_DEPOSIT_STATUSES,
  type CreateHotelBookingDto, type PatchHotelBookingDto,
} from './hotel-bookings.schema';
import { requireAuth, getCurrentUser } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
} as const;

const HOTEL_ID_PARAMS = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    hotelBookingId: { type: 'string', format: 'uuid' },
  },
  required: ['id', 'hotelBookingId'],
} as const;

export async function hotelBookingsRoutes(app: FastifyInstance) {
  const service = new HotelBookingsService();

  // ── GET /tours/:id/hotels ─────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id/hotels',
    {
      preHandler: [requireAuth, requireRoles('ops', 'manager', 'admin', 'director')],
      schema: {
        summary: 'Готелі по маршруту туру (OPS-04..06)',
        tags: ['Hotels'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const data = await service.listHotelBookings(req.params.id);
      return reply.code(200).send({ data });
    }
  );

  // ── POST /tours/:id/hotels (OPS-04) ──────────────────────────────────────────
  app.post<{ Params: { id: string }; Body: CreateHotelBookingDto }>(
    '/:id/hotels',
    {
      preHandler: [requireAuth, requireRoles('ops', 'admin')],
      schema: {
        summary: 'Додати готель до маршруту виїзду (OPS-04)',
        description: 'hotelId з бази АБО hotelName вручну, якщо готелю немає в базі.',
        tags: ['Hotels'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
        body: {
          type: 'object',
          required: ['city', 'checkInDate', 'nightsCount'],
          properties: {
            hotelId: { type: 'string', format: 'uuid' },
            hotelName: { type: 'string' },
            hotelCity: { type: 'string' },
            hotelCountry: { type: 'string' },
            city: { type: 'string' },
            checkInDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            nightsCount: { type: 'number', minimum: 1 },
            priceTwin: { type: 'number', minimum: 0 }, qtyTwin: { type: 'number', minimum: 0 },
            priceDbl: { type: 'number', minimum: 0 }, qtyDbl: { type: 'number', minimum: 0 },
            priceTrpl: { type: 'number', minimum: 0 }, qtyTrpl: { type: 'number', minimum: 0 },
            priceSngl: { type: 'number', minimum: 0 }, qtySngl: { type: 'number', minimum: 0 },
            budgetPerNight: { type: 'number', minimum: 0 },
            optionDeadline: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string }; Body: CreateHotelBookingDto }>, reply: FastifyReply) => {
      const dto = CreateHotelBookingSchema.parse(req.body);
      const user = getCurrentUser(req);
      const data = await service.createHotelBooking(req.params.id, dto, user.sub);
      return reply.code(201).send({ data });
    }
  );

  // ── PATCH /tours/:id/hotels/:hotelBookingId (OPS-05/OPS-06) ──────────────────
  app.patch<{ Params: { id: string; hotelBookingId: string }; Body: PatchHotelBookingDto }>(
    '/:id/hotels/:hotelBookingId',
    {
      preHandler: [requireAuth, requireRoles('ops', 'admin')],
      schema: {
        summary: 'Оновити дедлайн опції / статус / депозит / фінал (OPS-05/06)',
        tags: ['Hotels'],
        security: [{ bearerAuth: [] }],
        params: HOTEL_ID_PARAMS,
        body: {
          type: 'object',
          properties: {
            optionDeadline: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            confirmationStatus: { type: 'string', enum: [...HOTEL_CONFIRMATION_STATUSES] },
            depositAmount: { type: 'number', minimum: 0 },
            depositStatus: { type: 'string', enum: [...HOTEL_DEPOSIT_STATUSES] },
            balanceAmount: { type: 'number', minimum: 0 },
            factAmountEur: { type: 'number', minimum: 0 },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (
      req: FastifyRequest<{ Params: { id: string; hotelBookingId: string }; Body: PatchHotelBookingDto }>,
      reply: FastifyReply
    ) => {
      const dto = PatchHotelBookingSchema.parse(req.body);
      const user = getCurrentUser(req);
      const data = await service.patchHotelBooking(req.params.id, req.params.hotelBookingId, dto, user.sub);
      return reply.code(200).send({ data });
    }
  );
}
