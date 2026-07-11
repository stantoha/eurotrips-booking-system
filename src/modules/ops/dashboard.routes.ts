// =============================================================================
// EUROTRIPS — OPS Dashboard Routes
// GET /ops/dashboard   [ops, manager, admin, director, logist]
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OpsDashboardService } from './dashboard.service';
import { requireAuth } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

export async function opsDashboardRoutes(app: FastifyInstance) {
  const service = new OpsDashboardService();

  app.get(
    '/dashboard',
    {
      preHandler: [requireAuth, requireRoles('ops', 'manager', 'admin', 'director', 'logist')],
      schema: {
        summary: 'Дашборд операційного менеджера (/ops)',
        description: 'Дедлайни готелів, виїзди наступних 7 днів, прогрес чеклістів, нові підтверджені туристи.',
        tags: ['Ops'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const data = await service.getDashboard();
      return reply.code(200).send({ data });
    }
  );
}
