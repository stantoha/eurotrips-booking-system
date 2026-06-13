// ============================================================
// EUROTRIPS — tests/pages/login.page.ts
// Page Object Model для сторінки /login
//
// Принцип: ОДИН клас описує взаємодію з однією сторінкою.
// Тести НЕ містять деталей DOM — тільки методи сторінки.
// ============================================================

import { Page, expect } from '@playwright/test';

// ─── СЕЛЕКТОРИ ────────────────────────────────────────────────
// Централізовані тут — якщо верстка зміниться, правимо тут,
// а не в кожному тест-файлі.

const SELECTORS = {
  emailInput    : '#login-email',
  passwordInput : '#login-password',
  submitButton  : 'button[type="button"]:has-text("Увійти в систему")',
  errorAlert    : '[role="alert"]',
  serverError   : '.bg-red-50',                // серверна помилка (AlertCircle)
  loadingSpinner: '.animate-spin',
  logoText      : 'text=Eurotrips',
  pageTitle     : 'text=Вхід у систему',
  // Dev-only блок із тестовими акаунтами
  testAccountsToggle: 'text=Тестові акаунти',
  showPasswordBtn   : 'button[aria-label*="пароль"]',
} as const;

// ─── PAGE OBJECT ──────────────────────────────────────────────

export class LoginPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ── Navigation ───────────────────────────────────────────

  /** Відкрити сторінку логіну */
  async goto() {
    await this.page.goto('/login');
    // Чекаємо поки форма повністю відрендерилась
    await this.page.waitForSelector(SELECTORS.emailInput, { state: 'visible' });
  }

  /** Перевірити що ми на сторінці логіну */
  async assertOnLoginPage() {
    await expect(this.page).toHaveURL(/\/login/);
    await expect(this.page.locator(SELECTORS.pageTitle)).toBeVisible();
    await expect(this.page.locator(SELECTORS.logoText)).toBeVisible();
  }

  // ── Form interactions ────────────────────────────────────

  /** Заповнити поле email */
  async fillEmail(email: string) {
    const input = this.page.locator(SELECTORS.emailInput);
    await input.clear();
    await input.fill(email);
    // Тригеримо onTouched для Zod валідації
    await input.blur();
  }

  /** Заповнити поле пароля */
  async fillPassword(password: string) {
    const input = this.page.locator(SELECTORS.passwordInput);
    await input.clear();
    await input.fill(password);
    await input.blur();
  }

  /** Натиснути кнопку "Увійти в систему" */
  async clickSubmit() {
    await this.page.locator(SELECTORS.submitButton).click();
  }

  /** Перемкнути видимість пароля */
  async togglePasswordVisibility() {
    await this.page.locator(SELECTORS.showPasswordBtn).click();
  }

  // ── High-level actions ───────────────────────────────────

  /**
   * Повний логін: заповнити форму → клікнути submit → чекати результату.
   * @param waitForNavigation - чекати редіректу (true за замовчуванням)
   */
  async login(
    email: string,
    password: string,
    { waitForNavigation = true }: { waitForNavigation?: boolean } = {},
  ) {
    await this.fillEmail(email);
    await this.fillPassword(password);

    if (waitForNavigation) {
      // Чекаємо на URL-зміну одночасно із кліком
      await Promise.all([
        this.page.waitForURL((url) => !url.pathname.includes('/login'), {
          timeout: 10_000,
        }),
        this.clickSubmit(),
      ]);
    } else {
      await this.clickSubmit();
    }
  }

  /**
   * Логін з очікуванням помилки (невірні кредентали, заблокований акаунт).
   */
  async loginExpectingError(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickSubmit();
    // Чекаємо на появу серверної помилки
    await this.page.waitForSelector(SELECTORS.serverError, { state: 'visible', timeout: 8_000 });
  }

  // ── Assertions ───────────────────────────────────────────

  /** Перевірити що відображається помилка валідації для email */
  async assertEmailError(message?: string) {
    const error = this.page.locator('#email-error');
    await expect(error).toBeVisible();
    if (message) {
      await expect(error).toContainText(message);
    }
  }

  /** Перевірити що відображається помилка валідації для пароля */
  async assertPasswordError(message?: string) {
    const error = this.page.locator('#password-error');
    await expect(error).toBeVisible();
    if (message) {
      await expect(error).toContainText(message);
    }
  }

  /** Перевірити серверну помилку */
  async assertServerError(expectedText?: string) {
    const error = this.page.locator(SELECTORS.serverError);
    await expect(error).toBeVisible();
    if (expectedText) {
      await expect(error).toContainText(expectedText);
    }
  }

  /** Перевірити що кнопка submit у стані loading */
  async assertSubmitLoading() {
    // Кнопка містить "Входимо..." під час запиту
    await expect(
      this.page.locator('button:has-text("Входимо...")')
    ).toBeVisible();
  }

  /** Перевірити що URL змінився на dashboard після успішного логіну */
  async assertRedirectedToDashboard() {
    await expect(this.page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  }

  /** Перевірити що URL змінився на agent cabinet */
  async assertRedirectedToAgentCabinet() {
    await expect(this.page).toHaveURL(/\/agent/, { timeout: 10_000 });
  }

  // ── Dev helpers ───────────────────────────────────────────

  /** Переглянути тестові акаунти (тільки DEV-режим) */
  async expandTestAccounts() {
    const toggle = this.page.locator(SELECTORS.testAccountsToggle);
    if (await toggle.isVisible()) {
      await toggle.click();
    }
  }
}
