// =============================================================================
// EUROTRIPS — Tourists Routes
// GET  /tourists   — пошук (для автокомпліту у формі бронювання)
// POST /tourists    — створити нового туриста
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TouristsService } from './tourists.service';
import {
  TouristListQuerySchema, CreateTouristSchema, UpdateTouristProfileSchema,
  type CreateTouristDto, type UpdateTouristProfileDto,
} from './tourists.schema';
import { requireAuth, getCurrentUser } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';
import { Errors } from '../../shared/utils/errors';

export async function touristRoutes(app: FastifyInstance) {
  const service = new TouristsService();

  // ── GET /tourists/me ────────────────────────────────────────────────────────
  // Реєструємо ПЕРЕД GET /:id (якщо колись з'явиться), щоб "me" не сприймався
  // як :id параметр.
  app.get('/me', {
    preHandler: [requireAuth, requireRoles('tourist')],
    schema: {
      summary: 'Власний профіль туриста',
      tags: ['Tourists'], security: [{ bearerAuth: [] }],
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = getCurrentUser(req);
    if (!user.touristId) throw Errors.notFound('Профіль туриста');
    return reply.send({ data: await service.getById(user.touristId) });
  });

  // ── PATCH /tourists/me ──────────────────────────────────────────────────────
  app.patch<{ Body: UpdateTouristProfileDto }>('/me', {
    preHandler: [requireAuth, requireRoles('tourist')],
    schema: {
      summary: 'Оновити власний профіль туриста',
      tags: ['Tourists'], security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const user = getCurrentUser(req);
    if (!user.touristId) throw Errors.notFound('Профіль туриста');
    const dto = UpdateTouristProfileSchema.parse(req.body);
    return reply.send({ data: await service.updateProfile(user.touristId, dto) });
  });

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
