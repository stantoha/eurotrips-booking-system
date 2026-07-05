// =============================================================================
// EUROTRIPS — Tour Checklist Routes
// GET   /tours/:id/checklist          [ops, manager, admin, director]
// PATCH /tours/:id/checklist          [ops, admin]
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ChecklistService } from './checklist.service';
import { PatchChecklistItemSchema, CHECKLIST_ITEMS, type PatchChecklistItemDto } from './checklist.schema';
import { requireAuth, getCurrentUser } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
} as const;

export async function checklistRoutes(app: FastifyInstance) {
  const service = new ChecklistService();

  // ── GET /tours/:id/checklist ─────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id/checklist',
    {
      preHandler: [requireAuth, requireRoles('ops', 'manager', 'admin', 'director')],
      schema: {
        summary: 'Операційний чекліст готовності виїзду (OPS-18)',
        tags: ['Checklist'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const data = await service.getChecklist(req.params.id);
      return reply.code(200).send({ data });
    }
  );

  // ── PATCH /tours/:id/checklist ───────────────────────────────────────────────
  app.patch<{ Params: { id: string }; Body: PatchChecklistItemDto }>(
    '/:id/checklist',
    {
      preHandler: [requireAuth, requireRoles('ops', 'admin')],
      schema: {
        summary: 'Оновити пункт чекліста (OPS-18)',
        description: `Пункти: ${CHECKLIST_ITEMS.join(', ')}`,
        tags: ['Checklist'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
        body: {
          type: 'object',
          required: ['item', 'value'],
          properties: {
            item: { type: 'string', enum: [...CHECKLIST_ITEMS] },
            value: { type: 'boolean' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string }; Body: PatchChecklistItemDto }>, reply: FastifyReply) => {
      const dto = PatchChecklistItemSchema.parse(req.body);
      const user = getCurrentUser(req);
      const data = await service.patchItem(req.params.id, dto, user);
      return reply.code(200).send({ data });
    }
  );
}
