// =============================================================================
// EUROTRIPS — Tourists Routes
// GET  /tourists   — пошук (для автокомпліту у формі бронювання)
// POST /tourists    — створити нового туриста
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TouristsService } from './tourists.service';
import {
  TouristListQuerySchema, CreateTouristSchema, type CreateTouristDto,
} from './tourists.schema';
import { requireAuth } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

export async function touristRoutes(app: FastifyInstance) {
  const service = new TouristsService();

  // ── GET /tourists ──────────────────────────────────────────────────────────
  app.get('/', {
    preHandler: [requireAuth, requireRoles('admin', 'director', 'manager', 'ops', 'agent')],
    schema: {
      summary: 'Пошук туристів',
      description: 'Для автокомпліту при створенні бронювання/ліда.',
      tags: ['Tourists'], security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          page:   { type: 'string', default: '1' },
          limit:  { type: 'string', default: '20' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = TouristListQuerySchema.parse(req.query);
    return reply.send(await service.list(query));
  });

  // ── POST /tourists ─────────────────────────────────────────────────────────
  app.post<{ Body: CreateTouristDto }>('/', {
    preHandler: [requireAuth, requireRoles('admin', 'manager', 'agent')],
    schema: {
      summary: 'Створити туриста',
      tags: ['Tourists'], security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const dto = CreateTouristSchema.parse(req.body);
    return reply.code(201).send({ data: await service.create(dto) });
  });
}
