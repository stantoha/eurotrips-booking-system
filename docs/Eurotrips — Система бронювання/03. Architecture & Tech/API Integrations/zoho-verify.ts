// =============================================================
// EUROTRIPS — Zoho CRM Pre-Migration Verifier
// Запустити ПЕРЕД основною міграцією.
//
// Що робить:
//   1. Перевіряє OAuth2 авторизацію
//   2. Рахує записи в кожному модулі
//   3. Вивантажує 5 зразків CustomModule3 (Платежі) → з'ясовує field2/field3/field5
//   4. Вивантажує 5 зразків Travel → з'ясовує field1-field10
//   5. Вивантажує metadata полів через Zoho Fields API
//   6. Зберігає звіт у zoho-verify-report.json
//
// Запуск:
//   npx ts-node src/modules/integrations/zoho/zoho-verify.ts
//   DRY_RUN=true npx ts-node src/modules/integrations/zoho/zoho-migration.ts
// =============================================================

import 'dotenv/config';
import axios   from 'axios';
import fs      from 'node:fs';
import path    from 'node:path';
import pino    from 'pino';

const logger = pino({
  transport: { target: 'pino-pretty', options: { colorize: true } },
  level: 'info',
});

// ─── ENV ─────────────────────────────────────────────────────

const ZOHO_CLIENT_ID     = process.env.ZOHO_CLIENT_ID     ?? '';
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET ?? '';
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN ?? '';
const ZOHO_BASE_URL      = process.env.ZOHO_BASE_URL      ?? 'https://www.zohoapis.com/crm/v8';
const ZOHO_AUTH_URL      = process.env.ZOHO_AUTH_URL      ?? 'https://accounts.zoho.com';
const PAYMENT_MODULE     = process.env.ZOHO_PAYMENT_MODULE ?? 'CustomModule3';
const TRAVEL_MODULE      = process.env.ZOHO_TRAVEL_MODULE  ?? 'Travel';

// ─── Token ───────────────────────────────────────────────────

let accessToken = '';
let tokenExp    = 0;

async function getToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExp) return accessToken;
  const res = await axios.post(
    `${ZOHO_AUTH_URL}/oauth/v2/token`, null,
    { params: { refresh_token: ZOHO_REFRESH_TOKEN, client_id: ZOHO_CLIENT_ID,
                client_secret: ZOHO_CLIENT_SECRET, grant_type: 'refresh_token' } },
  );
  accessToken = res.data.access_token;
  tokenExp    = Date.now() + (res.data.expires_in - 60) * 1_000;
  return accessToken;
}

