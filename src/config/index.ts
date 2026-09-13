// =============================================================================
// EUROTRIPS — Конфігурація (Zod validation)
// =============================================================================

import { z } from 'zod';

/**
 * Булеве значення зі змінної оточення.
 *
 * НЕ z.coerce.boolean(): вона повертає true для будь-якого непорожнього
 * рядка, тобто ZOHO_ENABLED=false увімкнуло б інтеграцію.
 */
const envBool = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_PORT: z.coerce.number().default(3000),
  APP_HOST: z.string().default('0.0.0.0'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1),

  REDIS_URL: z.string().optional(),

  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES: z.string().default('30d'),
  BCRYPT_ROUNDS: z.coerce.number().default(12),

  SENDGRID_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('noreply@eurotrips.ua'),
  EMAIL_FROM_NAME: z.string().default('Eurotrips'),

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  /// C5: chat_id внутрішньої ops-групи для нотифікацій (BR-11 румінг, підтвердження
  /// бронювання) — per-tourist/per-agent chat_id ще не зберігається (потрібна окрема
  /// міграція + /start-лінкування бота), тому MVP шле все в один внутрішній чат
  TELEGRAM_OPS_CHAT_ID: z.string().optional(),
  VIBER_AUTH_TOKEN: z.string().optional(),

  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_REGION: z.string().default('eu-central-1'),

  SENTRY_DSN: z.string().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('debug'),

  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60000),

  BOOKING_NUMBER_PREFIX: z.string().default('ET'),
  BOOKING_NUMBER_PAD: z.coerce.number().default(5),

  // ── ZOHO CRM ────────────────────────────────────────────────────────────
  // Раніше ці змінні читались напряму через process.env повз цю схему, а в
  // .env.example були описані лише чотири з них.
  //
  // ZOHO_ENABLED — головний перемикач. Поки false, решта необовʼязкова і
  // проєкт піднімається без жодної ZOHO-змінної. Щойно true — усі критичні
  // стають обовʼязковими, і конфіг падає на старті, а не мовчки працює
  // напівсправно.
  ZOHO_ENABLED: envBool,

  // Базова схема НЕ висуває жодних вимог до цих полів — лише тип.
  // Будь-який .min() тут означав би, що застосунок можна покласти
  // залишковим значенням при вимкненій інтеграції. Уся обовʼязковість
  // і довжина — у superRefine нижче, під гейтом.
  ZOHO_CLIENT_ID: z.string().optional(),
  ZOHO_CLIENT_SECRET: z.string().optional(),
  ZOHO_REFRESH_TOKEN: z.string().optional(),
  ZOHO_ORG_ID: z.string().optional(),

  /// Секрет вебхука. Порожнє значення НЕ означає «пропустити перевірку» —
  /// див. verifyWebhookToken() у shared/utils/webhook-token.ts.
  ZOHO_WEBHOOK_TOKEN: z.string().optional(),

  ZOHO_BASE_URL: z.string().url().default('https://www.zohoapis.com/crm/v8'),
  ZOHO_AUTH_URL: z.string().url().default('https://accounts.zoho.com'),
  ZOHO_PAYMENT_MODULE: z.string().default('CustomModule3'),
  ZOHO_TRAVEL_MODULE: z.string().default('Travel'),
})
  .superRefine((cfg, ctx) => {
    // Вимкнена інтеграція не має права завалити старт — виходимо мовчки,
    // хай би що лишалось у ZOHO_*-змінних.
    if (!cfg.ZOHO_ENABLED) return;

    const required = [
      'ZOHO_CLIENT_ID',
      'ZOHO_CLIENT_SECRET',
      'ZOHO_REFRESH_TOKEN',
      'ZOHO_WEBHOOK_TOKEN',
    ] as const;

    for (const key of required) {
      if (!cfg[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: 'Обовʼязкова змінна при ZOHO_ENABLED=true',
        });
      }
    }

    // Довжина секрета вебхука — теж під гейтом: закороткий залишок у
    // змінних не повинен класти застосунок з вимкненою інтеграцією.
    const MIN_WEBHOOK_TOKEN = 16;
    if (cfg.ZOHO_WEBHOOK_TOKEN && cfg.ZOHO_WEBHOOK_TOKEN.length < MIN_WEBHOOK_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ZOHO_WEBHOOK_TOKEN'],
        message: `Мінімум ${MIN_WEBHOOK_TOKEN} символів при ZOHO_ENABLED=true`,
      });
    }
  });

/**
 * Railway (як і Docker Compose та GitHub Actions) зберігає незадану змінну
 * як ПОРОЖНІЙ РЯДОК, а не як `undefined`. Для Zod це дві різні речі:
 * `.optional()` і `.default()` спрацьовують лише на `undefined`, тож `""`
 * проходить далі й падає на `.min()`, `.url()`, `.email()` чи `z.enum()`.
 *
 * Саме це поклало прод на 22 години: `ZOHO_CLIENT_ID=""` не вважався
 * «не заданим», хоча гейт `ZOHO_ENABLED=false` мав би його пропустити.
 *
 * Тому нормалізуємо ДО валідації: порожній (або з самих пробілів) рядок —
 * це «не задано». Значення з пробілами по краях не обрізаємо: у секретах
 * вони можуть бути значущими.
 */
export function stripEmptyEnv(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    out[key] = typeof value === 'string' && value.trim() === '' ? undefined : value;
  }
  return out;
}

/** Чиста функція розбору — щоб конфіг можна було тестувати без process.exit. */
export function parseEnv(env: NodeJS.ProcessEnv) {
  return envSchema.safeParse(stripEmptyEnv(env));
}

function validateConfig() {
  const result = parseEnv(process.env);
  if (!result.success) {
    console.error('❌ Помилка конфігурації:');
    result.error.issues.forEach((issue) => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }
  return result.data;
}

export const config = validateConfig();
export type Config = typeof config;
