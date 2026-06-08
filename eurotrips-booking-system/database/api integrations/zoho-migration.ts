// =============================================================
// EUROTRIPS — Zoho CRM → New System Migration
// Одноразовий скрипт імпорту лідів та контактів з Zoho CRM
//
// Запуск:
//   npx ts-node --require tsconfig-paths/register \
//     src/modules/integrations/zoho/zoho-migration.ts
//
// Або через npm script (package.json):
//   "migrate:zoho": "ts-node -r tsconfig-paths/register src/modules/integrations/zoho/zoho-migration.ts"
//
// Безпечно для повторного запуску (upsert по externalId / email).
// Rate limit: 10 req/s Zoho API → sleep 120ms між сторінками.
//
// Вимоги .env:
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN
//   DATABASE_URL
// =============================================================

import 'dotenv/config';
import axios, { AxiosError } from 'axios';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import {
  ZOHO_LEAD_STATUS_MAP,
  ZOHO_LEAD_SOURCE_MAP,
  type ZohoLead,
  type ZohoContact,
  type ZohoTokenResponse,
  type ZohoListResponse,
  type MigrationBatchStats,
  type MigrationResult,
} from './zoho.types';

// ─── Logger ──────────────────────────────────────────────────────────────────

const logger = pino({
  transport: { target: 'pino-pretty', options: { colorize: true } },
  level:     'info',
});

// ─── Prisma ───────────────────────────────────────────────────────────────────

const prisma = new PrismaClient({ log: ['warn', 'error'] });

// ─── ENV validation ───────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Обов'язкова змінна середовища не встановлена: ${key}`);
  return v;
}

const ZOHO_CLIENT_ID     = requireEnv('ZOHO_CLIENT_ID');
const ZOHO_CLIENT_SECRET = requireEnv('ZOHO_CLIENT_SECRET');
const ZOHO_REFRESH_TOKEN = requireEnv('ZOHO_REFRESH_TOKEN');
const ZOHO_BASE_URL      = process.env.ZOHO_BASE_URL ?? 'https://www.zohoapis.com/crm/v8';
const ZOHO_AUTH_URL      = process.env.ZOHO_AUTH_URL ?? 'https://accounts.zoho.com';

// ─── Token Manager ────────────────────────────────────────────────────────────

class ZohoTokenManager {
  private token:     string | null = null;
  private expiresAt: number        = 0;

  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.expiresAt) {
      return this.token;
    }
    return this.refresh();
  }

  private async refresh(): Promise<string> {
    logger.info('Zoho OAuth2: оновлення access token...');

    const response = await axios.post<ZohoTokenResponse>(
      `${ZOHO_AUTH_URL}/oauth/v2/token`,
      null,
      {
        params: {
          refresh_token: ZOHO_REFRESH_TOKEN,
          client_id:     ZOHO_CLIENT_ID,
          client_secret: ZOHO_CLIENT_SECRET,
          grant_type:    'refresh_token',
        },
      },
    );

    if (!response.data.access_token) {
      throw new Error('Zoho OAuth2: access_token відсутній у відповіді');
    }

    this.token     = response.data.access_token;
    // Мінус 60 секунд запасу
    this.expiresAt = Date.now() + (response.data.expires_in - 60) * 1_000;

    logger.info('Zoho OAuth2: токен отримано успішно');
    return this.token;
  }
}

const tokenManager = new ZohoTokenManager();

// ─── Zoho API Client ─────────────────────────────────────────────────────────

