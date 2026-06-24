// =============================================================================
// EUROTRIPS — Agents Routes
// GET  /agents                    [admin, director, manager]
// GET  /agents/:id                [admin, director, manager]
// GET  /agents/:id/commissions    [admin, director, accountant, agent (own)]
// GET  /agents/:id/royalty        [admin, director] — BR-07: network only
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AgentsService } from './agents.service';
import {
  AgentListQuerySchema,
  AgentCommissionQuerySchema,
  type AgentListQueryDto,
  type AgentCommissionQueryDto,
} from './agents.schema';
import { requireAuth }   from '../../shared/guards/jwt.guard';
import { requireRoles }  from '../../shared/guards/rbac.guard';
import { getCurrentUser } from '../../shared/guards/jwt.guard';

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
} as const;

export async function agentRoutes(app: FastifyInstance) {
  const service = new AgentsService();

  // ── GET /agents ─────────────────────────────────────────────────────────
  app.get('/', {
    preHandler: [requireAuth, requireRoles('admin', 'director', 'manager')],
    schema: {
      summary: 'Список агентів',
      tags: ['Agents'], security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          status:    { type: 'string', enum: ['active', 'suspended', 'blocked'] },
          agentType: { type: 'string', enum: ['standard', 'network'] },
          networkId: { type: 'string' },
          search:    { type: 'string' },
          page:      { type: 'string', default: '1' },
          limit:     { type: 'string', default: '20' },
          sortBy:    { type: 'string', enum: ['createdAt', 'agencyName', 'balance'] },
          sortOrder: { type: 'string', enum: ['asc', 'desc'] },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = AgentListQuerySchema.parse(req.query);
    const user  = getCurrentUser(req);
    return reply.send(await service.listAgents(query, user));
  });

  // ── GET /agents/:id ──────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/:id', {
    preHandler: [requireAuth, requireRoles('admin', 'director', 'manager')],
    schema: {
      summary: 'Агент по ID',
      tags: ['Agents'], security: [{ bearerAuth: [] }],
      params: ID_PARAM,
    },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send({ data: await service.getAgent(req.params.id) });
  });

  // ── GET /agents/:id/commissions ──────────────────────────────────────────
  app.get<{ Params: { id: string }; Querystring: AgentCommissionQueryDto }>('/:id/commissions', {
    preHandler: [requireAuth, requireRoles('admin', 'director', 'accountant', 'agent')],
    schema: {
      summary: 'Комісії агента (агент бачить тільки свої)',
      tags: ['Agents'], security: [{ bearerAuth: [] }],
      params: ID_PARAM,
      querystring: {
        type: 'object',
        properties: {
          status:   { type: 'string', enum: ['pending', 'frozen', 'to_pay', 'paid', 'cancelled'] },
          dateFrom: { type: 'string' },
          dateTo:   { type: 'string' },
          page:     { type: 'string', default: '1' },
          limit:    { type: 'string', default: '20' },
        },
      },
    },
  }, async (req: FastifyRequest<{ Params: { id: string }; Querystring: AgentCommissionQueryDto }>,
             reply: FastifyReply) => {
    const query = AgentCommissionQuerySchema.parse(req.query);
    const user  = getCurrentUser(req);
    return reply.send(await service.getAgentCommissions(req.params.id, query, user));
  });

  // ── GET /agents/:id/royalty ──────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/:id/royalty', {
    preHandler: [requireAuth, requireRoles('admin', 'director')],
    schema: {
      summary: 'Роялті мережевого агента (BR-07: тільки network)',
      tags: ['Agents'], security: [{ bearerAuth: [] }],
      params: ID_PARAM,
    },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return reply.send({ data: await service.getAgentRoyalty(req.params.id) });
  });
}
