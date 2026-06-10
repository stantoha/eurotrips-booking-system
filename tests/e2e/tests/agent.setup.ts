// ============================================================
// EUROTRIPS — tests/agent.setup.ts
// Виконується ОДИН РАЗ перед тестами проекту 'setup:agent'.
// Логіниться як агент → зберігає auth state.
//
// Агент після логіну потрапляє на /agent/* (не /dashboard),
// тому очікуваний URL відрізняється від менеджера.
// ============================================================

import { test as setup, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { CREDENTIALS } from './fixtures/auth.fixtures';
import { AUTH_STATE } from '../playwright.config';

const authDir = path.dirname(AUTH_STATE.agent);
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

setup('зберегти auth-стан агента', async ({ page }) => {
  const creds = CREDENTIALS.agent;

  await page.goto('/login');
  await page.waitForSelector('#login-email', { state: 'visible' });

  await page.fill('#login-email', creds.email);
  await page.fill('#login-password', creds.password);

  // Агент редіректиться на /agent/dashboard (або /agent)
  await Promise.all([
    page.waitForURL(/\/agent/, { timeout: 15_000 }),
    page.locator('button:has-text("Увійти в систему")').click(),
  ]);

  await expect(page).toHaveURL(/\/agent/);

  await page.context().storageState({ path: AUTH_STATE.agent });

  console.log(`✓ Agent auth state збережено: ${AUTH_STATE.agent}`);
});
