// =============================================================================
// EUROTRIPS — Конфігурація (Zod validation)
// =============================================================================

import { z } from 'zod';

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
});

function validateConfig() {
  const result = envSchema.safeParse(process.env);
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
