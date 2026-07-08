// =============================================================================
// EUROTRIPS — Точка входу Fastify
// =============================================================================

import Fastify from 'fastify';
import { buildApp } from './app';
import { config } from './config';
import prisma from './shared/database/prisma';
import { startRoomingTriggerWorker } from './modules/tours/rooming-trigger.worker';
import { createRoomingScanQueue, scheduleRoomingScan } from './modules/tours/rooming-trigger.queue';

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

  // ── BullMQ воркери (single-process деплой на Railway — startCommand
  //    запускає лише цей процес, тому воркери стартують всередині нього) ──
  // ПРИМІТКА: email.worker.ts свідомо НЕ підключається тут — виключений
  // з tsconfig.build.json через давні непов'язані type-помилки в
  // email.service.ts (не з цієї сесії). Підключити після окремого фіксу.
  // if (config.REDIS_URL) {
  //   const roomingWorker = startRoomingTriggerWorker(prisma, app.log);
  //   const roomingScanQueue = createRoomingScanQueue();
  //   await scheduleRoomingScan(roomingScanQueue);

  //   app.addHook('onClose', async () => {
  //     await roomingWorker.close();
  //     await roomingScanQueue.close();
  //   });
  // } else {
  //   app.log.warn('REDIS_URL не задано — BullMQ воркер BR-11 (rooming trigger) не запущено');
  // }

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
