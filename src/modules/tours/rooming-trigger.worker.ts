// =============================================================================
// EUROTRIPS — Rooming Trigger Worker (BullMQ)
// Обробляє повторюваний 'scan' job з черги 'ops-rooming-trigger' (BR-11).
//
// Підключення до Fastify (single-process деплой на Railway):
//   import { startRoomingTriggerWorker } from './rooming-trigger.worker';
//   const worker = startRoomingTriggerWorker(prisma, logger);
//   app.addHook('onClose', async () => worker.close());
// =============================================================================

import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { createRedisConnection } from '../communications/email.queue';
import { scanRoomingTriggers } from './rooming-trigger.service';

export function startRoomingTriggerWorker(
  prisma: PrismaClient,
  logger: { info: Function; warn: Function; error: Function },
): Worker {
  const connection = createRedisConnection();

  const worker = new Worker(
    'ops-rooming-trigger',
    async () => {
      const triggered = await scanRoomingTriggers(prisma, logger as any);
      return { triggeredCount: triggered.length };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { connection: connection as any, concurrency: 1 }
  );

  worker.on('completed', (job, result) => {
    if (result?.triggeredCount > 0) {
      logger.info(`🛏 BR-11 скан завершено: ${result.triggeredCount} тур(и) потребують румінгу`);
    }
  });

  worker.on('failed', (job, err) => {
    logger.error({ err: err.message }, '❌ BR-11 rooming scan job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err: err.message }, 'Rooming Trigger Worker: Redis connection error');
  });

  logger.info('🛏 Rooming Trigger Worker запущено (queue: ops-rooming-trigger)');
  return worker;
}
