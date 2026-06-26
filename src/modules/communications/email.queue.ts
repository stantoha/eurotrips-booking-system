// =============================================================
// EUROTRIPS — Email Queue (BullMQ)
// Черга для асинхронної відправки email після зміни статусів
//
// Підключення до Redis: ioredis (спільний з liqpay worker)
// Queue name: 'email-notifications'
//
// Використання з bookings.service.ts:
//   import { emailQueue } from '../integrations/email/email.queue';
//
//   // після зміни статусу на 'confirmed':
//   await emailQueue.add('booking:confirmed', { bookingId });
//
//   // нагадування (планується з BullMQ scheduler):
//   await emailQueue.add('payment:reminder', { bookingId, daysLeft: 3 }, {
//     delay: msUntilReminder,
//   });
// =============================================================

import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

// ─── Job типи ────────────────────────────────────────────────

/**
 * Назви job'ів у черзі.
 * Відповідають тригерним подіям із bookings.service.ts.
 */
export type EmailJobName =
  | 'booking:confirmed'    // booking.status → 'confirmed'
  | 'payment:reminder'     // scheduler: 7/3/1 день до payment_deadline
  | 'pre:departure'        // scheduler: 3 дні до departure_date
  | 'payment:received'     // liqpay webhook → success
  | 'booking:cancelled';   // booking.status → cancelled_*

/**
 * Дані, що передаються у кожний job.
 * Зберігаємо тільки bookingId — сервіс сам завантажить дані з БД.
 * Це дозволяє уникнути stale data якщо job виконається із затримкою.
 */
export interface EmailJobData {
  bookingId:      string;
  daysLeft?:      number;                         // тільки для payment:reminder
  paymentAmount?: number;                         // тільки для payment:received
  cancelledBy?:   'client' | 'operator';          // тільки для booking:cancelled
  refundAmount?:  number;                         // тільки для booking:cancelled
}

// ─── Redis connection ────────────────────────────────────────

/**
 * Singleton Redis connection для BullMQ.
 * BullMQ вимагає окремий connection (не shared з app).
 * enableReadyCheck: false та maxRetriesPerRequest: null обов'язкові для BullMQ.
 */
export function createRedisConnection(): IORedis {
  return new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    enableReadyCheck:    false,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 500, 5_000),
  });
}

// ─── Default job options ─────────────────────────────────────

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type:  'exponential' as const,
    delay: 5 * 60 * 1000,   // 5хв → 10хв → 20хв
  },
  removeOnComplete: {
    age:   7 * 24 * 3600,    // зберігаємо 7 днів для аудиту
    count: 500,
  },
  removeOnFail: {
    age: 30 * 24 * 3600,     // помилки зберігаємо 30 днів для дебагу
  },
};

// ─── Фабрика черги ───────────────────────────────────────────

/**
 * Створює BullMQ Queue для email-нотифікацій.
 *
 * @example
 *   // У Fastify plugin або модулі ініціалізації:
 *   export const emailQueue = createEmailQueue();
 */
export type EmailQueue = Queue<EmailJobData, void, string>;

export function createEmailQueue(connection?: IORedis): EmailQueue {
  const conn = connection ?? createRedisConnection();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Queue<EmailJobData, void, string>('email-notifications', {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection:        conn as any,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  }) as EmailQueue;
}

// ─── Singleton (для використання поза Fastify контекстом) ────

let _emailQueue: EmailQueue | null = null;

export function getEmailQueue(): EmailQueue | null {
  if (!process.env.REDIS_URL) {
    return null;
  }
  if (!_emailQueue) {
    _emailQueue = createEmailQueue();
  }
  return _emailQueue;
}

// ─── Queue Events (моніторинг) ───────────────────────────────

/**
 * Підключає слухачів подій черги для моніторингу.
 * Викликати один раз при старті сервісу.
 *
 * @example
 *   const events = attachEmailQueueEvents(connection, logger);
 *   // закрити при shutdown:
 *   await events.close();
 */
export function attachEmailQueueEvents(
  connection: IORedis,
  logger: { info: (msg: string, meta?: object) => void; error: (msg: string, meta?: object) => void; warn: (msg: string, meta?: object) => void },
): QueueEvents {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = new QueueEvents('email-notifications', { connection: connection as any });

  events.on('completed', ({ jobId }) => {
    logger.info(`Email job completed`, { jobId });
  });

  events.on('failed', ({ jobId, failedReason }) => {
    logger.error(`Email job failed`, { jobId, reason: failedReason });
  });

  events.on('stalled', ({ jobId }) => {
    logger.warn(`Email job stalled (буде повторено)`, { jobId });
  });

  return events;
}

// ─── Helpers: планування повторюваних нагадувань ─────────────

/**
 * Планує серію нагадувань про оплату: за 7, 3 та 1 день до дедлайну.
 * Викликати після підтвердження бронювання (status → 'confirmed').
 *
 * @example
 *   await schedulePaymentReminders(emailQueue, bookingId, paymentDeadline);
 */
export async function schedulePaymentReminders(
  queue: EmailQueue,
  bookingId: string,
  paymentDeadline: Date,
): Promise<void> {
  const now        = Date.now();
  const deadline   = paymentDeadline.getTime();
  const reminders  = [7, 3, 1];  // дні до дедлайну

  for (const daysLeft of reminders) {
    const sendAt = deadline - daysLeft * 24 * 60 * 60 * 1000;
    const delay  = sendAt - now;

    // Пропускаємо якщо момент вже в минулому
    if (delay <= 0) continue;

    await queue.add(
      'payment:reminder',
      { bookingId, daysLeft },
      {
        delay,
        jobId: `payment-reminder:${bookingId}:${daysLeft}d`,   // унікальний ID — дедуплікація
        ...DEFAULT_JOB_OPTIONS,
      },
    );
  }
}

/**
 * Планує email "інфолист перед виїздом" за 3 дні до дати виїзду.
 *
 * @example
 *   await schedulePreDepartureEmail(emailQueue, bookingId, departureDate);
 */
export async function schedulePreDepartureEmail(
  queue: EmailQueue,
  bookingId: string,
  departureDate: Date,
): Promise<void> {
  const now        = Date.now();
  const departure  = departureDate.getTime();
  const sendAt     = departure - 3 * 24 * 60 * 60 * 1000; // -3 дні
  const delay      = sendAt - now;

  if (delay <= 0) return;  // виїзд вже скоро або в минулому

  await queue.add(
    'pre:departure',
    { bookingId },
    {
      delay,
      jobId: `pre-departure:${bookingId}`,
      ...DEFAULT_JOB_OPTIONS,
    },
  );
}

/**
 * Скасовує всі заплановані email jobs для бронювання.
 * Викликати при скасуванні бронювання (status → cancelled_*).
 *
 * @example
 *   await cancelBookingEmailJobs(emailQueue, bookingId);
 */
export async function cancelBookingEmailJobs(
  queue: EmailQueue,
  bookingId: string,
): Promise<void> {
  const jobIds = [
    `payment-reminder:${bookingId}:7d`,
    `payment-reminder:${bookingId}:3d`,
    `payment-reminder:${bookingId}:1d`,
    `pre-departure:${bookingId}`,
  ];

  for (const jobId of jobIds) {
    const job = await queue.getJob(jobId);
    if (job) await job.remove();
  }
}
