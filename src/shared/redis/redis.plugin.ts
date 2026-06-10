// =============================================================================
// EUROTRIPS — Redis Client (Fastify Plugin)
// Декорує app.redis для використання в сервісах
// =============================================================================

import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';
import { config } from '../../config';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

async function redisPlugin(app: FastifyInstance) {
  const redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableReadyCheck: true,
  });

  redis.on('connect', () => app.log.info('✅ Redis підключено'));
  redis.on('error', (err) => app.log.error({ err }, '❌ Redis помилка'));
  redis.on('reconnecting', () => app.log.warn('🔄 Redis перепідключення...'));

  await redis.connect();

  app.decorate('redis', redis);

  app.addHook('onClose', async () => {
    await redis.quit();
    app.log.info('Redis з\'єднання закрито');
  });
}

export default fp(redisPlugin, {
  name: 'redis',
  fastify: '4.x',
});
