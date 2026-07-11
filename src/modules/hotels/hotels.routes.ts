// =============================================================================
// EUROTRIPS — Hotels Routes
// GET /hotels       [admin, ops, manager, logist]  ?country=&city=&stars=&search=&page=&limit=
// GET /hotels/:id   [admin, ops, manager, logist]
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { HotelsService } from './hotels.service';
import { HotelListQuerySchema } from './hotels.schema';
import { requireAuth } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
} as const;

export async function hotelRoutes(app: FastifyInstance) {
  const service = new HotelsService();

  // ── GET /hotels ────────────────────────────────────────────────────────────
  app.get('/', {
    preHandler: [requireAuth, requireRoles('admin', 'ops', 'manager', 'logist')],
    schema: {
      summary: 'Каталог готелів',
      tags: ['Hotels'], security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          country:   { type: 'string' },
          city:      { type: 'string' },
          stars:     { type: 'string' },
          search:    { type: 'string' },
          page:      { type: 'string', default: '1' },
          limit:     { type: 'string', default: '20' },
          sortBy:    { type: 'string', enum: ['name', 'city', 'stars', 'createdAt'] },
          sortOrder: { type: 'string', enum: ['asc', 'desc'] },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = HotelListQuerySchema.parse(req.query);
    return reply.send(await service.listHotels(query));
  });

  // ── GET /hotels/:id ──────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/:id', {
    preHandler: [requireAuth, requireRoles('admin', 'ops', 'manager', 'logist')],
    schema: {
      summary: 'Готель за ID',
      tags: ['Hotels'], security: [{ bearerAuth: [] }],
      params: ID_PARAM,
    },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send({ data: await service.getHotel(req.params.id) });
  });
}
