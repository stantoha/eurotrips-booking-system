// =============================================================================
// EUROTRIPS — RBAC Guard
// Перевірка ролей та прав доступу (Role-Based Access Control)
//
// Використання:
//   preHandler: [requireAuth, requireRoles('admin', 'manager')]
//   preHandler: [requireAuth, requireOwner('agentId')]
// =============================================================================

import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '../../modules/auth/auth.types';
import { Errors } from '../utils/errors';

type Role = UserRole;

/**
 * Фабрика preHandler: дозволяє тільки вказані ролі.
 *
 * @example
 * preHandler: [requireAuth, requireRoles('admin', 'manager')]
 */
export function requireRoles(...roles: Role[]) {
  return async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = req.user as JwtPayload | undefined;

    if (!user) {
      return reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Необхідна авторизація' },
      });
    }

    if (!roles.includes(user.role)) {
      return reply.code(403).send({
        error: {
          code: 'FORBIDDEN',
          message: `Доступ дозволено тільки для: ${roles.join(', ')}`,
        },
      });
    }
  };
}

/**
 * Перевіряє чи поточний юзер має одну з ролей.
 */
export function hasRole(req: FastifyRequest, ...roles: Role[]): boolean {
  const user = req.user as JwtPayload | undefined;
  return user ? roles.includes(user.role) : false;
}

/**
 * Перевіряє чи є юзер admin або director.
 */
export function isAdminOrDirector(req: FastifyRequest): boolean {
  return hasRole(req, UserRole.admin, UserRole.director);
}

/**
 * Фабрика preHandler: агент бачить тільки свої записи.
 * Якщо role = agent і agentId в params не збігається — 403.
 *
 * @param paramName - назва поля в params або query з agentId
 *
 * @example
 * preHandler: [requireAuth, requireAgentOwner('agentId')]
 */
export function requireAgentOwner(paramName = 'agentId') {
  return async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = req.user as JwtPayload | undefined;
    if (!user) {
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Необхідна авторизація' } });
    }

    // admin та director бачать все
    if (user.role === UserRole.admin || user.role === UserRole.director) return;

    // agent бачить тільки своє
    if (user.role === UserRole.agent) {
      const params = req.params as Record<string, string>;
      const query = req.query as Record<string, string>;
      const targetAgentId = params[paramName] ?? query[paramName];

      if (targetAgentId && targetAgentId !== user.agentId) {
        return reply.code(403).send({
          error: { code: 'FORBIDDEN', message: 'Доступ до чужих даних заборонено' },
        });
      }
    }
  };
}

/**
 * Фабрика preHandler: турист бачить тільки своє бронювання.
 * Для менеджерів та вище — пропускає без перевірки.
 *
 * Використовується разом з перевіркою в сервісі:
 *   if (user.role === 'tourist' && booking.contactTouristId !== tourist.id) throw Forbidden
 */
export function requireTouristOwner() {
  return async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = req.user as JwtPayload | undefined;
    if (!user) {
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Необхідна авторизація' } });
    }

    // Повна перевірка власності відбувається в сервісному шарі
    // (guard тут тільки блокує неавтентифікованих)
  };
}

/**
 * Перевіряє чи може агент редагувати бронювання.
 * BR-06: агент може редагувати тільки до статусу 'pre_booked'
 */
export async function requireAgentBookingEdit(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = req.user as JwtPayload | undefined;
  if (!user) return;

  if (user.role !== UserRole.agent) return; // менеджери можуть завжди

  // Детальна перевірка статусу — в BookingService
  // Тут тільки перевіряємо що це агент
}

// ── Декларація розширення FastifyRequest ────────────────────────────────────
declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}
