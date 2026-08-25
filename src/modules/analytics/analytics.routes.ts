// =============================================================================
// EUROTRIPS — Analytics Routes
// GET /analytics/sales-funnel  [admin, director, manager]  ?dateFrom=&dateTo=
// GET /analytics/tours-load    [admin, director, manager]  ?dateFrom=&dateTo=&status=
// GET /analytics/agents-top    [admin, director, manager]  ?dateFrom=&dateTo=&limit=
// GET /analytics/revenue-trend [admin, director, manager]  ?dateFrom=&dateTo=&months=
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsPeriodQuerySchema,
  ToursLoadQuerySchema,
  AgentsTopQuerySchema,
  RevenueTrendQuerySchema,
} from './analytics.schema';
import { requireAuth, getCurrentUser } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

const PERIOD_QUERYSTRING = {
  type: 'object',
  properties: {
    dateFrom: { type: 'string' },
    dateTo:   { type: 'string' },
  },
} as const;

export async function analyticsRoutes(app: FastifyInstance) {
  const service = new AnalyticsService();

  // ── GET /analytics/sales-funnel ─────────────────────────────────────────
  app.get('/sales-funnel', {
    preHandler: [requireAuth, requireRoles('admin', 'director', 'manager')],
    schema: {
      summary: 'Воронка продажів: ліди → бронювання → підтверджені (за період)',
      tags: ['Analytics'], security: [{ bearerAuth: [] }],
      querystring: PERIOD_QUERYSTRING,
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = AnalyticsPeriodQuerySchema.parse(req.query);
    return reply.send({ data: await service.getSalesFunnel(query) });
  });

  // ── GET /analytics/tours-load ────────────────────────────────────────────
  app.get('/tours-load', {
    preHandler: [requireAuth, requireRoles('admin', 'director', 'manager')],
    schema: {
      summary: 'Заповнюваність турів (sold/total seats)',
      description: 'costPrice повертається тільки admin/director/accountant.',
      tags: ['Analytics'], security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          dateFrom: { type: 'string' },
          dateTo:   { type: 'string' },
          status:   { type: 'string', enum: ['draft', 'open', 'active', 'almost_full', 'closed', 'on_tour', 'completed', 'cancelled'] },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = ToursLoadQuerySchema.parse(req.query);
    const user = getCurrentUser(req);
    return reply.send({ data: await service.getToursLoad(query, user) });
  });

  // ── GET /analytics/agents-top ────────────────────────────────────────────
  app.get('/agents-top', {
    preHandler: [requireAuth, requireRoles('admin', 'director', 'manager')],
    schema: {
      summary: 'Топ агентів за кількістю бронювань (за період)',
      tags: ['Analytics'], security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          dateFrom: { type: 'string' },
          dateTo:   { type: 'string' },
          limit:    { type: 'string', default: '10' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = AgentsTopQuerySchema.parse(req.query);
    return reply.send({ data: await service.getAgentsTop(query) });
  });

  // ── GET /analytics/revenue-trend ─────────────────────────────────────────
  app.get('/revenue-trend', {
    preHandler: [requireAuth, requireRoles('admin', 'director', 'manager')],
    schema: {
      summary: 'Тренд обороту та к-сті бронювань по місяцях',
      tags: ['Analytics'], security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          dateFrom: { type: 'string' },
          dateTo:   { type: 'string' },
          months:   { type: 'string', default: '12' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = RevenueTrendQuerySchema.parse(req.query);
    return reply.send({ data: await service.getRevenueTrend(query) });
  });
}
