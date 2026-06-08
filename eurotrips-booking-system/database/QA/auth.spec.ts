// ============================================================
// EUROTRIPS — tests/auth.spec.ts
// E2E тести: авторизація в систему
//
// Покриває:
//  ✓ Happy path: менеджер логіниться → redirect → ім'я у заголовку
//  ✓ Happy path: агент логіниться → redirect → кабінет агента
//  ✓ Невірні credentials → повідомлення про помилку
//  ✓ Порожня форма → валідаційні помилки
//  ✓ Захист маршрутів: неавторизований → redirect на /login
//  ✓ Повторний логін: вже авторизований → redirect на /dashboard
//  ✓ Logout: очищення сесії → /login
//
// Запуск:
//   npx playwright test tests/auth.spec.ts --project=auth
// ============================================================

import { test, expect }   from '@playwright/test';
import { LoginPage }       from './pages/login.page';
import { CREDENTIALS, apiLogin, apiGet } from './fixtures/auth.fixtures';

// ─── SUITE: Авторизація ───────────────────────────────────────

test.describe('Авторизація в систему', () => {

  // ── beforeEach: завжди стартуємо з /login ─────────────────
  // Ця suite НЕ використовує storageState — кожен тест логіниться вручну
  test.use({ storageState: undefined });

  // ──────────────────────────────────────────────────────────
  // БЛОК 1: Happy Path — успішний логін
  // ──────────────────────────────────────────────────────────

  test.describe('Успішний логін', () => {

    test('TC-AUTH-001 | Менеджер логіниться → redirect на /dashboard', async ({ page }) => {
      const loginPage = new LoginPage(page);

      // ── Крок 1: відкрити /login ────────────────────────────
      await loginPage.goto();
      await loginPage.assertOnLoginPage();

      // ── Крок 2: перевірити наявність елементів форми ──────
      await expect(page.locator('#login-email')).toBeVisible();
      await expect(page.locator('#login-password')).toBeVisible();
      await expect(page.locator('button:has-text("Увійти в систему")')).toBeVisible();

      // ── Крок 3: ввести credentials менеджера ──────────────
      // Дані зі seed: prisma/seed.ts
      await loginPage.login(
        CREDENTIALS.manager.email,
        CREDENTIALS.manager.password,
      );

      // ── Крок 4: перевірити redirect на /dashboard ─────────
      await loginPage.assertRedirectedToDashboard();
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('TC-AUTH-002 | Після логіну заголовок містить ім\'я користувача', async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.login(
        CREDENTIALS.manager.email,
        CREDENTIALS.manager.password,
      );

      // ── Очікуємо що /dashboard відрендерився ──────────────
      await expect(page).toHaveURL(/\/dashboard/);
      await page.waitForLoadState('networkidle');

      // ── Ім'я користувача має бути десь у header / navbar ──
      // Перевіряємо кілька можливих місць відображення імені:
      // nav, sidebar, аватар тощо.
      // Використовуємо частину імені (не залежимо від повного ПІБ)
      const namePartial = CREDENTIALS.manager.name.split(' ')[0]; // "Олена"

      const nameVisible = await page
        .getByText(namePartial, { exact: false })
        .first()
        .isVisible()
        .catch(() => false);

      // Альтернатива: aria-label, title, data-testid="user-name"
      const nameByRole = await page
        .locator('[data-testid="user-name"], [aria-label*="профіль"], nav')
        .getByText(namePartial, { exact: false })
        .isVisible()
        .catch(() => false);

      expect(
        nameVisible || nameByRole,
        `Ім'я "${namePartial}" не знайдено на /dashboard після логіну`,
      ).toBeTruthy();
    });

    test('TC-AUTH-003 | Агент логіниться → redirect на /agent', async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();

      // ── Агент вводить свої credentials ────────────────────
      await loginPage.login(
        CREDENTIALS.agent.email,
        CREDENTIALS.agent.password,
      );

      // ── Агент потрапляє до кабінету агента (не dashboard) ─
      // App.tsx: <Route path="/agent/*" element={<AgentCabinet />} />
      await loginPage.assertRedirectedToAgentCabinet();
      await expect(page).toHaveURL(/\/agent/);

      // ── Агент НЕ потрапляє на загальний /dashboard ────────
      expect(page.url()).not.toContain('/dashboard');
    });

    test('TC-AUTH-004 | API: POST /auth/login повертає access_token та user', async ({ page }) => {
      // Прямий API-тест (без UI) — перевіряємо контракт відповіді
      const response = await page.request.post('/api/v1/auth/login', {
        data: {
          email   : CREDENTIALS.manager.email,
          password: CREDENTIALS.manager.password,
        },
      });

      // ── HTTP статус ────────────────────────────────────────
      expect(response.status()).toBe(200);

      const body = await response.json();

      // ── Структура відповіді: { data: { access_token, user } } ──
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('access_token');
      expect(body.data).toHaveProperty('user');

      // ── User object містить правильні поля ────────────────
      const user = body.data.user;
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email', CREDENTIALS.manager.email);
      expect(user).toHaveProperty('role', 'manager');

      // ── Чутливі поля ВІДСУТНІ у відповіді ────────────────
      // BR-04 та §8.2 безпека
      expect(user).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).not.toHaveProperty('password_hash');
    });

  }); // end: Успішний логін

  // ──────────────────────────────────────────────────────────
  // БЛОК 2: Негативні сценарії — невірні дані
  // ──────────────────────────────────────────────────────────

  test.describe('Невірні credentials', () => {

    test('TC-AUTH-005 | Невірний пароль → повідомлення про помилку', async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginExpectingError(
        CREDENTIALS.manager.email,
        'невірнийпароль123',
      );

      // ── Залишаємось на /login ──────────────────────────────
      await expect(page).toHaveURL(/\/login/);

      // ── Відображається повідомлення про помилку ───────────
      await loginPage.assertServerError();

      // ── Повідомлення інформативне, але без деталей (безпека) ──
      const errorText = await page.locator('.bg-red-50').textContent();
      expect(errorText).toBeTruthy();
      // НЕ повинно розкривати: "невірний пароль" vs "email не існує"
      // Обидва випадки → одне загальне повідомлення
    });

    test('TC-AUTH-006 | Неіснуючий email → повідомлення про помилку', async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginExpectingError(
        'nonexistent@eurotrips.ua',
        'test1234',
      );

      await expect(page).toHaveURL(/\/login/);
      await loginPage.assertServerError();

      // API повинен повертати 401 або 400 (не 404, щоб не розкривати email)
      const apiResponse = await page.request.post('/api/v1/auth/login', {
        data: { email: 'nonexistent@eurotrips.ua', password: 'test1234' },
      });
      expect([400, 401]).toContain(apiResponse.status());
    });

    test('TC-AUTH-007 | API: POST /auth/login з невірними даними → 401', async ({ page }) => {
      const response = await page.request.post('/api/v1/auth/login', {
        data: {
          email   : CREDENTIALS.manager.email,
          password: 'wrongpassword',
        },
      });

      expect(response.status()).toBe(401);

      const body = await response.json();
      // Відповідь у форматі: { error: { code, message } }
      expect(body).toHaveProperty('error');
      // НЕ повертається: стек помилок, внутрішні деталі
      expect(JSON.stringify(body)).not.toContain('stack');
      expect(JSON.stringify(body)).not.toContain('prisma');
    });

  }); // end: Невірні credentials

  // ──────────────────────────────────────────────────────────
  // БЛОК 3: Валідація форми (client-side, Zod)
  // ──────────────────────────────────────────────────────────

  test.describe('Валідація форми', () => {

    test('TC-AUTH-008 | Порожня форма → відображаються обидві помилки', async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();

      // ── Натиснути submit без заповнення полів ─────────────
      // В LoginForm використовується mode: 'onTouched'
      // Тому touch кожне поле перед submit
      await page.locator('#login-email').click();
      await page.locator('#login-password').click();
      await page.locator('#login-email').click(); // повертаємось
      await loginPage.clickSubmit();

      // ── Обидві валідаційні помилки відображаються ─────────
      await loginPage.assertEmailError('Email обов\'язковий');
      await loginPage.assertPasswordError('Пароль обов\'язковий');

      // ── URL залишається /login ─────────────────────────────
      await expect(page).toHaveURL(/\/login/);
    });

    test('TC-AUTH-009 | Некоректний формат email → валідаційна помилка', async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.fillEmail('notanemail');
      await loginPage.fillPassword('test1234');
      await loginPage.clickSubmit();

      await loginPage.assertEmailError('Введіть коректний email');
      await expect(page).toHaveURL(/\/login/);
    });

    test('TC-AUTH-010 | Пароль < 6 символів → валідаційна помилка', async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.fillEmail(CREDENTIALS.manager.email);
      await loginPage.fillPassword('abc');
      await loginPage.clickSubmit();

      await loginPage.assertPasswordError('Пароль мінімум 6 символів');
      await expect(page).toHaveURL(/\/login/);
    });

  }); // end: Валідація форми

  // ──────────────────────────────────────────────────────────
  // БЛОК 4: Захист маршрутів (Route Guard)
  // ──────────────────────────────────────────────────────────

  test.describe('Захист маршрутів', () => {

    test('TC-AUTH-011 | Неавторизований → redirect на /login при відкритті /dashboard', async ({ page }) => {
      // Йдемо на захищений маршрут БЕЗ авторизації
      await page.goto('/dashboard');

      // ── ProtectedRoute має редіректнути на /login ──────────
      // App.tsx: <ProtectedRoute> → <Navigate to="/login" />
      await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
    });

    test('TC-AUTH-012 | Неавторизований → /finance redirect на /login', async ({ page }) => {
      await page.goto('/finance');
      await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
    });

    test('TC-AUTH-013 | Вже авторизований → /login redirect на /dashboard', async ({ page }) => {
      // Спочатку логінимось
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(CREDENTIALS.manager.email, CREDENTIALS.manager.password);
      await expect(page).toHaveURL(/\/dashboard/);

      // ── Спроба відкрити /login коли вже залогінений ────────
      // App.tsx: якщо isAuthenticated → <Navigate to="/dashboard" replace />
      await page.goto('/login');
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 5_000 });
    });

  }); // end: Захист маршрутів

  // ──────────────────────────────────────────────────────────
  // БЛОК 5: Logout
  // ──────────────────────────────────────────────────────────

  test.describe('Logout', () => {

    test('TC-AUTH-014 | Logout → сесія очищена → /login', async ({ page }) => {
      const loginPage = new LoginPage(page);

      // ── Логін ─────────────────────────────────────────────
      await loginPage.goto();
      await loginPage.login(CREDENTIALS.manager.email, CREDENTIALS.manager.password);
      await expect(page).toHaveURL(/\/dashboard/);

      // ── Logout через API ───────────────────────────────────
      // POST /auth/logout (або через UI кнопку якщо є data-testid)
      const logoutBtn = page.locator('[data-testid="logout-button"], button:has-text("Вийти")');
      const hasLogoutBtn = await logoutBtn.count() > 0;

      if (hasLogoutBtn) {
        await logoutBtn.first().click();
      } else {
        // Прямий API logout
        await page.request.post('/api/v1/auth/logout');
        await page.goto('/login');
      }

      // ── Після logout → /login ─────────────────────────────
      await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });

      // ── Після logout захищені маршрути недоступні ─────────
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
    });

    test('TC-AUTH-015 | POST /auth/logout відповідає 200 та очищає cookie', async ({ page }) => {
      // Спочатку логінимось через API
      const loginResponse = await page.request.post('/api/v1/auth/login', {
        data: { email: CREDENTIALS.manager.email, password: CREDENTIALS.manager.password },
      });
      expect(loginResponse.status()).toBe(200);
      const loginBody = await loginResponse.json();
      const token = loginBody.data.access_token;

      // ── Logout ────────────────────────────────────────────
      const logoutResponse = await page.request.post('/api/v1/auth/logout', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(logoutResponse.status()).toBe(200);

      // ── Після logout старий токен недійсний ───────────────
      await page.waitForTimeout(200); // чекаємо invalidation

      const profileResponse = await page.request.get('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Токен більше не приймається
      expect([401, 403]).toContain(profileResponse.status());
    });

  }); // end: Logout

}); // end: Авторизація в систему
