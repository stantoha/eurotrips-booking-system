// ============================================================
// EUROTRIPS — playwright.config.ts
// E2E тестування: авторизація, RBAC, критичний шлях
//
// Запуск:
//   npm run test:e2e            → всі тести
//   npm run test:e2e:headed     → видимий браузер
//   npm run test:e2e -- --grep auth  → тільки auth тести
//   npm run test:e2e:ci         → CI-режим (без ретраїв UI)
// ============================================================

import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

// ─── ENV ─────────────────────────────────────────────────────
// Береться з .env.test або environment variables у CI

const BASE_URL  = process.env.PLAYWRIGHT_BASE_URL  ?? 'http://localhost:5173';
const API_URL   = process.env.PLAYWRIGHT_API_URL   ?? 'http://localhost:3000/api/v1';
const IS_CI     = !!process.env.CI;

// ─── AUTH STATE PATHS ─────────────────────────────────────────
// Playwright зберігає cookies + localStorage після логіну,
// щоб не логінитись заново в кожному тест-кейсі.
// Один файл = один авторизований користувач.

export const AUTH_STATE = {
  manager  : path.join(__dirname, 'tests/.auth/manager.json'),
  agent    : path.join(__dirname, 'tests/.auth/agent.json'),
  admin    : path.join(__dirname, 'tests/.auth/admin.json'),
  accountant: path.join(__dirname, 'tests/.auth/accountant.json'),
};

// ─── EXPORTS для використання у тест-файлах ──────────────────
export { BASE_URL, API_URL };

// ─── CONFIG ───────────────────────────────────────────────────
export default defineConfig({
  // ── Директорія з тестами ───────────────────────────────────
  testDir: './tests',

  // ── Глобальний timeout для одного тесту ───────────────────
  timeout: 30_000,

  // ── Timeout для expect() ───────────────────────────────────
  expect: {
    timeout: 8_000,
  },

  // ── CI: не показуємо ретрай UI ────────────────────────────
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,     // У CI — 2 авто-ретраї при flakiness
  workers: IS_CI ? 2 : 4,     // Локально швидше, CI обережніше

  // ── Reporter ───────────────────────────────────────────────
  reporter: IS_CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'on-failure', outputFolder: 'playwright-report' }]],

  // ── Глобальні налаштування для всіх браузерів ─────────────
  use: {
    baseURL: BASE_URL,

    // Завжди знімаємо screenshot та trace при провалі
    screenshot: 'only-on-failure',
    video:      'retain-on-failure',
    trace:      'on-first-retry',

    // Мова браузера — українська (відповідає системній мові)
    locale: 'uk-UA',
    timezoneId: 'Europe/Kyiv',

    // HttpOnly cookies передаються автоматично
    // (Playwright підтримує withCredentials за замовчуванням)
    ignoreHTTPSErrors: true,
  },

  // ── Проекти (браузери + ролі) ──────────────────────────────
  projects: [
    // ── SETUP: логінимось один раз, зберігаємо auth state ────
    // Ці проекти запускаються ПЕРЕД усіма тестами (dependency)
    {
      name: 'setup:manager',
      testMatch: /global\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'setup:agent',
      testMatch: /agent\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // ── AUTH TESTS (окремий проект, свіжа сесія) ─────────────
    {
      name: 'auth',
      testMatch: /auth\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: undefined, // Навмисно: auth тести стартують без сесії
      },
    },

    // ── RBAC TESTS (потребує auth state агента) ───────────────
    {
      name: 'rbac',
      testMatch: /rbac\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_STATE.agent,  // Логін збережений після setup
      },
      dependencies: ['setup:agent'],
    },

    // ── CHROMIUM (основний браузер) ───────────────────────────
    {
      name: 'chromium',
      testMatch: /(?!auth|rbac).*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_STATE.manager,
      },
      dependencies: ['setup:manager'],
    },

    // ── Firefox (Cross-browser, тільки в CI) ─────────────────
    ...(IS_CI
      ? [{
          name: 'firefox',
          testMatch: /auth\.spec\.ts/,  // тільки auth тести в Firefox
          use: { ...devices['Desktop Firefox'] },
        }]
      : []
    ),
  ],

  // ── Глобальний setup/teardown ─────────────────────────────
  // globalSetup: './tests/global-setup.ts',  // TODO: seed DB перед E2E
  // globalTeardown: './tests/global-teardown.ts',

  // ── Output ────────────────────────────────────────────────
  outputDir: 'test-results/',
});
