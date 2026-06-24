// =============================================================
// EUROTRIPS — Zoho CRM Webhook Handler v2.0
// Маршрут: POST /webhooks/zoho  (публічний, без JWT)
//
// Налаштування в Zoho CRM:
//   Setup → Developer Space → Notifications → New Notification
//   URL:    https://api.eurotrips.ua/webhooks/zoho
//   Events: Deals.edit, Leads.edit, Contacts.edit
//   Method: POST
//   Headers: X-Zoho-Webhook-Token: {ZOHO_WEBHOOK_TOKEN}
//
// ENV:
//   ZOHO_WEBHOOK_TOKEN=<секретний токен з Zoho Notifications>
//
// ADR-003 Варіант A: Tour = Departure (поточна модель)
//   Deals → bookings (статус синхронізується через ZOHO_DEAL_STAGE_MAP)
//   Contacts → tourists (нові поля: allergies, dateOfBirth з ADR-003)
//   Leads → leads (статус + source)
// =============================================================

import type { FastifyInstance } from 'fastify';
import crypto                  from 'node:crypto';
import { Queue }               from 'bullmq';
import IORedis                 from 'ioredis';
import {
  ZOHO_DEAL_STAGE_MAP,
  ZOHO_LEAD_STATUS_MAP,
  ZOHO_LEAD_SOURCE_MAP,
} from './zoho.types';

// ─── ENV ─────────────────────────────────────────────────────

const ZOHO_WEBHOOK_TOKEN  = process.env.ZOHO_WEBHOOK_TOKEN   ?? '';
const ZOHO_WEBHOOK_SECRET = process.env.ZOHO_WEBHOOK_SECRET  ?? '';

// ─── Zoho Notification payload shape ─────────────────────────

/**
 * Структура тіла webhook від Zoho CRM Notifications API.
 * Zoho надсилає масив змінених записів одразу.
 */
interface ZohoNotificationPayload {
  /** Назва модуля: "Deals" | "Leads" | "Contacts" */
  module?: string;
  /** Тип події: "edit" | "create" | "delete" */
  operation?: string;
  /** IDs змінених записів */
  ids?: string[];
  /** Повні дані записів (якщо налаштовано "Send Data") */
  data?: Record<string, unknown>[];
  /** Timestamp події */
  timestamp?: number;
  /** Notification channel ID */
  channel_id?: string;
  /** Zoho channel token для додаткової верифікації */
  token?: string;
}

// ─── BullMQ queue для sync-задач ─────────────────────────────

interface ZohoSyncJobData {
  module:    string;
  operation: string;
  zohoId:    string;
  payload?:  Record<string, unknown>;
}

type ZohoSyncJobName = 'sync:deal' | 'sync:lead' | 'sync:contact';

let syncQueue: Queue<ZohoSyncJobData, void, ZohoSyncJobName> | null = null;

function getSyncQueue(): Queue<ZohoSyncJobData, void, ZohoSyncJobName> {
  if (!syncQueue) {
    const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      enableReadyCheck: false, maxRetriesPerRequest: null,
    });
    syncQueue = new Queue<ZohoSyncJobData, void, ZohoSyncJobName>('zoho-sync', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 }, // 30s → 1m → 2m
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail:     { age: 7 * 24 * 3600 },
      },
    });
  }
  return syncQueue;
}

// ─── Signature verification ───────────────────────────────────

/**
 * Перевіряє HMAC-SHA256 підпис Zoho webhook (якщо ZOHO_WEBHOOK_SECRET встановлено).
 * Zoho підписує: HMAC-SHA256(body_string, webhook_secret)
 * Передається в заголовку X-Zoho-Signature
 */
function verifyZohoSignature(rawBody: string, receivedSignature: string): boolean {
  if (!ZOHO_WEBHOOK_SECRET) return true; // підпис не налаштовано
  const expected = crypto
    .createHmac('sha256', ZOHO_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(receivedSignature));
  } catch {
    return false;
  }
}

// ─── Inline sync helpers ──────────────────────────────────────
// Використовуються коли payload містить повні дані запису
// (Zoho Notifications → "Send Data" = ON)

/**
 * Синхронізує Deal з локальним booking.
 * Зміни статусу Deal → booking.status через ZOHO_DEAL_STAGE_MAP.
 * ADR-003: Tour = Departure модель залишається.
 */
