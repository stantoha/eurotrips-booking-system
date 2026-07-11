// =============================================================================
// EUROTRIPS — Transport Booking Routes
// GET   /tours/:id/transport                [ops, manager, admin, director, logist]
// POST  /tours/:id/transport                [ops, admin, logist]     — OPS-08
// PATCH /tours/:id/transport/:transportId   [ops, admin, logist]     — OPS-09/OPS-10
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TransportService } from './transport.service';
import {
  CreateTransportSchema, PatchTransportSchema, TRANSPORT_STATUSES,
  type CreateTransportDto, type PatchTransportDto,
} from './transport.schema';
import { requireAuth, getCurrentUser } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
} as const;

const TRANSPORT_ID_PARAMS = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    transportId: { type: 'string', format: 'uuid' },
  },
  required: ['id', 'transportId'],
} as const;

export async function transportRoutes(app: FastifyInstance) {
  const service = new TransportService();

  // ── GET /tours/:id/transport ─────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id/transport',
    {
      preHandler: [requireAuth, requireRoles('ops', 'manager', 'admin', 'director', 'logist')],
      schema: {
        summary: 'Транспортні бронювання туру з авторозрахунком вартості (OPS-09)',
        tags: ['Transport'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const data = await service.listTransport(req.params.id);
      return reply.code(200).send({ data });
    }
  );

  // ── POST /tours/:id/transport (OPS-08) ───────────────────────────────────────
  app.post<{ Params: { id: string }; Body: CreateTransportDto }>(
    '/:id/transport',
    {
      preHandler: [requireAuth, requireRoles('ops', 'admin', 'logist')],
      schema: {
        summary: 'Зареєструвати перевізника і маршрут (OPS-08)',
        tags: ['Transport'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
        body: {
          type: 'object',
          required: ['transportType'],
          properties: {
            transportType: { type: 'string' },
            connectionType: { type: 'string' },
            carrierName: { type: 'string' },
            busBrand: { type: 'string' },
            departureDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            returnDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            kmGoogle: { type: 'number', minimum: 0 },
            kmExtras: { type: 'number', minimum: 0 },
            ratePerKm: { type: 'number', minimum: 0 },
            fuelSurcharge: { type: 'number', minimum: 0 },
            wifiOrDeliveryFee: { type: 'number', minimum: 0 },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string }; Body: CreateTransportDto }>, reply: FastifyReply) => {
      const dto = CreateTransportSchema.parse(req.body);
      const user = getCurrentUser(req);
      const data = await service.createTransport(req.params.id, dto, user.sub);
      return reply.code(201).send({ data });
    }
  );

  // ── PATCH /tours/:id/transport/:transportId (OPS-09/OPS-10) ──────────────────
  app.patch<{ Params: { id: string; transportId: string }; Body: PatchTransportDto }>(
    '/:id/transport/:transportId',
    {
      preHandler: [requireAuth, requireRoles('ops', 'admin', 'logist')],
      schema: {
        summary: 'Оновити транспорт: км/тариф/пальне, підтвердження, аванс (OPS-09/10)',
        tags: ['Transport'],
        security: [{ bearerAuth: [] }],
        params: TRANSPORT_ID_PARAMS,
        body: {
          type: 'object',
          properties: {
            transportType: { type: 'string' },
            connectionType: { type: 'string' },
            carrierName: { type: 'string' },
            busBrand: { type: 'string' },
            carrierId: { type: 'string', format: 'uuid' },
            busId: { type: 'string', format: 'uuid' },
            departureDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            returnDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            kmGoogle: { type: 'number', minimum: 0 },
            kmExtras: { type: 'number', minimum: 0 },
            ratePerKm: { type: 'number', minimum: 0 },
            fuelSurcharge: { type: 'number', minimum: 0 },
            wifiOrDeliveryFee: { type: 'number', minimum: 0 },
            paidAdvanceEur: { type: 'number', minimum: 0 },
            paidCashEur: { type: 'number', minimum: 0 },
            status: { type: 'string', enum: [...TRANSPORT_STATUSES] },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (
      req: FastifyRequest<{ Params: { id: string; transportId: string }; Body: PatchTransportDto }>,
      reply: FastifyReply
    ) => {
      const dto = PatchTransportSchema.parse(req.body);
      const user = getCurrentUser(req);
      const data = await service.patchTransport(req.params.id, req.params.transportId, dto, user.sub);
      return reply.code(200).send({ data });
    }
  );
}
