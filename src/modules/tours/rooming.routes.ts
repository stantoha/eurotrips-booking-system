// =============================================================================
// EUROTRIPS — Rooming Routes (факт-розселення)
// PATCH /tours/:id/tourist/:touristId/room            [ops, admin]  — OPS-14/15
// PATCH /tours/:id/hotels/:hotelBookingId/finalize-rooming [ops, admin] — OPS-16
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RoomingService } from './rooming.service';
import { AssignRoomSchema, type AssignRoomDto } from './rooming.schema';
import { requireAuth, getCurrentUser } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

export async function roomingRoutes(app: FastifyInstance) {
  const service = new RoomingService();

  // ── PATCH /tours/:id/tourist/:touristId/room (OPS-14/15) ─────────────────────
  app.patch<{ Params: { id: string; touristId: string }; Body: AssignRoomDto }>(
    '/:id/tourist/:touristId/room',
    {
      preHandler: [requireAuth, requireRoles('ops', 'admin', 'logist')],
      schema: {
        summary: 'Призначити кімнату та харчування туристу (OPS-14/15)',
        tags: ['Rooming'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            touristId: { type: 'string', format: 'uuid' },
          },
          required: ['id', 'touristId'],
        },
        body: {
          type: 'object',
          required: ['actualRoomNumber'],
          properties: {
            actualRoomNumber: { type: ['string', 'null'] },
            actualRoomType: { type: ['string', 'null'], enum: ['twin', 'double', 'triple', 'single', 'no_preference', null] },
            mealType: { type: ['string', 'null'], enum: ['RO', 'BB', 'HB', 'FB', null] },
            roommatePreference: { type: 'string' },
          },
        },
      },
    },
    async (
      req: FastifyRequest<{ Params: { id: string; touristId: string }; Body: AssignRoomDto }>,
      reply: FastifyReply
    ) => {
      const dto = AssignRoomSchema.parse(req.body);
      const user = getCurrentUser(req);
      const data = await service.assignRoom(req.params.id, req.params.touristId, dto, user.sub);
      return reply.code(200).send({ data });
    }
  );

  // ── PATCH /tours/:id/hotels/:hotelBookingId/finalize-rooming (OPS-16) ────────
  app.patch<{ Params: { id: string; hotelBookingId: string } }>(
    '/:id/hotels/:hotelBookingId/finalize-rooming',
    {
      preHandler: [requireAuth, requireRoles('ops', 'admin', 'logist')],
      schema: {
        summary: 'Фіналізувати румінг для готелю (OPS-16, блокує self-service BR-12)',
        tags: ['Rooming'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            hotelBookingId: { type: 'string', format: 'uuid' },
          },
          required: ['id', 'hotelBookingId'],
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string; hotelBookingId: string } }>, reply: FastifyReply) => {
      const user = getCurrentUser(req);
      const data = await service.finalizeRooming(req.params.id, req.params.hotelBookingId, user.sub);
      return reply.code(200).send({ data });
    }
  );
}
