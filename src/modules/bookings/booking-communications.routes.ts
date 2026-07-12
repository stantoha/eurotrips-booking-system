// =============================================================================
// EUROTRIPS — Booking Communications Routes (Реліз 1: «базові повідомлення»)
// GET  /bookings/:id/communications   [admin, manager, director, ops, agent*]
// POST /bookings/:id/communications   [admin, manager, agent*]
// * agent — тільки свої бронювання (IDOR-перевірка в сервісі)
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { CommunicationChannel, CommunicationDirection } from '@prisma/client';
import { BookingCommunicationsService, type CreateBookingCommunicationDto } from './booking-communications.service';
import { requireAuth, getCurrentUser } from '../../shared/guards/jwt.guard';
import { requireRoles } from '../../shared/guards/rbac.guard';

const CreateCommunicationSchema = z.object({
  channel: z.nativeEnum(CommunicationChannel),
  direction: z.nativeEnum(CommunicationDirection).default('outbound'),
  subject: z.string().max(255).optional(),
  body: z.string().max(5000).optional(),
});

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
} as const;

export async function bookingCommunicationsRoutes(app: FastifyInstance) {
  const service = new BookingCommunicationsService();

  // ── GET /bookings/:id/communications ────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id/communications',
    {
      preHandler: [requireAuth, requireRoles('admin', 'manager', 'director', 'ops', 'agent')],
      schema: {
        summary: 'Лог повідомлень по бронюванню (email/SMS/Telegram/Viber/дзвінки)',
        tags: ['Communications'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = getCurrentUser(req);
      const data = await service.listCommunications(req.params.id, user);
      return reply.code(200).send({ data });
    }
  );

  // ── POST /bookings/:id/communications ───────────────────────────────────────
  app.post<{ Params: { id: string }; Body: CreateBookingCommunicationDto }>(
    '/:id/communications',
    {
      preHandler: [requireAuth, requireRoles('admin', 'manager', 'agent')],
      schema: {
        summary: 'Зафіксувати повідомлення/контакт із клієнтом (ручний лог)',
        tags: ['Communications'],
        security: [{ bearerAuth: [] }],
        params: ID_PARAM,
        body: {
          type: 'object',
          required: ['channel'],
          properties: {
            channel: { type: 'string', enum: ['email', 'sms', 'telegram', 'viber', 'internal'] },
            direction: { type: 'string', enum: ['outbound', 'inbound'] },
            subject: { type: 'string' },
            body: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string }; Body: CreateBookingCommunicationDto }>, reply: FastifyReply) => {
      const dto = CreateCommunicationSchema.parse(req.body);
      const user = getCurrentUser(req);
      const data = await service.createCommunication(req.params.id, dto, user);
      return reply.code(201).send({ data });
    }
  );
}
