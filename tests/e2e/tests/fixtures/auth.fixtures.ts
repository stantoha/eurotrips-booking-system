// ============================================================
// EUROTRIPS — tests/fixtures/auth.fixtures.ts
// Тест-фікстури для авторизації різних ролей.
//
// ПАТЕРН:
//   test.use({ storageState: AUTH_STATE.agent }) — беремо збережену сесію
//   або використовуємо loginAs() для свіжого логіну всередині тесту
//
// Seed-дані відповідають prisma/seed.ts (бекенд)
// ============================================================

import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { API_URL, BASE_URL } from '../../playwright.config';

// ─── SEED CREDENTIALS ────────────────────────────────────────
// Ці дані мають ТОЧНО відповідати даним у prisma/seed.ts бекенду.
// Якщо seed змінився — оновити тут.

export const CREDENTIALS = {
  admin: {
    email   : 'admin@eurotrips.ua',
    password: 'test1234',
    name    : 'Адміністратор',
    role    : 'admin',
  },
  manager: {
    email   : 'manager@eurotrips.ua',
    password: 'test1234',
    name    : 'Олена Коваль',          // ПІБ зі seed
    role    : 'manager',
  },
  ops_manager: {
    email   : 'ops@eurotrips.ua',
    password: 'test1234',
    name    : 'Операційний менеджер',
    role    : 'ops_manager',
  },
  accountant: {
    email   : 'finance@eurotrips.ua',
    password: 'test1234',
    name    : 'Фінансист',
    role    : 'accountant',
  },
  agent: {
    email   : 'agent@agency.ua',
    password: 'test1234',
    name    : 'Тестовий Агент',        // ПІБ зі seed
    role    : 'agent',
    // Seed booking IDs — бронювання ТІЛЬКИ цього агента
    ownBookingId    : 'ET-2025-00001',
    otherBookingId  : 'ET-2025-00002', // бронювання іншого агента
  },
  agent2: {
    email   : 'agent2@agency.ua',
    password: 'test1234',
    name    : 'Другий Агент',
    role    : 'agent',
  },
} as const;

// ─── ТИПИ ─────────────────────────────────────────────────────

export type UserRole = keyof typeof CREDENTIALS;

// ─── API AUTH HELPER ─────────────────────────────────────────
// Логін через API (без браузера) — для швидкого отримання токену
// у тестах, де потрібно перевірити API-відповіді безпосередньо.

export async function apiLogin(
  page: Page,
  role: UserRole,
): Promise<{ accessToken: string; user: Record<string, unknown> }> {
  const creds = CREDENTIALS[role];

  const response = await page.request.post(`${API_URL}/auth/login`, {
    data: {
      email   : creds.email,
      password: creds.password,
    },
    headers: {
      'Content-Type'  : 'application/json',
      'Accept-Language': 'uk',
    },
  });

  expect(response.status(), `API login failed for ${role}`).toBe(200);

  const body = await response.json();
  return {
    accessToken: body.data.access_token,
    user        : body.data.user,
  };
}

/**
 * Виконати GET-запит до API із токеном вказаної ролі.
 * Корисно для перевірки того, що API повертає / не повертає.
 */
export async function apiGet(
  page: Page,
  endpoint: string,
  token: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await page.request.get(`${API_URL}${endpoint}`, {
    headers: {
      Authorization  : `Bearer ${token}`,
      'Accept-Language': 'uk',
    },
  });

  return {
    status: response.status(),
    body  : await response.json(),
  };
}

// ─── UI LOGIN HELPER ──────────────────────────────────────────
// Логін через UI (форма) — для тестів, що перевіряють саму форму.

export async function uiLogin(
  page: Page,
  role: UserRole,
): Promise<void> {
  const creds = CREDENTIALS[role];

  await page.goto('/login');
  await page.waitForSelector('#login-email', { state: 'visible' });

  await page.fill('#login-email', creds.email);
  await page.fill('#login-password', creds.password);

  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10_000 }),
    page.locator('button:has-text("Увійти в систему")').click(),
  ]);
}

// ─── CUSTOM FIXTURES ──────────────────────────────────────────
// Розширення стандартних test-fixtures Playwright.
// Використання:
//   import { test } from '../fixtures/auth.fixtures';
//   test('...', async ({ managerPage, agentPage }) => { ... });

type AuthFixtures = {
  /** Сторінка, залогінена як менеджер (UI логін) */
  managerPage  : Page;
  /** Сторінка, залогінена як агент (UI логін) */
  agentPage    : Page;
  /** Токен доступу для агента (API логін, без UI) */
  agentToken   : string;
  /** Токен доступу для менеджера (API логін, без UI) */
  managerToken : string;
  /** Токен доступу для адміна */
  adminToken   : string;
};

export const test = base.extend<AuthFixtures>({

  // ── managerPage: свіжий логін для кожного тесту ───────────
  managerPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page    = await context.newPage();
    await uiLogin(page, 'manager');
    await use(page);
    await context.close();
  },

  // ── agentPage: свіжий логін агента ────────────────────────
  agentPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page    = await context.newPage();
    await uiLogin(page, 'agent');
    await use(page);
    await context.close();
  },

  // ── API токени (без браузера) ─────────────────────────────
  agentToken: async ({ page }, use) => {
    const { accessToken } = await apiLogin(page, 'agent');
    await use(accessToken);
  },

  managerToken: async ({ page }, use) => {
    const { accessToken } = await apiLogin(page, 'manager');
    await use(accessToken);
  },

  adminToken: async ({ page }, use) => {
    const { accessToken } = await apiLogin(page, 'admin');
    await use(accessToken);
  },
});

export { expect } from '@playwright/test';
