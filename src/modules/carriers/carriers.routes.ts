// =============================================================================
// EUROTRIPS — Carriers/Buses Routes
// GET    /carriers               [admin, logist]
// GET    /carriers/:id           [admin, logist]
// POST   /carriers               [admin, logist]
// PATCH  /carriers/:id           [admin, logist]
// GET    /carriers/:id/buses     [admin, logist]
// POST   /carriers/:id/buses     [admin, logist]
// PATCH  /buses/:id              [admin, logist]
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CarriersService } from './carriers.service';
import {
  CarrierListQuerySchema, CreateCarrierSchema, PatchCarrierSchema,
  CreateBusSchema, PatchBusSchema,
  type CarrierListQueryDto, type CreateCarrierDto, type PatchCarrierDto,
  type CreateBusDto, type PatchBusDto,
} from './carriers.schema';
import { requireAuth } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

const CARRIER_ROLES_ACCESS = ['admin', 'logist'] as const;

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
} as const;

export async function carriersRoutes(app: FastifyInstance) {
  const service = new CarriersService();

  // ── GET /carriers ─────────────────────────────────────────────────────────
  app.get<{ Querystring: CarrierListQueryDto }>(
    '/',
    {
      preHandler: [requireAuth, requireRoles(...CARRIER_ROLES_ACCESS)],
      schema: {
        summary: 'Список перевізників (з автобусами)',
        tags: ['Carriers'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string' },
            status: { type: 'string' },
            page: { type: 'string', default: '1' },
            limit: { type: 'string', default: '20' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Querystring: CarrierListQueryDto }>, reply: FastifyReply) => {
      const query = CarrierListQuerySchema.parse(req.query);
      const result = await service.listCarriers(query);
      return reply.code(200).send(result);
    }
  );

  // ── GET /carriers/:id ────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [requireAuth, requireRoles(...CARRIER_ROLES_ACCESS)],
      schema: {
        summary: 'Перевізник за ID',
        tags: ['Carriers'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const carrier = await service.getCarrier(req.params.id);
      return reply.code(200).send({ data: carrier });
    }
  );

  // ── POST /carriers ───────────────────────────────────────────────────────
  app.post<{ Body: CreateCarrierDto }>(
    '/',
    {
      preHandler: [requireAuth, requireRoles(...CARRIER_ROLES_ACCESS)],
      schema: {
        summary: 'Додати перевізника',
        tags: ['Carriers'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            contactName: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Body: CreateCarrierDto }>, reply: FastifyReply) => {
      const dto = CreateCarrierSchema.parse(req.body);
      const carrier = await service.createCarrier(dto);
      return reply.code(201).send({ data: carrier });
    }
  );

  // ── PATCH /carriers/:id ──────────────────────────────────────────────────
  app.patch<{ Params: { id: string }; Body: PatchCarrierDto }>(
    '/:id',
    {
      preHandler: [requireAuth, requireRoles(...CARRIER_ROLES_ACCESS)],
      schema: {
        summary: 'Оновити перевізника (soft-delete через status=inactive)',
        tags: ['Carriers'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            contactName: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            status: { type: 'string', enum: ['active', 'inactive'] },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string }; Body: PatchCarrierDto }>, reply: FastifyReply) => {
      const dto = PatchCarrierSchema.parse(req.body);
      const carrier = await service.patchCarrier(req.params.id, dto);
      return reply.code(200).send({ data: carrier });
    }
  );

  // ── GET /carriers/:id/buses ──────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id/buses',
    {
      preHandler: [requireAuth, requireRoles(...CARRIER_ROLES_ACCESS)],
      schema: {
        summary: 'Автобуси перевізника',
        tags: ['Carriers'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const buses = await service.listBuses(req.params.id);
      return reply.code(200).send({ data: buses });
    }
  );

  // ── POST /carriers/:id/buses ─────────────────────────────────────────────
  app.post<{ Params: { id: string }; Body: CreateBusDto }>(
    '/:id/buses',
    {
      preHandler: [requireAuth, requireRoles(...CARRIER_ROLES_ACCESS)],
      schema: {
        summary: 'Додати автобус перевізнику',
        tags: ['Carriers'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
        body: {
          type: 'object',
          required: ['brand', 'plateNumber', 'seatsCount'],
          properties: {
            brand: { type: 'string' },
            plateNumber: { type: 'string' },
            seatsCount: { type: 'number', minimum: 1 },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string }; Body: CreateBusDto }>, reply: FastifyReply) => {
      const dto = CreateBusSchema.parse(req.body);
      const bus = await service.createBus(req.params.id, dto);
      return reply.code(201).send({ data: bus });
    }
  );
}

// ── PATCH /buses/:id (окремий top-level роут, реєструється без /carriers префіксу) ──
export async function busesRoutes(app: FastifyInstance) {
  const service = new CarriersService();

  app.patch<{ Params: { id: string }; Body: PatchBusDto }>(
    '/:id',
    {
      preHandler: [requireAuth, requireRoles(...CARRIER_ROLES_ACCESS)],
      schema: {
        summary: 'Оновити автобус (soft-delete через status=inactive)',
        tags: ['Carriers'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
        body: {
          type: 'object',
          properties: {
            brand: { type: 'string' },
            plateNumber: { type: 'string' },
            seatsCount: { type: 'number', minimum: 1 },
            status: { type: 'string', enum: ['active', 'inactive'] },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string }; Body: PatchBusDto }>, reply: FastifyReply) => {
      const dto = PatchBusSchema.parse(req.body);
      const bus = await service.patchBus(req.params.id, dto);
      return reply.code(200).send({ data: bus });
    }
  );
}
