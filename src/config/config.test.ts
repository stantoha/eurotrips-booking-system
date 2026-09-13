// =============================================================================
// EUROTRIPS — валідація конфігу
//
// ЧОМУ ЦЕЙ ФАЙЛ ІСНУЄ: після етапу 1 прод лежав 22 години. Гейт ZOHO_ENABLED
// було додано правильно, але Railway зберігає незадані змінні як ПОРОЖНІЙ
// РЯДОК. Для Zod `""` — це задане значення, тож `.optional()` не спрацьовував,
// і `.min(1)` / `.min(16)` валили старт незалежно від гейта.
//
// Етап 1 перевіряв лише ZOHO_ENABLED=true, тому дірку не побачив. Тут
// перевіряється насамперед протилежне: що застосунок піднімається БЕЗ
// жодної ZOHO-змінної і з порожніми рядками.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { parseEnv, stripEmptyEnv } from './index';

/** Мінімум, без якого конфіг не валідний у принципі (і це правильно) */
const BASE_ENV = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
} satisfies NodeJS.ProcessEnv;

const ZOHO_FULL = {
  ZOHO_CLIENT_ID: '1000.ABCDEF',
  ZOHO_CLIENT_SECRET: 'secret-value',
  ZOHO_REFRESH_TOKEN: '1000.refresh',
  ZOHO_WEBHOOK_TOKEN: 'x'.repeat(32),
} satisfies NodeJS.ProcessEnv;

const ZOHO_EMPTY = {
  ZOHO_ENABLED: '',
  ZOHO_CLIENT_ID: '',
  ZOHO_CLIENT_SECRET: '',
  ZOHO_REFRESH_TOKEN: '',
  ZOHO_ORG_ID: '',
  ZOHO_WEBHOOK_TOKEN: '',
  ZOHO_BASE_URL: '',
  ZOHO_AUTH_URL: '',
} satisfies NodeJS.ProcessEnv;

/** Перелік полів, що не пройшли валідацію — для зрозумілих assert'ів */
const failedFields = (r: ReturnType<typeof parseEnv>) =>
  r.success ? [] : r.error.issues.map((i) => i.path.join('.'));

// ─── П'ЯТЬ СЦЕНАРІЇВ ІЗ ЗАВДАННЯ ─────────────────────────────────────────────

describe('ZOHO_* поза гейтом не можуть завалити старт', () => {
  it('жодної ZOHO-змінної → конфіг валідний, інтеграція вимкнена', () => {
    const r = parseEnv({ ...BASE_ENV });
    expect(failedFields(r)).toEqual([]);
    expect(r.success && r.data.ZOHO_ENABLED).toBe(false);
  });

  it('ZOHO_* задані ПОРОЖНІМИ РЯДКАМИ → валідний (саме це поклало прод)', () => {
    const r = parseEnv({ ...BASE_ENV, ...ZOHO_EMPTY });
    expect(failedFields(r)).toEqual([]);
    expect(r.success && r.data.ZOHO_ENABLED).toBe(false);
  });

  it('ZOHO_ENABLED=false + порожні значення → валідний', () => {
    const r = parseEnv({ ...BASE_ENV, ...ZOHO_EMPTY, ZOHO_ENABLED: 'false' });
    expect(failedFields(r)).toEqual([]);
    expect(r.success && r.data.ZOHO_ENABLED).toBe(false);
  });

  it('ZOHO_ENABLED=true + порожні → помилка з переліком саме цих полів', () => {
    const r = parseEnv({ ...BASE_ENV, ...ZOHO_EMPTY, ZOHO_ENABLED: 'true' });
    expect(r.success).toBe(false);
    expect(failedFields(r)).toEqual(
      expect.arrayContaining([
        'ZOHO_CLIENT_ID',
        'ZOHO_CLIENT_SECRET',
        'ZOHO_REFRESH_TOKEN',
        'ZOHO_WEBHOOK_TOKEN',
      ]),
    );
  });

  it('ZOHO_ENABLED=true + усі задані → валідний', () => {
    const r = parseEnv({ ...BASE_ENV, ZOHO_ENABLED: 'true', ...ZOHO_FULL });
    expect(failedFields(r)).toEqual([]);
    expect(r.success && r.data.ZOHO_ENABLED).toBe(true);
  });

  // Той самий клас аварії: залишкове значення при вимкненій інтеграції.
  // Раніше .min(16) жив у базовій схемі й поклав би старт.
  it('закороткий залишковий ZOHO_WEBHOOK_TOKEN при вимкненій інтеграції → валідний', () => {
    const r = parseEnv({ ...BASE_ENV, ZOHO_ENABLED: 'false', ZOHO_WEBHOOK_TOKEN: 'short' });
    expect(failedFields(r)).toEqual([]);
  });

  it('той самий закороткий токен при ZOHO_ENABLED=true → помилка', () => {
    const r = parseEnv({ ...BASE_ENV, ZOHO_ENABLED: 'true', ...ZOHO_FULL, ZOHO_WEBHOOK_TOKEN: 'short' });
    expect(failedFields(r)).toContain('ZOHO_WEBHOOK_TOKEN');
  });

  it('сміття в ZOHO_CLIENT_ID при вимкненій інтеграції нікому не заважає', () => {
    const r = parseEnv({ ...BASE_ENV, ZOHO_CLIENT_ID: 'залишок-від-тестів' });
    expect(failedFields(r)).toEqual([]);
  });
});

