// =============================================================
// EUROTRIPS — Email Worker (BullMQ)
//
// Обробляє job'и з черги 'email-notifications'.
// Запускається як окремий процес або всередині Fastify.
//
// Запуск standalone:
//   npx ts-node src/modules/integrations/email/email.worker.ts
//
// Підключення до Fastify:
//   import { startEmailWorker } from './email.worker';
//   const worker = startEmailWorker(prisma, logger);
//   fastify.addHook('onClose', async () => worker.close());
//
// Як додати тригер в bookings.service.ts:
//   import { getEmailQueue, schedulePaymentReminders } from './email.queue';
//
//   // після booking.status → 'confirmed':
//   const queue = getEmailQueue();
//   await queue.add('booking:confirmed', { bookingId: booking.id });
//   await schedulePaymentReminders(queue, booking.id, booking.paymentDeadline);
//   await schedulePreDepartureEmail(queue, booking.id, booking.tour.departureDate);
// =============================================================

import 'dotenv/config';
import { Worker, type Job } from 'bullmq';
import pino                 from 'pino';
import { PrismaClient }     from '@prisma/client';
import { EmailService }     from './email.service';
import {
  createRedisConnection,
  type EmailJobData,
  type EmailJobName,
} from './email.queue';

// ─── Logger ──────────────────────────────────────────────────

const workerLogger = pino({
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  name: 'email-worker',
});

// ─── Job processor ────────────────────────────────────────────

/**
 * Обробляє один job із черги email-notifications.
 * Всі помилки обробляються всередині EmailService.
 * Кинуте виключення → BullMQ зробить retry.
 */
async function processEmailJob(
  job: Job<EmailJobData, void, EmailJobName>,
  emailService: EmailService,
): Promise<void> {
  const { bookingId, daysLeft, paymentAmount, cancelledBy, refundAmount } = job.data;

  workerLogger.info(
    { jobId: job.id, jobName: job.name, bookingId, attempt: job.attemptsMade + 1 },
    `📨 Email job: ${job.name}`,
  );

  switch (job.name) {

    case 'booking:confirmed':
      await emailService.sendBookingConfirmation(bookingId);
      break;

    case 'payment:reminder':
      if (typeof daysLeft !== 'number') {
        workerLogger.error({ jobId: job.id }, 'payment:reminder: daysLeft відсутній у job.data');
        return;  // не кидаємо — invalid data не варта ретраю
      }
      await emailService.sendPaymentReminder(bookingId, daysLeft);
      break;

    case 'pre:departure':
      await emailService.sendPreDepartureInfo(bookingId);
      break;

    case 'payment:received':
      // Заглушка — може бути реалізована пізніше
      workerLogger.info({ bookingId, paymentAmount }, 'payment:received job — TODO');
      break;

    case 'booking:cancelled':
      // Заглушка — може бути реалізована пізніше
      workerLogger.info({ bookingId, cancelledBy, refundAmount }, 'booking:cancelled job — TODO');
      break;

    default:
      workerLogger.warn({ jobName: job.name }, 'Невідомий тип email job — пропускаємо');
  }
}

// ─── Worker factory ───────────────────────────────────────────

/**
 * Запускає BullMQ Worker для обробки email job'ів.
 *
 * @param prisma   Prisma client (ін'єктується з Fastify або самостійно)
 * @param logger   Fastify-сумісний logger (або pino)
 * @returns        Worker instance (для graceful shutdown)
 */
export function startEmailWorker(
  prisma: PrismaClient,
  logger: { info: Function; warn: Function; error: Function },
): Worker<EmailJobData, void, EmailJobName> {
  const connection  = createRedisConnection();
  const emailService = new EmailService(prisma, logger as any);

  const worker = new Worker<EmailJobData, void, EmailJobName>(
    'email-notifications',
    async (job) => processEmailJob(job, emailService),
    {
      connection,
      concurrency: 5,           // 5 паралельних email-відправок
      limiter: {
        max:      10,           // max 10 jobs за
        duration: 1_000,        // 1 секунду (Brevo rate limit: 10 req/s)
      },
    },
  );

  // ─── Event handlers ────────────────────────────────────────

  worker.on('completed', (job) => {
    logger.info(`✅ Email job completed: ${job.name} (bookingId: ${job.data.bookingId})`);
  });

  worker.on('failed', (job, err) => {
    const data = job?.data;
    logger.error(
      { jobId: job?.id, jobName: job?.name, bookingId: data?.bookingId,
        attempt: (job?.attemptsMade ?? 0) + 1, err: err.message },
      `❌ Email job failed: ${job?.name}`,
    );
  });

  worker.on('error', (err) => {
    logger.error({ err: err.message }, 'Email Worker: Redis connection error');
  });

  worker.on('stalled', (jobId) => {
    logger.warn({ jobId }, 'Email job stalled — BullMQ відновить автоматично');
  });

  logger.info('📮 Email Worker запущено (queue: email-notifications)');
  return worker;
}

// ─── Standalone entry point ───────────────────────────────────

if (require.main === module) {
  const prisma = new PrismaClient();

  const worker = startEmailWorker(prisma, workerLogger as any);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    workerLogger.info(`${signal}: закриваємо Email Worker...`);
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}
