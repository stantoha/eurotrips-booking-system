// =============================================================================
// EUROTRIPS — Tour Activities Routes (read-only)
// GET /tours/:id/activities   [ops, manager, admin, director]
//
// Джерело даних: TourActivity (вже існує в schema.prisma, MODEL 16),
// але досі не мала жодного API-ендпоінту. Потрібна для TimelineView
// (OPS UX C-3, wireframe 3 «Програма і Гіди»).
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../shared/database/prisma';
import { Errors } from '../../shared/utils/errors';
import { requireAuth } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
} as const;

export async function activitiesRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    '/:id/activities',
    {
      preHandler: [requireAuth, requireRoles('ops', 'manager', 'admin', 'director')],
      schema: {
        summary: 'Програма туру: активності та гіди (TimelineView)',
        tags: ['Activities'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const tour = await prisma.tour.findFirst({ where: { id: req.params.id, isArchived: false } });
      if (!tour) throw Errors.notFound('Тур', req.params.id);

      const activities = await prisma.tourActivity.findMany({
        where: { tourId: req.params.id },
        orderBy: [{ activityDate: 'asc' }, { startTime: 'asc' }],
      });

      return reply.code(200).send({ data: activities });
    }
  );
}