// ─── ТЕ САМЕ ПРАВИЛО ДЛЯ РЕШТИ НЕОБОВ'ЯЗКОВИХ ІНТЕГРАЦІЙ ─────────────────────
// Будь-яка з них, задана порожнім рядком, не повинна валити старт.

describe('решта необовʼязкових інтеграцій переживають порожній рядок', () => {
  const OPTIONAL_KEYS = [
    'REDIS_URL',
    'SENDGRID_API_KEY',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_OPS_CHAT_ID',
    'VIBER_AUTH_TOKEN',
    'S3_ENDPOINT',
    'S3_BUCKET',
    'S3_ACCESS_KEY',
    'S3_SECRET_KEY',
    'SENTRY_DSN',
  ] as const;

  it.each(OPTIONAL_KEYS)('%s="" не валить конфіг', (key) => {
    const r = parseEnv({ ...BASE_ENV, [key]: '' });
    expect(failedFields(r)).toEqual([]);
  });

  it('усі одразу порожні → усе одно валідний', () => {
    const empties = Object.fromEntries(OPTIONAL_KEYS.map((k) => [k, '']));
    const r = parseEnv({ ...BASE_ENV, ...empties });
    expect(failedFields(r)).toEqual([]);
  });
});

// ─── ПОЛЯ З DEFAULT ──────────────────────────────────────────────────────────
// Порожній рядок має віддавати DEFAULT, а не падати на .url()/.email()/enum
// і не перетворюватись на 0 через z.coerce.number().

describe('порожній рядок віддає default, а не ламає формат', () => {
  it.each([
    ['APP_URL', 'http://localhost:3000'],
    ['FRONTEND_URL', 'http://localhost:5173'],
    ['EMAIL_FROM', 'noreply@eurotrips.ua'],
    ['LOG_LEVEL', 'debug'],
    ['ZOHO_BASE_URL', 'https://www.zohoapis.com/crm/v8'],
    ['ZOHO_AUTH_URL', 'https://accounts.zoho.com'],
  ])('%s="" → %s', (key, expected) => {
    const r = parseEnv({ ...BASE_ENV, [key]: '' });
    expect(failedFields(r)).toEqual([]);
    expect(r.success && (r.data as Record<string, unknown>)[key]).toBe(expected);
  });

  it('APP_PORT="" → 3000, а не 0 (z.coerce.number перетворює "" на нуль)', () => {
    const r = parseEnv({ ...BASE_ENV, APP_PORT: '' });
    expect(r.success && r.data.APP_PORT).toBe(3000);
  });

  it('BCRYPT_ROUNDS="" → 12, а не 0 (нуль раундів = пароль без хешування)', () => {
    const r = parseEnv({ ...BASE_ENV, BCRYPT_ROUNDS: '' });
    expect(r.success && r.data.BCRYPT_ROUNDS).toBe(12);
  });
});

// ─── ОБОВ'ЯЗКОВЕ ЛИШАЄТЬСЯ ОБОВ'ЯЗКОВИМ ──────────────────────────────────────
// Послаблення не має перетворитись на «все необовʼязкове».

describe('справді обовʼязкові змінні далі валять старт', () => {
  it('без DATABASE_URL — помилка', () => {
    const { DATABASE_URL: _omit, ...rest } = BASE_ENV;
    expect(failedFields(parseEnv(rest))).toContain('DATABASE_URL');
  });

  it('DATABASE_URL="" — помилка (порожнє = не задано, а воно потрібне)', () => {
    expect(failedFields(parseEnv({ ...BASE_ENV, DATABASE_URL: '' }))).toContain('DATABASE_URL');
  });

  it('закороткий JWT_SECRET — помилка', () => {
    expect(failedFields(parseEnv({ ...BASE_ENV, JWT_SECRET: 'short' }))).toContain('JWT_SECRET');
  });
});

// ─── ФОРМАТ ПРИ ЗАДАНОМУ ЗНАЧЕННІ ────────────────────────────────────────────

describe('формат перевіряється, якщо значення задане', () => {
  it('APP_URL не-URL — помилка', () => {
    expect(failedFields(parseEnv({ ...BASE_ENV, APP_URL: 'не-url' }))).toContain('APP_URL');
  });

  it('ZOHO_ENABLED зі сміттям — помилка, а не тихе true', () => {
    expect(failedFields(parseEnv({ ...BASE_ENV, ZOHO_ENABLED: 'yes' }))).toContain('ZOHO_ENABLED');
  });

  it('ZOHO_ENABLED=0 → false (а не true через непорожній рядок)', () => {
    const r = parseEnv({ ...BASE_ENV, ZOHO_ENABLED: '0' });
    expect(r.success && r.data.ZOHO_ENABLED).toBe(false);
  });
});

// ─── stripEmptyEnv ───────────────────────────────────────────────────────────

describe('stripEmptyEnv', () => {
  it('порожній рядок і пробіли → undefined', () => {
    expect(stripEmptyEnv({ A: '', B: '   ', C: '\t' })).toEqual({ A: undefined, B: undefined, C: undefined });
  });

  it('значущі пробіли по краях НЕ обрізаються', () => {
    expect(stripEmptyEnv({ SECRET: ' abc ' })).toEqual({ SECRET: ' abc ' });
  });

  it('справжні значення не змінюються', () => {
    expect(stripEmptyEnv({ A: 'x', B: '0', C: 'false' })).toEqual({ A: 'x', B: '0', C: 'false' });
  });
});
