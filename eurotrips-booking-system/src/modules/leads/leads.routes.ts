// =============================================================================
// EUROTRIPS — Leads Routes
// GET   /leads              — список з фільтрами
// POST  /leads              — створити лід
// PUT   /leads/:id          — оновити
// PATCH /leads/:id/convert  — конвертувати в бронювання
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { LeadsService } from './leads.service';
import {
  LeadListQuerySchema, CreateLeadSchema, UpdateLeadSchema, ConvertLeadSchema,
  type LeadListQueryDto, type CreateLeadDto, type UpdateLeadDto, type ConvertLeadDto,
} from './leads.schema';
import { requireAuth } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';
import { getCurrentUser } from '../../shared/guards/jwt.guard';

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
} as const;

export async function leadRoutes(app: FastifyInstance) {
  const service = new LeadsService();

  // ── GET /leads ─────────────────────────────────────────────────────────────
  app.get('/', {
    preHandler: [requireAuth, requireRoles('admin', 'director', 'manager', 'agent')],
    schema: {
      summary: 'Список лідів',
      description: 'Менеджер бачить свої ліди. Адмін/директор — всі.',
      tags: ['Leads'], security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          status:    { type: 'string', enum: ['new','in_work','needs_clarification',
                        'proposal_sent','waiting_decision','won','lost'] },
          source:    { type: 'string' },
          managerId: { type: 'string' },
          tourId:    { type: 'string' },
          search:    { type: 'string' },
          dateFrom:  { type: 'string' },
          dateTo:    { type: 'string' },
          page:      { type: 'string', default: '1' },
          limit:     { type: 'string', default: '20' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = LeadListQuerySchema.parse(req.query);
    const user  = getCurrentUser(req);
    return reply.send(await service.listLeads(query, user));
  });

  // ── POST /leads ────────────────────────────────────────────────────────────
  app.post<{ Body: CreateLeadDto }>('/', {
    preHandler: [requireAuth, requireRoles('admin', 'manager', 'agent')],
    schema: {
      summary: 'Створити лід',
      description: 'Приймає touristId або об\'єкт tourist для авто-створення. Автоматично присвоює менеджера.',
      tags: ['Leads'], security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const dto  = CreateLeadSchema.parse(req.body);
    const user = getCurrentUser(req);
    return reply.code(201).send({ data: await service.createLead(dto, user) });
  });

  // ── PUT /leads/:id ─────────────────────────────────────────────────────────
  app.put<{ Params: { id: string }; Body: UpdateLeadDto }>('/:id', {
    preHandler: [requireAuth, requireRoles('admin', 'manager', 'agent')],
    schema: {
      summary: 'Оновити лід',
      description: 'Конвертований лід не можна редагувати.',
      tags: ['Leads'], security: [{ bearerAuth: [] }], params: ID_PARAM,
    },
  }, async (req, reply) => {
    const dto  = UpdateLeadSchema.parse(req.body);
    const user = getCurrentUser(req);
    return reply.send({ data: await service.updateLead(req.params.id, dto, user) });
  });

  // ── PATCH /leads/:id/convert ───────────────────────────────────────────────
  app.patch<{ Params: { id: string }; Body: ConvertLeadDto }>('/:id/convert', {
    preHandler: [requireAuth, requireRoles('admin', 'manager', 'agent')],
    schema: {
      summary: 'Конвертувати лід у бронювання',
      description: `Ключовий ендпоінт CRM:
1. Перевіряє лід та тур (availability)
2. Знімає місця (BR-01, транзакція)
3. Створює Booking зі статусом 'new' + lead_id
4. Розраховує комісію агента (BR-02)
5. Оновлює лід: status='won', convertedToBookingId=<id>`,
      tags: ['Leads'], security: [{ bearerAuth: [] }], params: ID_PARAM,
      body: {
        type: 'object', required: ['tourId', 'totalAmount', 'depositAmount'],
        properties: {
          tourId:          { type: 'string', format: 'uuid' },
          bookingType:     { type: 'string', enum: ['direct','agent','corporate','group'] },
          personsCount:    { type: 'integer', minimum: 1 },
          totalAmount:     { type: 'number', minimum: 0.01 },
          depositAmount:   { type: 'number', minimum: 0.01 },
          depositDeadline: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          balanceDeadline: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          agentId:         { type: 'string', format: 'uuid' },
          comment:         { type: 'string', maxLength: 2000 },
        },
      },
    },
  }, async (req, reply) => {
    const dto  = ConvertLeadSchema.parse(req.body);
    const user = getCurrentUser(req);
    const result = await service.convertToBooking(req.params.id, dto, user);
    return reply.code(201).send({ data: result });
  });
}