async function syncDealToBooking(
  prisma: FastifyInstance['prisma'],
  logger: FastifyInstance['log'],
  zohoId: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  const externalId = `zoho_deal_${zohoId}`;
  const booking    = await prisma.booking.findFirst({ where: { externalId } });

  if (!booking) {
    logger.debug({ zohoId }, 'syncDeal: бронювання ще немає — пропускаємо (можливо ще не мігровано)');
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (payload?.Stage) {
    const newStatus = ZOHO_DEAL_STAGE_MAP[payload.Stage as string];
    if (newStatus && newStatus !== booking.status) {
      // BR-06: перевіряємо допустимість переходу
      if (isValidStatusTransition(booking.status, newStatus)) {
        updates.status = newStatus;
        logger.info({ zohoId, from: booking.status, to: newStatus },
          'Zoho sync: статус бронювання оновлено');
      } else {
        logger.warn({ zohoId, from: booking.status, to: newStatus },
          'Zoho sync: недопустимий перехід статусу — ігноруємо');
      }
    }
  }

  if (payload?.Adults_count !== undefined) {
    updates.adultsCount = payload.Adults_count ? Number(payload.Adults_count) : null;
  }
  if (payload?.Children_count !== undefined) {
    updates.childrenCount = payload.Children_count ? Number(payload.Children_count) : null;
  }

  if (Object.keys(updates).length > 1) { // є щось крім updatedAt
    await prisma.booking.update({ where: { id: booking.id }, data: updates });
  }
}

/**
 * Синхронізує Lead з локальним leads.status.
 * Нові ліди з Zoho → create якщо ще немає.
 */
async function syncLeadToLead(
  prisma: FastifyInstance['prisma'],
  logger: FastifyInstance['log'],
  zohoId: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  const externalId = `zoho_lead_${zohoId}`;
  const existing   = await prisma.lead.findFirst({ where: { externalId } });
  const newStatus  = payload?.Lead_Status
    ? (ZOHO_LEAD_STATUS_MAP[payload.Lead_Status as string] ?? 'in_work')
    : null;

  if (existing) {
    if (newStatus && newStatus !== existing.status) {
      await prisma.lead.update({
        where: { externalId },
        data:  { status: newStatus, updatedAt: new Date() },
      });
      logger.info({ zohoId, newStatus }, 'Zoho sync: статус ліда оновлено');
    }
  } else {
    // Новий лід — створюємо
    await prisma.lead.create({
      data: {
        externalId,
        email:    (payload?.Email as string)  ?? null,
        phone:    (payload?.Phone as string)  ?? null,
        source:   payload?.Lead_Source
          ? (ZOHO_LEAD_SOURCE_MAP[payload.Lead_Source as string] ?? 'other')
          : 'other',
        status:   newStatus ?? 'new',
        paxCount: 1,
        metadata: {
          zoho_id: zohoId, synced_from_webhook: true, migrated_at: new Date().toISOString(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    logger.info({ zohoId }, 'Zoho sync: новий лід створено');
  }
}

/**
 * Синхронізує Contact → tourist.
 * Оновлює контактні дані, алергії, харчові обмеження (ADR-003/INS).
 * НЕ перезаписує вручну виправлені поля.
 */
async function syncContactToTourist(
  prisma: FastifyInstance['prisma'],
  logger: FastifyInstance['log'],
  zohoId: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  const externalId = `zoho_contact_${zohoId}`;
  const existing   = await prisma.tourist.findFirst({ where: { externalId } });

  if (!existing) {
    logger.debug({ zohoId }, 'syncContact: турист ще не мігрований — пропускаємо');
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  // Оновлюємо тільки поля що прийшли і НЕ порожні
  if (payload?.Allergic_reaction !== undefined)
    updates.allergies = payload.Allergic_reaction || null;

  if (payload?.Dietary_restriction !== undefined)
    updates.dietaryRestrictions = payload.Dietary_restriction || null;

  if (payload?.Date_of_Birth !== undefined && payload.Date_of_Birth)
    updates.dateOfBirth = new Date(payload.Date_of_Birth as string);

  if (payload?.Subscribed !== undefined)
    updates.isSubscribed = Boolean(payload.Subscribed);

  if (Object.keys(updates).length > 1) {
    await prisma.tourist.update({ where: { id: existing.id }, data: updates });
    logger.info({ zohoId, fields: Object.keys(updates) }, 'Zoho sync: туриста оновлено');
  }
}

// ─── BR-06 ── статусна машина ─────────────────────────────────

/** Перевіряє допустимість переходу статусу (BR-06) */
function isValidStatusTransition(from: string, to: string): boolean {
  const VALID: Record<string, string[]> = {
    new:               ['in_work', 'pre_booked', 'awaiting_payment', 'cancelled_client'],
    in_work:           ['pre_booked', 'awaiting_payment', 'cancelled_client'],
    pre_booked:        ['awaiting_payment', 'cancelled_client', 'cancelled_operator'],
    awaiting_payment:  ['partially_paid', 'confirmed', 'cancelled_client', 'cancelled_operator'],
    partially_paid:    ['confirmed', 'awaiting_payment', 'cancelled_client', 'cancelled_operator'],
    confirmed:         ['docs_collected', 'cancelled_client', 'cancelled_operator'],
    docs_collected:    ['ready_to_depart', 'cancelled_client', 'cancelled_operator'],
    ready_to_depart:   ['on_trip', 'cancelled_client', 'cancelled_operator'],
    on_trip:           ['completed'],
    completed:         [],
    cancelled_client:  ['refund'],
    cancelled_operator:['refund'],
    no_show:           [],
    refund:            [],
  };
  return (VALID[from] ?? []).includes(to);
}

// ─── Fastify routes ───────────────────────────────────────────

export async function zohoWebhookRoutes(app: FastifyInstance): Promise<void> {

  /**
   * POST /webhooks/zoho
   *
   * Zoho надсилає тіло у JSON.
   * Завжди повертає 200 — Zoho ретраїть при non-2xx.
   *
   * Верифікація (два рівні):
   *   1. X-Zoho-Webhook-Token (порівняння з ZOHO_WEBHOOK_TOKEN)
   *   2. X-Zoho-Signature (HMAC-SHA256, якщо ZOHO_WEBHOOK_SECRET встановлено)
   */
  app.post<{ Body: ZohoNotificationPayload }>(
    '/',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      schema: {
        hide: true,
        body: { type: 'object', additionalProperties: true },
      },
    },
    async (req, reply) => {
      const body = req.body as ZohoNotificationPayload;

      // ── Верифікація токена ────────────────────────────────────
      if (ZOHO_WEBHOOK_TOKEN) {
        const receivedToken =
          (req.headers['x-zoho-webhook-token'] as string | undefined) ??
          (req.headers['x-webhook-token']       as string | undefined) ??
          body.token;

        if (receivedToken !== ZOHO_WEBHOOK_TOKEN) {
          req.log.warn({ ip: req.ip }, 'Zoho webhook: невірний токен — відхилено');
          return reply.code(200).send({ received: false, reason: 'invalid_token' });
        }
      }

      // ── Верифікація підпису (якщо налаштовано) ────────────────
      if (ZOHO_WEBHOOK_SECRET) {
        const receivedSig = req.headers['x-zoho-signature'] as string | undefined;
        const rawBody     = JSON.stringify(body); // Zoho підписує raw body
        if (!receivedSig || !verifyZohoSignature(rawBody, receivedSig)) {
          req.log.warn({ ip: req.ip }, 'Zoho webhook: невірний підпис — відхилено');
          return reply.code(200).send({ received: false, reason: 'invalid_signature' });
        }
      }

      const { module: crmModule, operation, ids = [], data: payloads = [] } = body;

      if (!crmModule || !operation) {
        req.log.warn({ body }, 'Zoho webhook: відсутній module або operation');
        return reply.code(200).send({ received: true, skipped: 'no_module' });
      }

      req.log.info(
        { module: crmModule, operation, count: ids.length },
        `Zoho webhook: ${crmModule}.${operation} (${ids.length} записів)`,
      );

      // ── Обробка ───────────────────────────────────────────────
      // Для кожного ID ставимо job у BullMQ (async, non-blocking)
      // Або виконуємо inline якщо прийшли повні дані (data array)
      const queue = getSyncQueue();

      for (let i = 0; i < ids.length; i++) {
        const zohoId  = ids[i];
        const payload = payloads[i] as Record<string, unknown> | undefined;

        // Якщо прийшли повні дані — оновлюємо inline (швидко)
        if (payload && Object.keys(payload).length > 2) {
          try {
            if (crmModule === 'Deals') {
              await syncDealToBooking(app.prisma, req.log, zohoId, payload);
            } else if (crmModule === 'Leads') {
              await syncLeadToLead(app.prisma, req.log, zohoId, payload);
            } else if (crmModule === 'Contacts') {
              await syncContactToTourist(app.prisma, req.log, zohoId, payload);
            }
          } catch (err: any) {
            req.log.error({ err: err.message, zohoId, module: crmModule },
              'Zoho sync inline: помилка');
            // Ставимо в чергу для повтору
            await queue.add(
              `sync:${crmModule.toLowerCase().replace(/s$/, '')}` as ZohoSyncJobName,
              { module: crmModule, operation, zohoId, payload },
              { jobId: `zoho-sync:${crmModule}:${zohoId}:${Date.now()}` },
            );
          }
        } else {
          // Даних немає — ставимо задачу в BullMQ для повного рефетчу з Zoho
          const jobName = `sync:${crmModule === 'Deals' ? 'deal'
            : crmModule === 'Leads' ? 'lead' : 'contact'}` as ZohoSyncJobName;

          await queue.add(
            jobName,
            { module: crmModule, operation, zohoId },
            {
              // Унікальний jobId — дедуплікація якщо Zoho ретраїть той самий ID
              jobId: `zoho-sync:${crmModule}:${zohoId}`,
              delay: 2_000, // 2 сек затримка, щоб Zoho встигнув зберегти зміну
            },
          );
          req.log.debug({ zohoId, jobName }, 'Zoho sync: задача поставлена в чергу');
        }
      }

      // Zoho вимагає 200 незалежно від результату
      return reply.code(200).send({ received: true, processed: ids.length });
    },
  );

  /**
   * GET /webhooks/zoho/health
   * Ping для перевірки що webhook endpoint доступний.
   * Використовується Zoho при реєстрації notification.
   */
  app.get('/health', async (_req, reply) => {
    return reply.code(200).send({
      status: 'ok',
      service: 'zoho-webhook',
      timestamp: new Date().toISOString(),
    });
  });
}