async function zGet<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
  const token = await getToken();
  const res = await axios.get<T>(`${ZOHO_BASE_URL}${endpoint}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
    params,
  });
  return res.data;
}

// ─── Helpers ─────────────────────────────────────────────────

async function countRecords(module: string): Promise<number> {
  try {
    const res = await zGet<{ info: { total_count?: number; count?: number } }>(
      `/${module}`, { page: 1, per_page: 1 },
    );
    return res.info?.total_count ?? res.info?.count ?? -1;
  } catch (e: any) {
    if (e.response?.status === 404) return -2; // module не існує або немає доступу
    return -1;
  }
}

async function fetchSample<T>(module: string, fields: string[], count = 5): Promise<T[]> {
  try {
    const res = await zGet<{ data: T[] }>(
      `/${module}`, { page: 1, per_page: count, fields: fields.join(',') },
    );
    return res.data ?? [];
  } catch (e: any) {
    logger.warn({ module, err: e.message }, 'Не вдалося отримати зразки');
    return [];
  }
}

/** Отримує метадані полів модуля через Zoho Fields API */
async function fetchFieldMetadata(module: string): Promise<Record<string, { api_name: string; field_label: string; data_type: string }>> {
  try {
    const res = await zGet<{ fields: { api_name: string; field_label: string; data_type: string }[] }>(
      `/settings/fields`, { module },
    );
    const map: Record<string, { api_name: string; field_label: string; data_type: string }> = {};
    (res.fields ?? []).forEach(f => { map[f.api_name] = f; });
    return map;
  } catch (e: any) {
    logger.warn({ module, err: e.message }, 'Не вдалося отримати field metadata');
    return {};
  }
}

// ─── Main ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const report: Record<string, unknown> = { startedAt, summary: {}, fieldDiscovery: {}, samples: {} };

  logger.info('');
  logger.info('═══════════════════════════════════════════════════════');
  logger.info('  EUROTRIPS — Zoho CRM Pre-Migration Verifier');
  logger.info('═══════════════════════════════════════════════════════');

  // ─── 1. Auth ────────────────────────────────────────────────
  logger.info('');
  logger.info('[1/5] Перевірка OAuth2...');
  try {
    await getToken();
    const pingRes = await zGet<{ users: { full_name: string; email: string }[] }>(
      '/users', { type: 'CurrentUser' },
    );
    const user = pingRes.users?.[0];
    logger.info(`  ✅ Авторизовано як: ${user?.full_name} (${user?.email})`);
    report.auth = { ok: true, user: user?.full_name, email: user?.email };
  } catch (e: any) {
    logger.error(`  ❌ Помилка авторизації: ${e.message}`);
    report.auth = { ok: false, error: e.message };
    process.exit(1);
  }

  // ─── 2. Підрахунок записів ───────────────────────────────────
  logger.info('');
  logger.info('[2/5] Підрахунок записів у модулях...');

  const modules = [
    { name: 'Products',     label: 'Тури (Products)'     },
    { name: 'Agencies',     label: 'Агентства (Agencies)' },
    { name: 'Contacts',     label: 'Туристи (Contacts)'  },
    { name: 'Leads',        label: 'Ліди (Leads)'        },
    { name: 'Deals',        label: 'Бронювання (Deals)'  },
    { name: TRAVEL_MODULE,  label: `Операційні (${TRAVEL_MODULE})` },
    { name: PAYMENT_MODULE, label: `Платежі (${PAYMENT_MODULE})`  },
    { name: 'Invoices',     label: 'Рахунки (Invoices)'  },
    { name: 'Calls',        label: 'Дзвінки (Calls)'     },
  ];

  const counts: Record<string, number> = {};
  for (const m of modules) {
    const count = await countRecords(m.name);
    counts[m.name] = count;
    const icon = count >= 0 ? '✅' : count === -2 ? '⚠️ ' : '❌';
    const label = count >= 0 ? `${count} записів` : count === -2 ? 'Модуль не знайдено або немає доступу' : 'Помилка API';
    logger.info(`  ${icon} ${m.label.padEnd(30)} ${label}`);
  }
  report.summary = counts;

  // ─── 3. Field Discovery — CustomModule3 (Платежі) ────────────
  logger.info('');
  logger.info(`[3/5] Field Discovery: ${PAYMENT_MODULE} (Платежі)...`);

  // Метадані полів (назви та типи)
  const paymentFields = await fetchFieldMetadata(PAYMENT_MODULE);
  const criticalPaymentFields = ['field2', 'field3', 'field5'];
  const paymentFieldInfo: Record<string, unknown> = {};

  logger.info(`  Метадані критичних полів:`);
  for (const fieldName of criticalPaymentFields) {
    const meta = paymentFields[fieldName];
    if (meta) {
      logger.info(`  ✅ ${fieldName}: label="${meta.field_label}", type=${meta.data_type}`);
      paymentFieldInfo[fieldName] = { label: meta.field_label, type: meta.data_type };
    } else {
      logger.warn(`  ⚠️  ${fieldName}: не знайдено в metadata`);
      paymentFieldInfo[fieldName] = null;
    }
  }

  // Зразки записів
  const paymentSamples = await fetchSample<Record<string, unknown>>(
    PAYMENT_MODULE,
    ['id', 'Name', 'Payment_System', 'Currency', 'Exchange_Rate',
     'field2', 'field3', 'field5', 'Created_Time'],
    5,
  );

  if (paymentSamples.length > 0) {
    logger.info(`  ✅ Отримано ${paymentSamples.length} зразків`);
    logger.info('  Зразкові значення field2/field3/field5:');
    paymentSamples.forEach((s, i) => {
      logger.info(`  [${i + 1}] id=${s.id} | Name="${s.Name}" | ` +
        `field2=${JSON.stringify(s.field2)} | field3=${JSON.stringify(s.field3)} | field5=${JSON.stringify(s.field5)}`);
    });
  }

  report.fieldDiscovery = {
    [PAYMENT_MODULE]: { fields: paymentFieldInfo, samples: paymentSamples },
  };

  // ─── 4. Field Discovery — Travel ────────────────────────────
  logger.info('');
  logger.info(`[4/5] Field Discovery: ${TRAVEL_MODULE} (Операційні дані)...`);

  const travelFields = await fetchFieldMetadata(TRAVEL_MODULE);
  const travelFieldInfo: Record<string, unknown> = {};

  // Виводимо всі field1-field17 та field20-field37
  const travelCustomNums = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37];
  let knownFields = 0;
  for (const n of travelCustomNums) {
    const fieldName = `field${n}`;
    const meta = travelFields[fieldName];
    if (meta && meta.field_label && !meta.field_label.match(/^Field \d+$/i)) {
      logger.info(`  ✅ ${fieldName}: label="${meta.field_label}", type=${meta.data_type}`);
      travelFieldInfo[fieldName] = { label: meta.field_label, type: meta.data_type };
      knownFields++;
    }
  }

  if (knownFields === 0) {
    logger.warn(`  ⚠️  Не вдалося отримати назви кастомних полів Travel (можливо потрібен Settings scope)`);
  }

  // Зразки Travel
  const travelSamples = await fetchSample<Record<string, unknown>>(
    TRAVEL_MODULE,
    ['id', 'Name', 'Owner', 'tourID', 'Project', 'pickup', 'participant_count',
     'adult_count', 'child_count', 'Requires', 'field1', 'field2', 'field3',
     'field4', 'field5', 'Created_Time'],
    5,
  );

  if (travelSamples.length > 0) {
    logger.info(`  ✅ Отримано ${travelSamples.length} зразків Travel`);
    logger.info('  Структура Project (зв'язок з Deal?):');
    travelSamples.forEach((s, i) => {
      logger.info(`  [${i + 1}] id=${s.id} | Name="${s.Name}" | ` +
        `pickup="${s.pickup}" | tourID=${JSON.stringify((s as any).tourID?.id)} | ` +
        `Project=${JSON.stringify((s as any).Project?.id)}`);
    });
  }

  (report.fieldDiscovery as any)[TRAVEL_MODULE] = {
    fields: travelFieldInfo, samples: travelSamples,
  };

  // ─── 5. DRY RUN Summary ──────────────────────────────────────
  logger.info('');
  logger.info('[5/5] Dry-Run Estimate...');

  const totalRecords = Object.values(counts).filter(v => v > 0).reduce((a, b) => a + b, 0);
  const estimatedMinutes = Math.ceil(totalRecords * 0.12 / 60); // 120ms per record avg

  logger.info(`  Загальна кількість записів до міграції: ${totalRecords}`);
  logger.info(`  Орієнтовний час міграції: ~${estimatedMinutes} хвилин`);
  logger.info(`  Обов'язкові питання до замовника (ADR-003):`);
  logger.info(`    Q-01: CustomModule3.field2 — сума платежу? Валюта?`);
  logger.info(`    Q-02: CustomModule3.field3 — дата оплати чи дата введення?`);
  logger.info(`    Q-03: CustomModule3.field5 — тип платежу (передоплата/доплата)?`);
  logger.info(`    Q-04: Agencies.field29-37 — банківські реквізити?`);
  logger.info(`    Q-05: Agencies.field38-50 — умови агентського договору?`);

  // ─── Збереження звіту ────────────────────────────────────────
  report.finishedAt = new Date().toISOString();
  report.totalRecords = totalRecords;
  report.estimatedMigrationMinutes = estimatedMinutes;
  report.pendingQuestions = ['Q-01', 'Q-02', 'Q-03', 'Q-04', 'Q-05'];

  const reportPath = path.join(process.cwd(), 'zoho-verify-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  logger.info('');
  logger.info('═══════════════════════════════════════════════════════');
  logger.info(`  ✅ Верифікацію завершено. Звіт збережено:`);
  logger.info(`     ${reportPath}`);
  logger.info('');
  logger.info('  НАСТУПНІ КРОКИ:');
  logger.info('  1. Надати звіт BA для уточнення Q-01 — Q-05');
  logger.info('  2. Після відповідей — оновити PAYMENT_METHOD_MAP у zoho-migration.ts');
  logger.info('  3. Запустити міграцію: npm run migrate:zoho');
  logger.info('═══════════════════════════════════════════════════════');
  logger.info('');
}

// ─── Entry point ─────────────────────────────────────────────

if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN) {
  console.error('❌ Встановіть ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN у .env');
  process.exit(1);
}

main().catch((e) => {
  logger.error({ err: e.message }, 'Верифікація завершена з помилкою');
  process.exit(1);
});
