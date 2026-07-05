// =============================================================================
// EUROTRIPS — Tour Tourists Routes
// GET /tours/:id/tourists   [ops, manager, admin, director]
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TouristsService } from './tourists.service';
import { TourTouristsQuerySchema, type TourTouristsQueryDto } from './tourists.schema';
import { requireAuth } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
} as const;

export async function touristsRoutes(app: FastifyInstance) {
  const service = new TouristsService();

  app.get<{ Params: { id: string }; Querystring: TourTouristsQueryDto }>(
    '/:id/tourists',
    {
      preHandler: [requireAuth, requireRoles('ops', 'manager', 'admin', 'director')],
      schema: {
        summary: 'Список туристів виїзду (з підтверджених бронювань)',
        description: 'Фільтри: без паспорту, з боргом, без кімнати. Основа для румінгу/розсадки.',
        tags: ['Tourists'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
        querystring: {
          type: 'object',
          properties: {
            missingPassport: { type: 'string', enum: ['true', 'false'] },
            hasDebt: { type: 'string', enum: ['true', 'false'] },
            noRoom: { type: 'string', enum: ['true', 'false'] },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string }; Querystring: TourTouristsQueryDto }>, reply: FastifyReply) => {
      const query = TourTouristsQuerySchema.parse(req.query);
      const data = await service.listTourTourists(req.params.id, query);
      return reply.code(200).send({ data });
    }
  );
}
