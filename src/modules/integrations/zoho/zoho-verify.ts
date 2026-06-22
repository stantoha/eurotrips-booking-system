// =============================================================
// EUROTRIPS — Zoho CRM Field Verification
//
// Запуск:
//   npm run verify:zoho
//
// Що робить:
//   1. Отримує access_token через OAuth2 refresh_token
//   2. Для кожного модуля отримує список полів (GET /fields)
//   3. Зберігає результат у zoho-fields-actual.json
//   4. Виводить зведення у stdout
//
// Змінні оточення (.env):
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN
//   ZOHO_BASE_URL (optional, default: https://www.zohoapis.com/crm/v8)
//   ZOHO_AUTH_URL (optional, default: https://accounts.zoho.com)
// =============================================================

import 'dotenv/config';
import fs    from 'node:fs/promises';
import path  from 'node:path';
import axios, { AxiosError } from 'axios';
import pino                  from 'pino';
import type { ZohoTokenResponse } from './zoho.types';

const logger = pino({
  transport: { target: 'pino-pretty', options: { colorize: true } },
  level: process.env.LOG_LEVEL ?? 'info',
});

// ─── ENV ──────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Не встановлена обов'язкова змінна: ${key}`);
  return v;
}

const ZOHO_CLIENT_ID     = requireEnv('ZOHO_CLIENT_ID');
const ZOHO_CLIENT_SECRET = requireEnv('ZOHO_CLIENT_SECRET');
const ZOHO_REFRESH_TOKEN = requireEnv('ZOHO_REFRESH_TOKEN');
const ZOHO_BASE_URL      = process.env.ZOHO_BASE_URL ?? 'https://www.zohoapis.com/crm/v8';
const ZOHO_AUTH_URL      = process.env.ZOHO_AUTH_URL ?? 'https://accounts.zoho.com';

const PAYMENT_MODULE = process.env.ZOHO_PAYMENT_MODULE ?? 'CustomModule3';
const TRAVEL_MODULE  = process.env.ZOHO_TRAVEL_MODULE  ?? 'Travel';

const OUT_PATH = path.resolve(process.cwd(), 'zoho-fields-actual.json');

// ─── Token Manager ────────────────────────────────────────────

class ZohoTokenManager {
  private token:     string | null = null;
  private expiresAt: number        = 0;

  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.expiresAt) return this.token;
    return this.refresh();
  }

  private async refresh(): Promise<string> {
    logger.debug('Zoho OAuth2: оновлення токена...');
    const res = await axios.post<ZohoTokenResponse>(
      `${ZOHO_AUTH_URL}/oauth/v2/token`, null,
      { params: { refresh_token: ZOHO_REFRESH_TOKEN, client_id: ZOHO_CLIENT_ID,
                  client_secret: ZOHO_CLIENT_SECRET, grant_type: 'refresh_token' } },
    );
    if (!res.data.access_token) throw new Error('Zoho OAuth2: access_token відсутній');
    const token    = res.data.access_token;
    this.token     = token;
    this.expiresAt = Date.now() + (res.data.expires_in - 60) * 1_000;
    logger.debug('Zoho OAuth2: токен оновлено');
    return token;
  }
}

const tokenManager = new ZohoTokenManager();

// ─── Zoho GET helper ──────────────────────────────────────────

async function zohoGet<T>(endpoint: string, retried = false): Promise<T> {
  const token = await tokenManager.getToken();
  try {
    const res = await axios.get<T>(`${ZOHO_BASE_URL}${endpoint}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    return res.data;
  } catch (err) {
    const e = err as AxiosError;
    if (e.response?.status === 401 && !retried) {
      logger.warn('Zoho API 401 — примусово оновлюємо токен');
      (tokenManager as any).expiresAt = 0;
      return zohoGet<T>(endpoint, true);
    }
    throw err;
  }
}

// ─── Field fetcher ────────────────────────────────────────────

interface ZohoField {
  api_name:     string;
  display_label: string;
  data_type:    string;
  required:     boolean;
  custom_field: boolean;
}

interface ZohoFieldsResponse {
  fields: ZohoField[];
}

async function fetchFields(module: string): Promise<ZohoField[]> {
  logger.info(`Отримуємо поля: ${module}`);
  try {
    const res = await zohoGet<ZohoFieldsResponse>(`/settings/fields?module=${module}`);
    return res.fields ?? [];
  } catch (err) {
    const e = err as AxiosError;
    logger.warn({ module, status: e.response?.status, data: e.response?.data },
      `Не вдалось отримати поля для модуля ${module}`);
    return [];
  }
}

// ─── Module list ──────────────────────────────────────────────

const MODULES_TO_VERIFY = [
  'Deals',
  'Contacts',
  'Leads',
  'Products',
  'Agencies',
  'Vendors',
  TRAVEL_MODULE,
  PAYMENT_MODULE,
  'Invoices',
];

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  logger.info('=== Zoho CRM Field Verification ===');
  logger.info(`Базовий URL: ${ZOHO_BASE_URL}`);

  // Test OAuth2 connectivity
  logger.info('Перевірка OAuth2...');
  await tokenManager.getToken();
  logger.info('OAuth2: ОК');

  const result: Record<string, { total: number; custom: number; required: number; fields: ZohoField[] }> = {};
  let totalFields = 0;

  for (const mod of MODULES_TO_VERIFY) {
    const fields = await fetchFields(mod);
    const custom   = fields.filter(f => f.custom_field).length;
    const required = fields.filter(f => f.required).length;
    result[mod] = { total: fields.length, custom, required, fields };
    totalFields += fields.length;
    logger.info(`  ${mod}: ${fields.length} полів (${custom} кастомних, ${required} обов'язкових)`);
  }

  const output = {
    verifiedAt: new Date().toISOString(),
    zohoBaseUrl: ZOHO_BASE_URL,
    totalModules: MODULES_TO_VERIFY.length,
    totalFields,
    modules: result,
  };

  await fs.writeFile(OUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  logger.info(`Результат збережено: ${OUT_PATH}`);
  logger.info('=== Перевірка завершена ===');
}

main().catch(err => {
  logger.error(err, 'Zoho verify: помилка');
  process.exit(1);
});
