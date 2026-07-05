// =============================================================================
// EUROTRIPS — OPS Documents Routes (OPS-18/19)
// GET  /tours/:id/documents                       [ops, manager, admin, director]
// POST /tours/:id/documents/rooming-pdf            [ops, admin]
// POST /tours/:id/documents/passenger-list         [ops, admin]
// GET  /tours/:id/documents/:documentId/download   [ops, manager, admin, director]
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DocumentsService } from './documents.service';
import { requireAuth, getCurrentUser } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
} as const;

const GenerateRoomingPdfSchema = z.object({ hotelBookingId: z.string().uuid() });

export async function documentsRoutes(app: FastifyInstance) {
  const service = new DocumentsService();

  app.get<{ Params: { id: string } }>(
    '/:id/documents',
    {
      preHandler: [requireAuth, requireRoles('ops', 'manager', 'admin', 'director')],
      schema: {
        summary: 'Документи виїзду (OPS-18/19)',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const data = await service.listDocuments(req.params.id);
      return reply.code(200).send({ data });
    }
  );

  app.post<{ Params: { id: string }; Body: { hotelBookingId: string } }>(
    '/:id/documents/rooming-pdf',
    {
      preHandler: [requireAuth, requireRoles('ops', 'admin')],
      schema: {
        summary: 'Згенерувати румінг-PDF для готелю (OPS-18)',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
        body: {
          type: 'object',
          required: ['hotelBookingId'],
          properties: { hotelBookingId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string }; Body: { hotelBookingId: string } }>, reply: FastifyReply) => {
      const dto = GenerateRoomingPdfSchema.parse(req.body);
      const user = getCurrentUser(req);
      const data = await service.generateRoomingPdf(req.params.id, dto.hotelBookingId, user.sub);
      return reply.code(201).send({ data });
    }
  );

  app.post<{ Params: { id: string } }>(
    '/:id/documents/passenger-list',
    {
      preHandler: [requireAuth, requireRoles('ops', 'admin')],
      schema: {
        summary: 'Згенерувати пасенджер-ліст (OPS-19)',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = getCurrentUser(req);
      const data = await service.generatePassengerListPdf(req.params.id, user.sub);
      return reply.code(201).send({ data });
    }
  );

  app.get<{ Params: { id: string; documentId: string } }>(
    '/:id/documents/:documentId/download',
    {
      preHandler: [requireAuth, requireRoles('ops', 'manager', 'admin', 'director')],
      schema: {
        summary: 'Завантажити PDF документа',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            documentId: { type: 'string', format: 'uuid' },
          },
          required: ['id', 'documentId'],
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string; documentId: string } }>, reply: FastifyReply) => {
      const { buffer, title } = await service.getDocumentFile(req.params.documentId);
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `inline; filename="${encodeURIComponent(title)}.pdf"`)
        .send(buffer);
    }
  );
}
