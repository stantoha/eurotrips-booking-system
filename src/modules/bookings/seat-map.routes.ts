// =============================================================================
// EUROTRIPS — Seat Map & Preferences Routes
// GET   /bookings/:id/seat-map                       [tourist, manager, ops, admin]
// PATCH /bookings/:id/tourist/:tId/preferences (BR-12) [manager, ops, admin]
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SeatMapService } from './seat-map.service';
import { PatchPreferencesSchema, type PatchPreferencesDto } from './seat-map.schema';
import { requireAuth, getCurrentUser } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

export async function seatMapRoutes(app: FastifyInstance) {
  const service = new SeatMapService();

  // ── GET /bookings/:id/seat-map ────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id/seat-map',
    {
      preHandler: [requireAuth, requireRoles('tourist', 'manager', 'ops', 'admin')],
      schema: {
        summary: 'Схема автобуса туру (CLAUDE.md розділ 6)',
        description: 'Турист бачить тільки is_occupied, без імен.',
        tags: ['Rooming'],
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
      const data = await service.getSeatMap(req.params.id, user);
      return reply.code(200).send({ data });
    }
  );

  // ── PATCH /bookings/:id/tourist/:tId/preferences (BR-12) ────────────────────
  app.patch<{ Params: { id: string; tId: string }; Body: PatchPreferencesDto }>(
    '/:id/tourist/:tId/preferences',
    {
      // 'tourist' навмисно виключено — див. коментар у seat-map.service.ts
      preHandler: [requireAuth, requireRoles('manager', 'ops', 'admin')],
      schema: {
        summary: 'Побажання туриста: тип номеру + місце в автобусі (BR-12)',
        tags: ['Rooming'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tId: { type: 'string', format: 'uuid' },
          },
          required: ['id', 'tId'],
        },
        body: {
          type: 'object',
          properties: {
            preferredRoomType: { type: 'string', enum: ['twin', 'double', 'triple', 'single', 'no_preference'] },
            busSeaNumber: { type: ['number', 'null'] },
            roommatePreference: { type: 'string', maxLength: 1000 },
          },
        },
      },
    },
    async (
      req: FastifyRequest<{ Params: { id: string; tId: string }; Body: PatchPreferencesDto }>,
      reply: FastifyReply
    ) => {
      const dto = PatchPreferencesSchema.parse(req.body);
      const user = getCurrentUser(req);
      const result = await service.setPreferences(req.params.id, req.params.tId, dto, user);
      return reply.code(200).send({ data: result });
    }
  );
}
