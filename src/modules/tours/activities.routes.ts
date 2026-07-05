// =============================================================================
// EUROTRIPS — Tour Activities Routes
// GET   /tours/:id/activities              [ops, manager, admin, director]
// POST  /tours/:id/activities              [ops, admin]     — OPS-11
// PATCH /tours/:id/activities/:activityId  [ops, admin]     — OPS-12/OPS-13
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ActivitiesService } from './activities.service';
import {
  CreateActivitySchema, PatchActivitySchema, ACTIVITY_STATUSES,
  type CreateActivityDto, type PatchActivityDto,
} from './activities.schema';
import { requireAuth, getCurrentUser } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
} as const;

const ACTIVITY_ID_PARAMS = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    activityId: { type: 'string', format: 'uuid' },
  },
  required: ['id', 'activityId'],
} as const;

export async function activitiesRoutes(app: FastifyInstance) {
  const service = new ActivitiesService();

  // ── GET /tours/:id/activities ────────────────────────────────────────────────
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
      const data = await service.listActivities(req.params.id);
      return reply.code(200).send({ data });
    }
  );

  // ── POST /tours/:id/activities (OPS-11) ──────────────────────────────────────
  app.post<{ Params: { id: string }; Body: CreateActivityDto }>(
    '/:id/activities',
    {
      preHandler: [requireAuth, requireRoles('ops', 'admin')],
      schema: {
        summary: 'Додати активність у програму туру (OPS-11)',
        tags: ['Activities'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
        body: {
          type: 'object',
          required: ['city', 'programType', 'activityDate', 'activityName'],
          properties: {
            city: { type: 'string' },
            programType: { type: 'string' },
            activityDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            activityName: { type: 'string' },
            startTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
            guideName: { type: 'string' },
            guidePhone: { type: 'string' },
            costEur: { type: 'number', minimum: 0 },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string }; Body: CreateActivityDto }>, reply: FastifyReply) => {
      const dto = CreateActivitySchema.parse(req.body);
      const user = getCurrentUser(req);
      const data = await service.createActivity(req.params.id, dto, user.sub);
      return reply.code(201).send({ data });
    }
  );

  // ── PATCH /tours/:id/activities/:activityId (OPS-12/OPS-13) ──────────────────
  app.patch<{ Params: { id: string; activityId: string }; Body: PatchActivityDto }>(
    '/:id/activities/:activityId',
    {
      preHandler: [requireAuth, requireRoles('ops', 'admin')],
      schema: {
        summary: 'Оновити активність: гід, вартість, статус (OPS-12/OPS-13)',
        tags: ['Activities'],
        security: [{ bearerAuth: [] }],
        params: ACTIVITY_ID_PARAMS,
        body: {
          type: 'object',
          properties: {
            city: { type: 'string' },
            programType: { type: 'string' },
            activityDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            activityName: { type: 'string' },
            startTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
            guideName: { type: 'string' },
            guidePhone: { type: 'string' },
            costEur: { type: 'number', minimum: 0 },
            status: { type: 'string', enum: [...ACTIVITY_STATUSES] },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (
      req: FastifyRequest<{ Params: { id: string; activityId: string }; Body: PatchActivityDto }>,
      reply: FastifyReply
    ) => {
      const dto = PatchActivitySchema.parse(req.body);
      const user = getCurrentUser(req);
      const data = await service.patchActivity(req.params.id, req.params.activityId, dto, user.sub);
      return reply.code(200).send({ data });
    }
  );
}