async function zohoGet<T>(
  endpoint: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const token = await tokenManager.getToken();

  try {
    const response = await axios.get<T>(`${ZOHO_BASE_URL}${endpoint}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      params,
    });
    return response.data;
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response?.status === 401) {
      // Токен протух — примусово оновлюємо
      logger.warn('Zoho API: 401 — примусово оновлюємо токен');
      (tokenManager as any).expiresAt = 0;
      return zohoGet<T>(endpoint, params);
    }
    throw err;
  }
}

// ─── Paginated Fetchers ───────────────────────────────────────────────────────

const PAGE_SIZE = 200; // максимум Zoho CRM API
const RATE_LIMIT_MS = 120; // 120ms між запитами ≈ 8 req/s < ліміт 10 req/s

/**
 * Асинхронний генератор: повертає сторінки лідів з Zoho.
 * Обробляє пагінацію та rate limiting автоматично.
 */
async function* fetchLeadPages(): AsyncGenerator<ZohoLead[]> {
  let page     = 1;
  let hasMore  = true;
  let total    = 0;

  while (hasMore) {
    const response = await zohoGet<ZohoListResponse<ZohoLead>>('/Leads', {
      page,
      per_page: PAGE_SIZE,
      // Запитуємо тільки потрібні поля — економить трафік і токени Zoho
      fields: [
        'id', 'First_Name', 'Last_Name', 'Email', 'Phone', 'Mobile',
        'Lead_Source', 'Lead_Status', 'Description', 'Created_Time', 'Modified_Time',
        'Owner', 'Converted', 'Tour_Name', 'Num_Tourists', 'Budget_EUR',
      ].join(','),
    });

    if (!response.data?.length) {
      hasMore = false;
      break;
    }

    total += response.data.length;
    logger.debug(`Zoho Leads: сторінка ${page}, отримано ${response.data.length} (всього: ${total})`);

    yield response.data;

    hasMore = response.info.more_records;
    page++;
    await sleep(RATE_LIMIT_MS);
  }
}

/**
 * Асинхронний генератор: повертає сторінки контактів з Zoho.
 */
async function* fetchContactPages(): AsyncGenerator<ZohoContact[]> {
  let page     = 1;
  let hasMore  = true;
  let total    = 0;

  while (hasMore) {
    const response = await zohoGet<ZohoListResponse<ZohoContact>>('/Contacts', {
      page,
      per_page: PAGE_SIZE,
      fields: [
        'id', 'First_Name', 'Last_Name', 'Email', 'Phone', 'Mobile',
        'Description', 'Created_Time', 'Modified_Time', 'Owner', 'Account_Name',
      ].join(','),
    });

    if (!response.data?.length) {
      hasMore = false;
      break;
    }

    total += response.data.length;
    logger.debug(`Zoho Contacts: сторінка ${page}, отримано ${response.data.length} (всього: ${total})`);

    yield response.data;

    hasMore = response.info.more_records;
    page++;
    await sleep(RATE_LIMIT_MS);
  }
}

// ─── Data Mapping ─────────────────────────────────────────────────────────────

function mapLeadStatus(zohoStatus: string | null): string {
  if (!zohoStatus) return 'new';
  return ZOHO_LEAD_STATUS_MAP[zohoStatus] ?? 'new';
}

function mapLeadSource(zohoSource: string | null): string {
  if (!zohoSource) return 'other';
  return ZOHO_LEAD_SOURCE_MAP[zohoSource] ?? 'other';
}

/**
 * Очищає номер телефону: залишає тільки цифри та "+".
 * Відкидає значення коротші 10 символів.
 */
function sanitizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+\s()\-]/g, '').trim();
  const digitsOnly = cleaned.replace(/\D/g, '');
  return digitsOnly.length >= 10 ? cleaned : null;
}

/**
 * Формує текст нотаток ліда з кількох полів Zoho.
 */
function buildLeadNotes(lead: ZohoLead): string {
  const parts: string[] = [];
  if (lead.Description)  parts.push(lead.Description.trim());
  if (lead.Tour_Name)    parts.push(`Тур: ${lead.Tour_Name}`);
  if (lead.Budget_EUR)   parts.push(`Бюджет: ${lead.Budget_EUR} EUR`);
  if (lead.Owner?.name)  parts.push(`Менеджер у Zoho: ${lead.Owner.name}`);
  return parts.join('\n');
}

// ─── Import Functions ─────────────────────────────────────────────────────────

/**
 * Імпортує всі ліди з Zoho CRM у таблицю leads.
 *
 * Стратегія:
 *  - Converted ліди пропускаємо (вони вже стали угодами)
 *  - externalId = 'zoho_lead_{zoho.id}' — ключ ідемпотентності
 *  - Upsert: при повторному запуску — оновлює статус і нотатки
 */
async function importLeads(stats: MigrationBatchStats): Promise<void> {
  logger.info('─── Імпорт лідів ───────────────────────────────');

  for await (const batch of fetchLeadPages()) {
    for (const zohoLead of batch) {
      stats.fetched++;

      try {
        // Конвертовані ліди вже є угодами — пропускаємо
        if (zohoLead.Converted) {
          stats.skipped++;
          continue;
        }

        const externalId = `zoho_lead_${zohoLead.id}`;
        const phone      = sanitizePhone(zohoLead.Phone ?? zohoLead.Mobile);

        const result = await prisma.lead.upsert({
          where: { externalId },
          create: {
            externalId,
            firstName:  zohoLead.First_Name ?? 'Невідомо',
            lastName:   zohoLead.Last_Name  ?? '',
            email:      zohoLead.Email      ?? null,
            phone,
            source:     mapLeadSource(zohoLead.Lead_Source),
            status:     mapLeadStatus(zohoLead.Lead_Status),
            notes:      buildLeadNotes(zohoLead),
            paxCount:   zohoLead.Num_Tourists ?? 1,
            budgetEur:  zohoLead.Budget_EUR   ?? null,
            metadata: {
              zoho_id:    zohoLead.id,
              zoho_owner: zohoLead.Owner?.name ?? null,
              migrated_at: new Date().toISOString(),
            },
            createdAt:  new Date(zohoLead.Created_Time),
            updatedAt:  new Date(zohoLead.Modified_Time),
          },
          update: {
            // При повторному запуску — оновлюємо змінювані поля
            status:    mapLeadStatus(zohoLead.Lead_Status),
            notes:     buildLeadNotes(zohoLead),
            phone:     phone ?? undefined,
            updatedAt: new Date(zohoLead.Modified_Time),
          },
        });

        // Нова або оновлена запис?
        if (result.createdAt.getTime() === new Date(zohoLead.Created_Time).getTime()) {
          stats.created++;
        } else {
          stats.updated++;
        }

      } catch (err: unknown) {
        stats.errors++;
        const error = err as { message?: string; code?: string };
        logger.error(
          { zohoLeadId: zohoLead.id, err: error.message, code: error.code },
          'Помилка імпорту ліда',
        );
      }
    }

    // Прогрес після кожної batch
    logger.info(
      `Ліди: ${stats.fetched} отримано | ${stats.created} нових | ${stats.updated} оновлено | ${stats.skipped} пропущено | ${stats.errors} помилок`,
    );
  }
}

/**
 * Імпортує контакти Zoho у таблицю tourists.
 *
 * Стратегія:
 *  - Email обов'язковий (унікальний ключ для tourists)
 *  - Upsert по email — без дублів
 *  - НЕ перезаписуємо існуючі phone, щоб не псувати вже виправлені дані
 */
async function importContacts(stats: MigrationBatchStats): Promise<void> {
  logger.info('─── Імпорт контактів (туристів) ────────────────');

  for await (const batch of fetchContactPages()) {
    for (const contact of batch) {
      stats.fetched++;

      try {
        // Контакти без email ігноруємо (не можемо ідентифікувати унікально)
        if (!contact.Email) {
          stats.skipped++;
          logger.debug({ zohoContactId: contact.id }, 'Контакт без email — пропускаємо');
          continue;
        }

        const phone     = sanitizePhone(contact.Phone ?? contact.Mobile);
        const fullNotes = [
          contact.Description,
          contact.Account_Name?.name ? `Агентство: ${contact.Account_Name.name}` : null,
        ].filter(Boolean).join('\n');

        await prisma.tourist.upsert({
          where: { email: contact.Email },
          create: {
            firstName:     contact.First_Name ?? 'Невідомо',
            lastName:      contact.Last_Name  ?? '',
            email:         contact.Email,
            phone,
            notes:         fullNotes || null,
            sourceChannel: 'zoho_import',
            isRepeat:      false,
            metadata: {
              zoho_id:    contact.id,
              zoho_owner: contact.Owner?.name  ?? null,
              zoho_agency: contact.Account_Name?.name ?? null,
              migrated_at: new Date().toISOString(),
            },
            createdAt: new Date(contact.Created_Time),
            updatedAt: new Date(contact.Modified_Time),
          },
          update: {
            // Оновлюємо тільки якщо дані порожні у нашій БД
            notes:     fullNotes || undefined,
            updatedAt: new Date(contact.Modified_Time),
            // НЕ оновлюємо firstName/lastName/phone — вони могли бути виправлені вручну
          },
        });

        stats.created++;

      } catch (err: unknown) {
        const error = err as { message?: string; code?: string };

        // P2002 = unique constraint violation (email вже є, але upsert не спрацював)
        if ((error as any).code === 'P2002') {
          stats.skipped++;
          continue;
        }

        stats.errors++;
        logger.error(
          { zohoContactId: contact.id, email: contact.Email, err: error.message },
          'Помилка імпорту контакту',
        );
      }
    }

    logger.info(
      `Контакти: ${stats.fetched} отримано | ${stats.created} збережено | ${stats.skipped} пропущено | ${stats.errors} помилок`,
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeBatchStats(): MigrationBatchStats {
  return { fetched: 0, created: 0, updated: 0, skipped: 0, errors: 0 };
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}с`;
  return `${Math.floor(seconds / 60)}хв ${seconds % 60}с`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Запускає повну міграцію лідів та контактів з Zoho CRM.
 *
 * Порядок:
 *  1. Перевірка ENV
 *  2. Тест OAuth2 авторизації
 *  3. Імпорт Leads (ліди)
 *  4. Імпорт Contacts (туристи)
 *  5. Підсумок + збереження звіту в audit_log
 *
 * Безпечно для повторного запуску (idempotent upserts).
 */
export async function runZohoMigration(): Promise<MigrationResult> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  const stats = {
    leads:    makeBatchStats(),
    contacts: makeBatchStats(),
  };

  logger.info('');
  logger.info('═══════════════════════════════════════════════════');
  logger.info('  EUROTRIPS — Zoho CRM Migration  (старт)');
  logger.info(`  ${new Date().toLocaleString('uk-UA')}`);
  logger.info('═══════════════════════════════════════════════════');

  try {
    // 1. Перевірка авторизації
    logger.info('Перевірка OAuth2 підключення до Zoho...');
    await tokenManager.getToken();
    logger.info('✓ Авторизацію підтверджено');

    // 2. Ping Zoho API
    const pingResponse = await zohoGet<{ users: { full_name: string }[] }>('/users?type=CurrentUser');
    const userName = pingResponse.users?.[0]?.full_name ?? 'невідомо';
    logger.info(`✓ Підключено до Zoho CRM. Поточний користувач: ${userName}`);

    // 3. Імпорт лідів
    await importLeads(stats.leads);
    logger.info(`✓ Ліди імпортовано: ${stats.leads.created} нових, ${stats.leads.updated} оновлено`);

    // 4. Імпорт контактів
    await importContacts(stats.contacts);
    logger.info(`✓ Контакти імпортовано: ${stats.contacts.created} збережено`);

  } catch (err: unknown) {
    const error = err as { message?: string };
    logger.error({ err: error.message }, '✗ Міграція перервана критичною помилкою');

    const result: MigrationResult = {
      success:    false,
      duration:   formatDuration(Date.now() - startTime),
      leads:      stats.leads,
      contacts:   stats.contacts,
      startedAt,
      finishedAt: new Date().toISOString(),
    };

    // Записуємо провал в audit_log
    await writeMigrationAuditLog(result, error.message);
    throw err;
  }

  const duration   = formatDuration(Date.now() - startTime);
  const finishedAt = new Date().toISOString();

  const result: MigrationResult = {
    success: true,
    duration,
    leads:    stats.leads,
    contacts: stats.contacts,
    startedAt,
    finishedAt,
  };

  // Підсумок
  logger.info('');
  logger.info('═══════════════════════════════════════════════════');
  logger.info('  EUROTRIPS — Zoho CRM Migration  (завершено ✓)');
  logger.info(`  Тривалість: ${duration}`);
  logger.info('');
  logger.info('  Ліди:');
  logger.info(`    Отримано з Zoho:  ${stats.leads.fetched}`);
  logger.info(`    Нових записів:    ${stats.leads.created}`);
  logger.info(`    Оновлено:         ${stats.leads.updated}`);
  logger.info(`    Пропущено:        ${stats.leads.skipped}  (конвертовані)`);
  logger.info(`    Помилок:          ${stats.leads.errors}`);
  logger.info('');
  logger.info('  Контакти (туристи):');
  logger.info(`    Отримано з Zoho:  ${stats.contacts.fetched}`);
  logger.info(`    Збережено:        ${stats.contacts.created}`);
  logger.info(`    Пропущено:        ${stats.contacts.skipped}  (без email / дублі)`);
  logger.info(`    Помилок:          ${stats.contacts.errors}`);
  logger.info('═══════════════════════════════════════════════════');
  logger.info('');

  // Записуємо успіх в audit_log
  await writeMigrationAuditLog(result);

  return result;
}

/**
 * Записує підсумок міграції в audit_log для звітності.
 */
async function writeMigrationAuditLog(
  result: MigrationResult,
  errorMessage?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action:     'ZOHO_MIGRATION_COMPLETED',
        entityType: 'system',
        entityId:   null,
        details: {
          ...result,
          errorMessage: errorMessage ?? null,
        },
        severity:  result.success ? 'info' : 'error',
        source:    'zoho_migration_script',
        createdAt: new Date(),
      },
    });
  } catch (dbErr) {
    logger.warn({ dbErr }, 'Не вдалося записати audit_log міграції');
  }
}

// ─── Standalone Entry Point ───────────────────────────────────────────────────

// Запуск через: ts-node zoho-migration.ts
if (require.main === module) {
  runZohoMigration()
    .then((result) => {
      const exitCode = result.success ? 0 : 1;
      process.exit(exitCode);
    })
    .catch((err: Error) => {
      logger.error({ err: err.message }, 'Критична помилка міграції');
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
