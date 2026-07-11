// =============================================================================
// EUROTRIPS — Room Structure Routes
// GET    /tours/:id/room-structure          [ops, manager, admin, logist]
// PUT    /tours/:id/room-structure          [ops, admin, logist]
// PATCH  /tours/:id/room-structure/approve  [admin, director]
// PATCH  /tours/:id/room-structure/finalize [ops, admin, logist]
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RoomStructureService } from './room-structure.service';
import {
  SetRoomStructureSchema,
  ApproveRoomStructureSchema,
  FinalizeRoomStructureSchema,
  type SetRoomStructureDto,
  type ApproveRoomStructureDto,
  type FinalizeRoomStructureDto,
} from './room-structure.schema';
import { requireAuth, getCurrentUser } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
} as const;

const HOTEL_BOOKING_BODY = {
  type: 'object',
  required: ['hotelBookingId'],
  properties: { hotelBookingId: { type: 'string', format: 'uuid' } },
} as const;

export async function roomStructureRoutes(app: FastifyInstance) {
  const service = new RoomStructureService();

  // ── GET /tours/:id/room-structure ───────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id/room-structure',
    {
      preHandler: [requireAuth, requireRoles('ops', 'manager', 'admin', 'director', 'logist')],
      schema: {
        summary: 'Структура номерів по готелях туру (OPS-01)',
        tags: ['Rooming'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const data = await service.getStructure(req.params.id);
      return reply.code(200).send({ data });
    }
  );

  // ── PUT /tours/:id/room-structure ───────────────────────────────────────────
  app.put<{ Params: { id: string }; Body: SetRoomStructureDto }>(
    '/:id/room-structure',
    {
      preHandler: [requireAuth, requireRoles('ops', 'admin', 'logist')],
      schema: {
        summary: 'Внести/оновити структуру номерів (OPS-01, BR-10)',
        description: 'Заблоковано після structureStatus=approved — окрім admin.',
        tags: ['Rooming'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
        body: {
          type: 'object',
          required: ['hotelBookingId'],
          properties: {
            hotelBookingId: { type: 'string', format: 'uuid' },
            plannedTwin: { type: 'number', minimum: 0 },
            plannedDouble: { type: 'number', minimum: 0 },
            plannedTriple: { type: 'number', minimum: 0 },
            plannedSingle: { type: 'number', minimum: 0 },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string }; Body: SetRoomStructureDto }>, reply: FastifyReply) => {
      const dto = SetRoomStructureSchema.parse(req.body);
      const user = getCurrentUser(req);
      const data = await service.setStructure(req.params.id, dto, user);
      return reply.code(200).send({ data });
    }
  );

  // ── PATCH /tours/:id/room-structure/approve ─────────────────────────────────
  app.patch<{ Params: { id: string }; Body: ApproveRoomStructureDto }>(
    '/:id/room-structure/approve',
    {
      preHandler: [requireAuth, requireRoles('admin', 'director')],
      schema: {
        summary: 'Затвердити структуру номерів: draft → approved',
        tags: ['Rooming'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
        body: HOTEL_BOOKING_BODY,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string }; Body: ApproveRoomStructureDto }>, reply: FastifyReply) => {
      const dto = ApproveRoomStructureSchema.parse(req.body);
      const user = getCurrentUser(req);
      const data = await service.approveStructure(req.params.id, dto, user);
      return reply.code(200).send({ data });
    }
  );

  // ── PATCH /tours/:id/room-structure/finalize ────────────────────────────────
  app.patch<{ Params: { id: string }; Body: FinalizeRoomStructureDto }>(
    '/:id/room-structure/finalize',
    {
      preHandler: [requireAuth, requireRoles('ops', 'admin', 'logist')],
      schema: {
        summary: 'Фіналізувати структуру номерів: approved → final',
        tags: ['Rooming'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
        body: HOTEL_BOOKING_BODY,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string }; Body: FinalizeRoomStructureDto }>, reply: FastifyReply) => {
      const dto = FinalizeRoomStructureSchema.parse(req.body);
      const user = getCurrentUser(req);
      const data = await service.finalizeStructure(req.params.id, dto, user);
      return reply.code(200).send({ data });
    }
  );
}
