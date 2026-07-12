// =============================================================================
// EUROTRIPS — Tours Routes
// GET    /api/v1/tours
// GET    /api/v1/tours/:id
// GET    /api/v1/tours/:id/availability
// POST   /api/v1/tours               [admin, ops, product_manager]
// PUT    /api/v1/tours/:id           [admin, ops, product_manager]
// PATCH  /api/v1/tours/:id/status    [admin, ops, director, product_manager]
// DELETE /api/v1/tours/:id/archive   [admin, product_manager]
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ToursService } from './tours.service';
import {
  TourListQuerySchema,
  CreateTourSchema,
  CreateDepartureSchema,
  UpdateTourSchema,
  ChangeStatusSchema,
  type TourListQueryDto,
  type CreateTourDto,
  type CreateDepartureDto,
  type UpdateTourDto,
  type ChangeStatusDto,
} from './tours.schema';
import { requireAuth } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';
import { getCurrentUser } from '../../shared/guards/jwt.guard';
import type { JwtPayload } from '../auth/auth.types';

export async function tourRoutes(app: FastifyInstance) {
  const service = new ToursService();

  // ── GET /tours ─────────────────────────────────────────────────────────
  app.get<{ Querystring: TourListQueryDto }>(
    '/',
    {
      preHandler: [requireAuth],
      schema: {
        summary: 'Список турів',
        description: 'Повертає список турів з фільтрами. Агенти та туристи НЕ бачать costPrice (BR-04).',
        tags: ['Tours'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            status:           { type: 'string', enum: ['draft','open','active','almost_full','closed','on_tour','completed','cancelled'] },
            tourType:         { type: 'string', enum: ['bus','avia','combined'] },
            departureDateFrom:{ type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            departureDateTo:  { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            product:          { type: 'string' },
            direction:        { type: 'string' },
            departureCity:    { type: 'string' },
            tags:             { type: 'string', description: 'Через кому: family,premium' },
            availableOnly:    { type: 'string', enum: ['true', 'false'] },
            page:             { type: 'string', default: '1' },
            limit:            { type: 'string', default: '20' },
            sortBy:           { type: 'string', enum: ['departureDate','basePrice','availableSeats','createdAt'] },
            sortOrder:        { type: 'string', enum: ['asc','desc'] },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Querystring: TourListQueryDto }>, reply: FastifyReply) => {
      const query = TourListQuerySchema.parse(req.query);
      const user = getCurrentUser(req);
      const result = await service.listTours(query, user);
      return reply.code(200).send(result);
    }
  );

  // ── GET /tours/:id ─────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [requireAuth],
      schema: {
        summary: 'Деталь туру',
        description: 'Повна інформація по туру. costPrice повертається тільки для admin/manager/ops/accountant/director (BR-04).',
        tags: ['Tours'],
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
      const tour = await service.getTourById(req.params.id, user);
      return reply.code(200).send({ data: tour });
    }
  );

  // ── GET /tours/:id/availability ────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id/availability',
    {
      preHandler: [requireAuth],
      schema: {
        summary: 'Доступність місць у турі',
        description: 'Повертає кількість вільних/зайнятих місць, відсоток заповненості та статус доступності.',
        tags: ['Tours'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const availability = await service.checkAvailability(req.params.id);
      return reply.code(200).send({ data: availability });
    }
  );

  // ── POST /tours ────────────────────────────────────────────────────────
  app.post<{ Body: CreateTourDto }>(
    '/',
    {
      preHandler: [requireAuth, requireRoles('admin', 'ops', 'product_manager')],
      schema: {
        summary: 'Створити тур',
        tags: ['Tours'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (req: FastifyRequest<{ Body: CreateTourDto }>, reply: FastifyReply) => {
      const dto = CreateTourSchema.parse(req.body);
      const user = getCurrentUser(req);
      const { tour, warnings } = await service.createTour(dto, user.sub);
      return reply.code(201).send({
        data: tour,
        ...(warnings.length > 0 && { meta: { warnings } }),
      });
    }
  );

  // ── POST /tours/:id/departures ─────────────────────────────────────────
  app.post<{ Params: { id: string }; Body: CreateDepartureDto }>(
    '/:id/departures',
    {
      preHandler: [requireAuth, requireRoles('admin', 'ops', 'product_manager')],
      schema: {
        summary: 'Створити новий виїзд на базі туру (ADR-003: Tour = Departure)',
        description: 'Копіює тур-шаблон з новою датою виїзду. Код генерується автоматично за §8 ([PREFIX][YYMMDD][SEQ]), returnDate = departureDate + durationDays - 1, статус draft, всі місця вільні.',
        tags: ['Tours'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['departureDate'],
          properties: {
            departureDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            totalSeats: { type: 'number', minimum: 1, maximum: 500 },
            basePrice: { type: 'number', exclusiveMinimum: 0 },
            costPrice: { type: 'number', exclusiveMinimum: 0 },
            agentCommissionPct: { type: 'number', minimum: 0, maximum: 1 },
            guideId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string }; Body: CreateDepartureDto }>, reply: FastifyReply) => {
      const dto = CreateDepartureSchema.parse(req.body);
      const user = getCurrentUser(req);
      const { tour, warnings } = await service.createDeparture(req.params.id, dto, user.sub);
      return reply.code(201).send({
        data: tour,
        ...(warnings.length > 0 && { meta: { warnings } }),
      });
    }
  );

  // ── PUT /tours/:id ─────────────────────────────────────────────────────
  app.put<{ Params: { id: string }; Body: UpdateTourDto }>(
    '/:id',
    {
      preHandler: [requireAuth, requireRoles('admin', 'ops', 'product_manager')],
      schema: {
        summary: 'Редагувати тур',
        description: 'Не можна редагувати тур зі статусом completed або cancelled.',
        tags: ['Tours'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
      },
    },
    async (
      req: FastifyRequest<{ Params: { id: string }; Body: UpdateTourDto }>,
      reply: FastifyReply
    ) => {
      const dto = UpdateTourSchema.parse(req.body);
      const user = getCurrentUser(req);
      const { tour, warnings } = await service.updateTour(req.params.id, dto, user.sub);
      return reply.code(200).send({
        data: tour,
        ...(warnings.length > 0 && { meta: { warnings } }),
      });
    }
  );

  // ── PATCH /tours/:id/status ────────────────────────────────────────────
  app.patch<{ Params: { id: string }; Body: ChangeStatusDto }>(
    '/:id/status',
    {
      preHandler: [requireAuth, requireRoles('admin', 'ops', 'director', 'product_manager')],
      schema: {
        summary: 'Змінити статус туру',
        description: `Дозволені переходи:
          draft→open, open→active|cancelled,
          active→almost_full|closed|cancelled,
          almost_full→active|closed|cancelled,
          closed→on_tour|cancelled, on_tour→completed.
          OPS-01: тур не може перейти в open без затвердженої структури номерів.`,
        tags: ['Tours'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: ['draft','open','active','almost_full','closed','on_tour','completed','cancelled'],
            },
            reason: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (
      req: FastifyRequest<{ Params: { id: string }; Body: ChangeStatusDto }>,
      reply: FastifyReply
    ) => {
      const dto = ChangeStatusSchema.parse(req.body);
      const user = getCurrentUser(req);
      const tour = await service.changeTourStatus(req.params.id, dto, user.sub);
      return reply.code(200).send({ data: tour });
    }
  );

  // ── DELETE /tours/:id/archive ──────────────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/:id/archive',
    {
      preHandler: [requireAuth, requireRoles('admin', 'product_manager')],
      schema: {
        summary: 'Архівувати тур (soft delete)',
        tags: ['Tours'],
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
      await service.archiveTour(req.params.id, user.sub);
      return reply.code(200).send({ data: { message: 'Тур успішно архівовано' } });
    }
  );
}
