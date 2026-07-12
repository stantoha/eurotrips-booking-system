// =============================================================================
// EUROTRIPS — Booking Documents Routes (Реліз 1: «документи»)
// GET  /bookings/:id/documents                        [admin, manager, director, agent*]
// POST /bookings/:id/documents/voucher                [admin, manager, agent*]
// POST /bookings/:id/documents/contract               [admin, manager, agent*]
// GET  /bookings/:id/documents/:documentId/download   [admin, manager, director, agent*]
// * agent — тільки свої бронювання (IDOR-перевірка в сервісі)
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BookingDocumentsService } from './booking-documents.service';
import { requireAuth, getCurrentUser } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

const READ_ROLES = ['admin', 'manager', 'director', 'agent'] as const;
const WRITE_ROLES = ['admin', 'manager', 'agent'] as const;

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
} as const;

const DOC_ID_PARAMS = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    documentId: { type: 'string', format: 'uuid' },
  },
  required: ['id', 'documentId'],
} as const;

export async function bookingDocumentsRoutes(app: FastifyInstance) {
  const service = new BookingDocumentsService();

  // ── GET /bookings/:id/documents ─────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id/documents',
    {
      preHandler: [requireAuth, requireRoles(...READ_ROLES)],
      schema: {
        summary: 'Документи бронювання (ваучер/договір)',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = getCurrentUser(req);
      const data = await service.listDocuments(req.params.id, user);
      return reply.code(200).send({ data });
    }
  );

  // ── POST /bookings/:id/documents/voucher ────────────────────────────────────
  app.post<{ Params: { id: string } }>(
    '/:id/documents/voucher',
    {
      preHandler: [requireAuth, requireRoles(...WRITE_ROLES)],
      schema: {
        summary: 'Згенерувати PDF-ваучер бронювання',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = getCurrentUser(req);
      const data = await service.generateVoucher(req.params.id, user);
      return reply.code(201).send({ data });
    }
  );

  // ── POST /bookings/:id/documents/contract ───────────────────────────────────
  app.post<{ Params: { id: string } }>(
    '/:id/documents/contract',
    {
      preHandler: [requireAuth, requireRoles(...WRITE_ROLES)],
      schema: {
        summary: 'Згенерувати PDF-договір бронювання',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = getCurrentUser(req);
      const data = await service.generateContract(req.params.id, user);
      return reply.code(201).send({ data });
    }
  );

  // ── GET /bookings/:id/documents/:documentId/download ────────────────────────
  app.get<{ Params: { id: string; documentId: string } }>(
    '/:id/documents/:documentId/download',
    {
      preHandler: [requireAuth, requireRoles(...READ_ROLES)],
      schema: {
        summary: 'Завантажити PDF-документ бронювання',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        params: DOC_ID_PARAMS,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string; documentId: string } }>, reply: FastifyReply) => {
      const user = getCurrentUser(req);
      const { buffer, title } = await service.getDocumentFile(req.params.id, req.params.documentId, user);
      return reply
        .code(200)
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.pdf"`)
        .send(buffer);
    }
  );
}
