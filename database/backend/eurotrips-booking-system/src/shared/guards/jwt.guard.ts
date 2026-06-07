// =============================================================================
// EUROTRIPS — JWT Guard
// preHandler для Fastify маршрутів: requireAuth, optionalAuth
// =============================================================================

import { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../../modules/auth/auth.types';

/**
 * preHandler: вимагає валідний JWT.
 * Кидає 401 якщо токен відсутній або невалідний.
 */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Необхідна авторизація. Будь ласка, увійдіть в систему.',
      },
    });
  }
}

/**
 * preHandler: якщо токен є — верифікує, якщо немає — пропускає.
 * Корисно для публічних маршрутів з опціональною персоналізацією.
 */
export async function optionalAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    // Ігноруємо — токен не обов'язковий
  }
}

/**
 * Отримати поточного юзера з request (після requireAuth)
 */
export function getCurrentUser(req: FastifyRequest): JwtPayload {
  return req.user as JwtPayload;
}
