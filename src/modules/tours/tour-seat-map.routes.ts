// =============================================================================
// EUROTRIPS — Tour-scoped Seat Map Routes (OPS-17)
// GET   /tours/:id/seat-map                    [ops, manager, admin, director, tourist]
// PATCH /tours/:id/tourist/:touristId/seat      [ops, admin]
//
// Доповнює booking-scoped /bookings/:id/seat-map (BR-12) точкою входу
// напряму з картки туру — без потреби знати конкретний bookingId.
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { SeatMapService } from '../bookings/seat-map.service';
import { requireAuth, getCurrentUser } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
} as const;

const AssignSeatSchema = z.object({
  seatNumber: z.number().int().min(1).nullable(),
});

export async function tourSeatMapRoutes(app: FastifyInstance) {
  const service = new SeatMapService();

  app.get<{ Params: { id: string } }>(
    '/:id/seat-map',
    {
      preHandler: [requireAuth, requireRoles('tourist', 'manager', 'ops', 'admin', 'director')],
      schema: {
        summary: 'Схема автобуса туру (OPS-17, без прив\'язки до booking)',
        tags: ['Rooming'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = getCurrentUser(req);
      const data = await service.getSeatMapByTour(req.params.id, user);
      return reply.code(200).send({ data });
    }
  );

  app.patch<{ Params: { id: string; touristId: string }; Body: { seatNumber: number | null } }>(
    '/:id/tourist/:touristId/seat',
    {
      preHandler: [requireAuth, requireRoles('ops', 'admin')],
      schema: {
        summary: 'Призначити місце в автобусі туристу (OPS-17)',
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
          required: ['seatNumber'],
          properties: { seatNumber: { type: ['number', 'null'] } },
        },
      },
    },
    async (
      req: FastifyRequest<{ Params: { id: string; touristId: string }; Body: { seatNumber: number | null } }>,
      reply: FastifyReply
    ) => {
      const dto = AssignSeatSchema.parse(req.body);
      const data = await service.assignSeatByTourist(req.params.id, req.params.touristId, dto.seatNumber);
      return reply.code(200).send({ data });
    }
  );
}
