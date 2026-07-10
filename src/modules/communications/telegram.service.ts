// =============================================================================
// EUROTRIPS — Telegram Notifications (C5, CLAUDE.md §2)
//
// MVP-обмеження: per-tourist/per-agent Telegram chat_id ще НЕ зберігається
// в БД (потрібна окрема міграція + /start-лінкування бота — Viber так само,
// окремим завданням пізніше). Тому всі нотифікації йдуть в ОДИН внутрішній
// ops-чат (TELEGRAM_OPS_CHAT_ID) — підтвердження бронювання тут це
// інформування менеджера/оператора, а не клієнта.
//
// Токен і chat_id — опційні (Zod-конфіг, config/index.ts). Якщо не задані —
// сервіс тихо no-op'ає (warn-лог), як і existing getEmailQueue() патерн для
// Redis. Помилки Telegram API ніколи не кидаються назовні — виклики звідси
// робляться fire-and-forget з викликаючого коду (bookings.service.ts,
// rooming-trigger.service.ts), збій нотифікації не повинен ламати основний
// запит/скан.
// =============================================================================

import type { PrismaClient } from '@prisma/client';
import { config } from '../../config';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

interface TelegramSendResult {
  success: boolean;
  error?: string;
}

/** Сирий виклик Bot API sendMessage. Не кидає — завжди повертає результат. */
export async function sendTelegramMessage(chatId: string, text: string): Promise<TelegramSendResult> {
  if (!config.TELEGRAM_BOT_TOKEN) {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN не налаштований' };
  }

  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };

    if (!res.ok || !data.ok) {
      return { success: false, error: data.description ?? `Telegram API HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Невідома помилка мережі' };
  }
}

/** Надсилає в ops-чат і логує спробу в communications (BR-11/booking-confirm). */
async function sendToOpsAndLog(
  prisma: PrismaClient,
  logger: { warn: (msg: string, meta?: object) => void },
  params: { text: string; templateId: string; bookingId?: string },
): Promise<void> {
  const chatId = config.TELEGRAM_OPS_CHAT_ID;

  const result: TelegramSendResult = chatId
    ? await sendTelegramMessage(chatId, params.text)
    : { success: false, error: 'TELEGRAM_OPS_CHAT_ID не налаштований' };

  if (!result.success) {
    logger.warn(`Telegram-нотифікація (${params.templateId}) не надіслана: ${result.error}`);
  }

  try {
    await prisma.communication.create({
      data: {
        bookingId:   params.bookingId,
        channel:     'telegram',
        direction:   'outbound',
        body:        params.text,
        templateId:  params.templateId,
        status:      result.success ? 'sent' : 'failed',
        sentAt:      result.success ? new Date() : null,
        errorMessage: result.success ? null : result.error,
      },
    });
  } catch (dbErr) {
    logger.warn(`Не вдалося записати communication лог: ${dbErr instanceof Error ? dbErr.message : dbErr}`);
  }
}

/** Тригер: booking.status → 'confirmed'. Кличеться поруч з email-тригером. */
export async function notifyBookingConfirmed(
  prisma: PrismaClient,
  logger: { warn: (msg: string, meta?: object) => void },
  bookingId: string,
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { bookingNumber: true, tour: { select: { name: true, code: true } } },
  });
  if (!booking) return;

  const text =
    `✅ <b>Бронювання підтверджено</b>\n` +
    `${booking.bookingNumber} — ${booking.tour.name} (${booking.tour.code})`;

  await sendToOpsAndLog(prisma, logger, { text, templateId: 'booking_confirmed', bookingId });
}

/** Тригер: BR-11 rooming trigger (rooming-trigger.service.ts::scanRoomingTriggers). */
export async function notifyRoomingRequired(
  prisma: PrismaClient,
  logger: { warn: (msg: string, meta?: object) => void },
  params: { tourCode: string; reason: 'confirmed_tourists' | 'departure_proximity'; confirmedTourists: number; daysToDeparture: number },
): Promise<void> {
  const reasonText = params.reason === 'confirmed_tourists'
    ? `${params.confirmedTourists} підтверджених туристів (поріг 30)`
    : `${params.daysToDeparture} дн. до виїзду (поріг 14)`;

  const text =
    `🛏 <b>BR-11: потрібен румінг</b>\n` +
    `Тур ${params.tourCode} — ${reasonText}`;

  await sendToOpsAndLog(prisma, logger, { text, templateId: 'rooming_required' });
}
