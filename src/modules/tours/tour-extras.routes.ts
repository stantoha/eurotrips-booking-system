// =============================================================================
// EUROTRIPS — Tour Extras Routes
// GET    /tours/:id/extras            [admin, product_manager, ops, manager, director]
// POST   /tours/:id/extras            [admin, product_manager]
// PATCH  /tours/:id/extras/:extraId   [admin, product_manager]
// DELETE /tours/:id/extras/:extraId   [admin, product_manager]  — soft (status='відмінено')
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TourExtrasService } from './tour-extras.service';
import {
  CreateTourExtraSchema, PatchTourExtraSchema, TOUR_EXTRA_STATUSES,
  type CreateTourExtraDto, type PatchTourExtraDto,
} from './tour-extras.schema';
import { requireAuth } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

const EXTRAS_READ_ROLES = ['admin', 'product_manager', 'ops', 'manager', 'director'] as const;
const EXTRAS_WRITE_ROLES = ['admin', 'product_manager'] as const;

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
} as const;

const EXTRA_ID_PARAMS = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    extraId: { type: 'string', format: 'uuid' },
  },
  required: ['id', 'extraId'],
} as const;

const COST_BODY_PROPS = {
  connectionType: { type: 'string' },
  guideCost: { type: 'number', minimum: 0 },
  parkingCost: { type: 'number', minimum: 0 },
  cityEntriesCost: { type: 'number', minimum: 0 },
  giftsCost: { type: 'number', minimum: 0 },
  insuranceCost: { type: 'number', minimum: 0 },
  otherCost: { type: 'number', minimum: 0 },
  personsCount: { type: 'number', minimum: 1 },
  status: { type: 'string', enum: [...TOUR_EXTRA_STATUSES] },
  notes: { type: 'string' },
} as const;

export async function tourExtrasRoutes(app: FastifyInstance) {
  const service = new TourExtrasService();

  // ── GET /tours/:id/extras ─────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id/extras',
    {
      preHandler: [requireAuth, requireRoles(...EXTRAS_READ_ROLES)],
      schema: {
        summary: 'Список ДОПів туру',
        tags: ['TourExtras'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const data = await service.listExtras(req.params.id);
      return reply.code(200).send({ data });
    }
  );

  // ── POST /tours/:id/extras ────────────────────────────────────────────────
  app.post<{ Params: { id: string }; Body: CreateTourExtraDto }>(
    '/:id/extras',
    {
      preHandler: [requireAuth, requireRoles(...EXTRAS_WRITE_ROLES)],
      schema: {
        summary: 'Додати ДОП до туру',
        tags: ['TourExtras'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
        body: { type: 'object', properties: COST_BODY_PROPS },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string }; Body: CreateTourExtraDto }>, reply: FastifyReply) => {
      const dto = CreateTourExtraSchema.parse(req.body);
      const data = await service.createExtra(req.params.id, dto);
      return reply.code(201).send({ data });
    }
  );

  // ── PATCH /tours/:id/extras/:extraId ──────────────────────────────────────
  app.patch<{ Params: { id: string; extraId: string }; Body: PatchTourExtraDto }>(
    '/:id/extras/:extraId',
    {
      preHandler: [requireAuth, requireRoles(...EXTRAS_WRITE_ROLES)],
      schema: {
        summary: 'Оновити ДОП туру',
        tags: ['TourExtras'],
        security: [{ bearerAuth: [] }],
        params: EXTRA_ID_PARAMS,
        body: { type: 'object', properties: COST_BODY_PROPS },
      },
    },
    async (
      req: FastifyRequest<{ Params: { id: string; extraId: string }; Body: PatchTourExtraDto }>,
      reply: FastifyReply
    ) => {
      const dto = PatchTourExtraSchema.parse(req.body);
      const data = await service.patchExtra(req.params.id, req.params.extraId, dto);
      return reply.code(200).send({ data });
    }
  );

  // ── DELETE /tours/:id/extras/:extraId (soft) ──────────────────────────────
  app.delete<{ Params: { id: string; extraId: string } }>(
    '/:id/extras/:extraId',
    {
      preHandler: [requireAuth, requireRoles(...EXTRAS_WRITE_ROLES)],
      schema: {
        summary: 'Скасувати ДОП туру (soft delete)',
        tags: ['TourExtras'],
        security: [{ bearerAuth: [] }],
        params: EXTRA_ID_PARAMS,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string; extraId: string } }>, reply: FastifyReply) => {
      await service.cancelExtra(req.params.id, req.params.extraId);
      return reply.code(200).send({ data: { message: 'ДОП скасовано' } });
    }
  );
}
