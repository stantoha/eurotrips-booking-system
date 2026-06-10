// =============================================================================
// EUROTRIPS — JWT Guard
// preHandler для Fastify маршрутів: requireAuth, optionalAuth
// TC-AUTH-015: перевірка Redis blacklist після logout
// =============================================================================

import { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../../modules/auth/auth.types';

/**
 * preHandler: вимагає валідний JWT.
 * Перевіряє підпис + Redis blacklist (після logout → 401).
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

  // Перевірка Redis blacklist — чи не був логаут після видачі цього токену
  const payload = req.user as JwtPayload;
  const blacklistKey = `jwt:blacklist:${payload.sub}`;

  try {
    const blacklistedAt = await (req.server as any).redis.get(blacklistKey);
    if (blacklistedAt) {
      const tokenIat = payload.iat ?? 0;
      const logoutAt = parseInt(blacklistedAt, 10);
      if (tokenIat <= logoutAt) {
        return reply.code(401).send({
          error: {
            code: 'TOKEN_REVOKED',
            message: 'Токен відкликано. Будь ласка, увійдіть знову.',
          },
        });
      }
    }
  } catch {
    // Redis недоступний — пропускаємо (graceful degradation)
  }
}

/**
 * preHandler: якщо токен є — верифікує, якщо немає — пропускає.
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
