// =============================================================================
// EUROTRIPS — Redis Client (Fastify Plugin)
// Декорує app.redis для використання в сервісах
// Опціональний: якщо REDIS_URL не задано — app.redis = null (MVP mode)
// =============================================================================

import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';
import { config } from '../../config';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis | null;
  }
}

async function redisPlugin(app: FastifyInstance) {
  if (!config.REDIS_URL) {
    app.log.warn('⚠️ REDIS_URL не задано — Redis вимкнено (MVP mode)');
    app.decorate('redis', null);
    return;
  }

  const redis = new Redis(config.REDIS_URL, {
    lazyConnect: true,
    enableReadyCheck: false,   // без auto-ping: інакше unhandled rejection при drop
    maxRetriesPerRequest: null,
    retryStrategy: (times) => (times >= 5 ? null : Math.min(times * 500, 3000)),
  });

  redis.on('error', (err) => app.log.warn({ err }, '⚠️ Redis помилка'));
  redis.on('connect', () => app.log.info('✅ Redis підключено'));
  redis.on('reconnecting', () => app.log.warn('🔄 Redis перепідключення...'));

  try {
    await redis.connect();
    await redis.ping();       // ручна перевірка що з'єднання справді живе
    app.log.info('✅ Redis готовий');
    app.decorate('redis', redis);
    app.addHook('onClose', async () => {
      redis.disconnect();
      app.log.info("Redis з'єднання закрито");
    });
  } catch (err) {
    app.log.warn({ err }, "⚠️ Redis недоступний — вимикаємо (MVP mode)");
    try { redis.disconnect(); } catch { /* ігноруємо */ }
    app.decorate('redis', null);
  }
}

export default fp(redisPlugin, {
  name: 'redis',
  fastify: '4.x',
});
