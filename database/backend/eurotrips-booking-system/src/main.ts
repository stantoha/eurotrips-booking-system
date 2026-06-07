// =============================================================================
// EUROTRIPS — Точка входу Fastify
// =============================================================================

import Fastify from 'fastify';
import { buildApp } from './app';
import { config } from './config';

async function bootstrap() {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport:
        config.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss Z' } }
          : undefined,
    },
    trustProxy: true,
  });

  await buildApp(app);

  try {
    await app.listen({ port: config.APP_PORT, host: config.APP_HOST });
    app.log.info(`🚀 Eurotrips API запущено: http://${config.APP_HOST}:${config.APP_PORT}`);
    app.log.info(`📚 Swagger UI: http://${config.APP_HOST}:${config.APP_PORT}/documentation`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
