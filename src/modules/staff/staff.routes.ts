// =============================================================================
// EUROTRIPS — Staff Routes
// GET    /staff       [admin, product_manager]  ?role=&status=&search=&page=&limit=
// GET    /staff/:id   [admin, product_manager]
// POST   /staff       [admin, product_manager]
// PATCH  /staff/:id   [admin, product_manager]
// DELETE /staff/:id   [admin, product_manager]  — soft delete (status='inactive')
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StaffService } from './staff.service';
import {
  StaffListQuerySchema, CreateStaffSchema, PatchStaffSchema, STAFF_ROLES,
  type StaffListQueryDto, type CreateStaffDto, type PatchStaffDto,
} from './staff.schema';
import { requireAuth } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

const STAFF_ROLES_ACCESS = ['admin', 'product_manager'] as const;

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
} as const;

export async function staffRoutes(app: FastifyInstance) {
  const service = new StaffService();

  // ── GET /staff ────────────────────────────────────────────────────────────
  app.get<{ Querystring: StaffListQueryDto }>(
    '/',
    {
      preHandler: [requireAuth, requireRoles(...STAFF_ROLES_ACCESS)],
      schema: {
        summary: 'Список персоналу (турлідери/гіди/водії/координатори)',
        tags: ['Staff'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: [...STAFF_ROLES] },
            status: { type: 'string' },
            search: { type: 'string' },
            page: { type: 'string', default: '1' },
            limit: { type: 'string', default: '20' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Querystring: StaffListQueryDto }>, reply: FastifyReply) => {
      const query = StaffListQuerySchema.parse(req.query);
      const result = await service.listStaff(query);
      return reply.code(200).send(result);
    }
  );

  // ── GET /staff/:id ───────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [requireAuth, requireRoles(...STAFF_ROLES_ACCESS)],
      schema: {
        summary: 'Персонал за ID',
        tags: ['Staff'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const staff = await service.getStaff(req.params.id);
      return reply.code(200).send({ data: staff });
    }
  );

  // ── POST /staff ──────────────────────────────────────────────────────────
  app.post<{ Body: CreateStaffDto }>(
    '/',
    {
      preHandler: [requireAuth, requireRoles(...STAFF_ROLES_ACCESS)],
      schema: {
        summary: 'Додати співробітника',
        tags: ['Staff'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['firstName', 'lastName', 'role'],
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string', enum: [...STAFF_ROLES] },
            phone: { type: 'string' },
            email: { type: 'string' },
            languages: { type: 'array', items: { type: 'string' } },
            specializations: { type: 'array', items: { type: 'string' } },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Body: CreateStaffDto }>, reply: FastifyReply) => {
      const dto = CreateStaffSchema.parse(req.body);
      const staff = await service.createStaff(dto);
      return reply.code(201).send({ data: staff });
    }
  );

  // ── PATCH /staff/:id ─────────────────────────────────────────────────────
  app.patch<{ Params: { id: string }; Body: PatchStaffDto }>(
    '/:id',
    {
      preHandler: [requireAuth, requireRoles(...STAFF_ROLES_ACCESS)],
      schema: {
        summary: 'Оновити співробітника',
        tags: ['Staff'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
        body: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string', enum: [...STAFF_ROLES] },
            phone: { type: 'string' },
            email: { type: 'string' },
            languages: { type: 'array', items: { type: 'string' } },
            specializations: { type: 'array', items: { type: 'string' } },
            status: { type: 'string', enum: ['active', 'inactive'] },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string }; Body: PatchStaffDto }>, reply: FastifyReply) => {
      const dto = PatchStaffSchema.parse(req.body);
      const staff = await service.patchStaff(req.params.id, dto);
      return reply.code(200).send({ data: staff });
    }
  );

  // ── DELETE /staff/:id (soft) ─────────────────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [requireAuth, requireRoles(...STAFF_ROLES_ACCESS)],
      schema: {
        summary: 'Деактивувати співробітника (soft delete)',
        tags: ['Staff'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await service.deactivateStaff(req.params.id);
      return reply.code(200).send({ data: { message: 'Співробітника деактивовано' } });
    }
  );
}
