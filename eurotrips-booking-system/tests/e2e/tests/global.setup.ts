// ============================================================
// EUROTRIPS — tests/global.setup.ts
// Виконується ОДИН РАЗ перед усіма тестами проекту 'setup:manager'.
// Логіниться як менеджер через UI → зберігає cookies та localStorage
// у файл tests/.auth/manager.json.
//
// Наступні тести завантажують цей стан замість повторного логіну
// → значно пришвидшує тест-сюїт.
// ============================================================

import { test as setup, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { CREDENTIALS } from './fixtures/auth.fixtures';
import { AUTH_STATE } from '../playwright.config';

// Переконуємось що директорія існує
const authDir = path.dirname(AUTH_STATE.manager);
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

setup('зберегти auth-стан менеджера', async ({ page }) => {
  const creds = CREDENTIALS.manager;

  // ── Логін через UI ────────────────────────────────────────
  await page.goto('/login');
  await page.waitForSelector('#login-email', { state: 'visible' });

  await page.fill('#login-email', creds.email);
  await page.fill('#login-password', creds.password);

  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 15_000 }),
    page.locator('button:has-text("Увійти в систему")').click(),
  ]);

  // ── Перевірка успішного логіну ───────────────────────────
  await expect(page).toHaveURL(/\/dashboard/);

  // ── Зберігаємо стан (cookies + sessionStorage + localStorage) ──
  await page.context().storageState({ path: AUTH_STATE.manager });

  console.log(`✓ Manager auth state збережено: ${AUTH_STATE.manager}`);
});
