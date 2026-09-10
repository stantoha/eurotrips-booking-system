// =============================================================================
// EUROTRIPS — верифікація токена вхідного вебхука
//
// Проблема, яку це закриває. У zoho.webhook.ts перевірка виглядала так:
//
//     const ZOHO_WEBHOOK_TOKEN = process.env.ZOHO_WEBHOOK_TOKEN ?? '';
//     if (ZOHO_WEBHOOK_TOKEN) { ...перевірити... }
//
// При незаданій змінній умова хибна, перевірка просто не виконується, і
// ендпоінт приймає будь-який запит без автентифікації. Відсутність секрету
// має бути ПОМИЛКОЮ, а не приводом пропустити перевірку.
//
// Порівняння — constant-time. Наївне `a === b` виходить із циклу на першому
// розбіжному байті, і за часом відповіді токен можна підібрати посимвольно.
// timingSafeEqual вимагає буферів однакової довжини, тому порівнюємо не самі
// токени, а їхні SHA-256 — вони завжди по 32 байти, і довжина секрету не
// протікає.
// =============================================================================

import crypto from 'node:crypto';

export type WebhookTokenResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' | 'missing_token' | 'invalid_token' };

/** Заголовки, у яких Zoho може принести токен. */
export const WEBHOOK_TOKEN_HEADERS = [
  'x-zoho-webhook-token',
  'x-webhook-token',
] as const;

function sha256(v: string): Buffer {
  return crypto.createHash('sha256').update(v, 'utf8').digest();
}

/**
 * Порівнює два секрети за постійний час.
 * Порожній рядок з будь-якого боку — завжди false.
 */
export function safeCompareSecrets(a: string, b: string): boolean {
  if (!a || !b) return false;
  return crypto.timingSafeEqual(sha256(a), sha256(b));
}

/**
 * Перевіряє токен вхідного вебхука.
 *
 * Повертає структуру, а не кидає — викликач сам обирає код відповіді
 * (Zoho ретраїть на non-2xx, тож для нього іноді потрібен 200 із
 * `received: false`).
 *
 * @param expected секрет із конфігу; undefined/порожній → 'not_configured'
 */
export function verifyWebhookToken(
  headers: Record<string, unknown>,
  expected: string | undefined | null,
): WebhookTokenResult {
  // Секрет не налаштований — це помилка конфігурації, а НЕ дозвіл
  // пропустити перевірку. Раніше саме тут ендпоінт ставав відкритим.
  if (!expected) return { ok: false, reason: 'not_configured' };

  let received: string | undefined;
  for (const h of WEBHOOK_TOKEN_HEADERS) {
    const v = headers[h];
    if (typeof v === 'string' && v.length > 0) {
      received = v;
      break;
    }
  }

  if (!received) return { ok: false, reason: 'missing_token' };
  if (!safeCompareSecrets(received, expected)) {
    return { ok: false, reason: 'invalid_token' };
  }
  return { ok: true };
}
