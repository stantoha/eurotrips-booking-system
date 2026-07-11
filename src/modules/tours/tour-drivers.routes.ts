// =============================================================================
// EUROTRIPS — Tour Driver Assignments Routes
// GET    /tours/:id/drivers            [admin, product_manager]
// POST   /tours/:id/drivers            [admin, product_manager]  — ліміт 2 на тур
// DELETE /tours/:id/drivers/:staffId   [admin, product_manager]
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TourDriversService } from './tour-drivers.service';
import { requireAuth } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

const DRIVER_ROLES_ACCESS = ['admin', 'product_manager'] as const;

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
} as const;

const DRIVER_ID_PARAMS = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    staffId: { type: 'string', format: 'uuid' },
  },
  required: ['id', 'staffId'],
} as const;

interface AssignDriverBody {
  staffId: string;
}

export async function tourDriversRoutes(app: FastifyInstance) {
  const service = new TourDriversService();

  // ── GET /tours/:id/drivers ───────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id/drivers',
    {
      preHandler: [requireAuth, requireRoles(...DRIVER_ROLES_ACCESS)],
      schema: {
        summary: 'Список водіїв, призначених на тур',
        tags: ['Staff'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const data = await service.listDrivers(req.params.id);
      return reply.code(200).send({ data });
    }
  );

  // ── POST /tours/:id/drivers ──────────────────────────────────────────────
  app.post<{ Params: { id: string }; Body: AssignDriverBody }>(
    '/:id/drivers',
    {
      preHandler: [requireAuth, requireRoles(...DRIVER_ROLES_ACCESS)],
      schema: {
        summary: 'Призначити водія на тур (максимум 2)',
        tags: ['Staff'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
        body: {
          type: 'object',
          required: ['staffId'],
          properties: { staffId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string }; Body: AssignDriverBody }>, reply: FastifyReply) => {
      const data = await service.assignDriver(req.params.id, req.body.staffId);
      return reply.code(201).send({ data });
    }
  );

  // ── DELETE /tours/:id/drivers/:staffId ───────────────────────────────────
  app.delete<{ Params: { id: string; staffId: string } }>(
    '/:id/drivers/:staffId',
    {
      preHandler: [requireAuth, requireRoles(...DRIVER_ROLES_ACCESS)],
      schema: {
        summary: 'Зняти водія з туру',
        tags: ['Staff'],
        security: [{ bearerAuth: [] }],
        params: DRIVER_ID_PARAMS,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string; staffId: string } }>, reply: FastifyReply) => {
      await service.unassignDriver(req.params.id, req.params.staffId);
      return reply.code(200).send({ data: { message: 'Водія знято з туру' } });
    }
  );
}
