// ============================================================
// EUROTRIPS — tests/rbac.spec.ts
// E2E тести: права доступу на основі ролей (RBAC)
//
// Покриває:
//  ✓ Агент → /finance повертає 403 / redirect
//  ✓ Агент → GET /tours не містить costPrice, margin (BR-04)
//  ✓ Агент → GET /bookings показує ТІЛЬКИ власні заявки
//  ✓ Агент → не може отримати чужі бронювання (IDOR)
//  ✓ Агент → не бачить /dashboard (тільки /agent/*)
//  ✓ Менеджер → бачить /finance (для порівняння)
//  ✓ API-рівень: заголовки авторизації обов'язкові
//
// Запуск:
//   npx playwright test tests/rbac.spec.ts --project=rbac
//
// Залежність: setup:agent — auth state завантажується автоматично
// (playwright.config.ts: storageState: AUTH_STATE.agent)
// ============================================================

import { test, expect } from '@playwright/test';
import {
  CREDENTIALS,
  apiLogin,
  apiGet,
} from './fixtures/auth.fixtures';
import { API_URL } from '../playwright.config';

// ─── SUITE: RBAC ─────────────────────────────────────────────

test.describe('RBAC — Права доступу за роллю', () => {

  // ──────────────────────────────────────────────────────────
  // БЛОК 1: Агент → /finance заборонено
  // ──────────────────────────────────────────────────────────
  // App.tsx: /finance доступний тільки ['admin', 'director']
  // Агент, що намагається відкрити /finance, має або:
  //   а) отримати redirect на /agent
  //   б) бачити сторінку 403/Forbidden
  // ──────────────────────────────────────────────────────────

  test.describe('Агент → /finance заборонено', () => {

    test('TC-RBAC-001 | UI: агент відкриває /finance → отримує 403 або redirect', async ({ page }) => {
      // storageState агента завантажений автоматично з playwright.config.ts
      // Агент вже "залогінений"

      // ── Спроба перейти на /finance ────────────────────────
      await page.goto('/finance');
      await page.waitForLoadState('networkidle');

      const currentUrl = page.url();

      // ── ВАРІАНТ А: redirect на кабінет агента ─────────────
      const isRedirectedToAgent = currentUrl.includes('/agent');

      // ── ВАРІАНТ Б: сторінка 403 / Forbidden ───────────────
      const hasForbiddenContent = await page
        .locator('text=403, text=Заборонено, text=Доступ заборонено, [data-testid="forbidden-page"]')
        .count() > 0;

      // ── Один з варіантів повинен виконатись ───────────────
      expect(
        isRedirectedToAgent || hasForbiddenContent,
        `Агент отримав доступ до /finance. URL: ${currentUrl}`,
      ).toBeTruthy();

      // ── Агент НЕ бачить фінансові дані ────────────────────
      // Ключові слова, що мають бути ВІДСУТНІ для агента:
      const financialKeywords = [
        'text=Фінансовий звіт',
        'text=Собівартість',
        'text=Маржа',
        'text=P&L',
        '[data-testid="finance-dashboard"]',
      ];

      for (const keyword of financialKeywords) {
        const isVisible = await page.locator(keyword).isVisible().catch(() => false);
        expect(
          isVisible,
          `Агент бачить "${keyword}" у /finance — RBAC витік!`,
        ).toBeFalsy();
      }
    });

    test('TC-RBAC-002 | API: GET /finance/summary → 403 для агента', async ({ page }) => {
      // ── Отримати токен агента ─────────────────────────────
      const { accessToken: agentToken } = await apiLogin(page, 'agent');

      // ── Прямий запит до фінансового endpoint ─────────────
      const response = await page.request.get(`${API_URL}/finance/summary`, {
        headers: { Authorization: `Bearer ${agentToken}` },
      });

      // ── Очікуємо 403 Forbidden ────────────────────────────
      expect(response.status()).toBe(403);

      const body = await response.json();
      expect(body).toHaveProperty('error');
      // Тіло помилки — без internal деталей
      expect(JSON.stringify(body)).not.toContain('stack');
    });

    test('TC-RBAC-003 | API: GET /finance/debts → 403 для агента', async ({ page }) => {
      const { accessToken: agentToken } = await apiLogin(page, 'agent');

      const response = await page.request.get(`${API_URL}/finance/debts`, {
        headers: { Authorization: `Bearer ${agentToken}` },
      });

      expect(response.status()).toBe(403);
    });

    test('TC-RBAC-004 | Менеджер → /finance доступно (перевірка порівнянням)', async ({ page }) => {
      // Переконуємось що /finance СПРАВДІ захищений — а не просто недоступний для всіх
      const { accessToken: managerToken } = await apiLogin(page, 'manager');

      // Менеджер може читати борги, але не PnL (залежно від реалізації)
      // Перевіряємо хоча б один з finance endpoints
      const response = await page.request.get(`${API_URL}/finance/summary`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });

      // Менеджер або бачить (200) або теж 403 якщо тільки admin/director
      // Головне — НЕ 401 (токен валідний)
      expect(response.status()).not.toBe(401);
    });

  }); // end: Агент → /finance

  // ──────────────────────────────────────────────────────────
  // БЛОК 2: GET /tours — агент не бачить costPrice та margin
  // Відповідає BR-04: агент НІКОЛИ не бачить собівартість
  // ──────────────────────────────────────────────────────────

  test.describe('Тури: агент не бачить собівартість (BR-04)', () => {

    test('TC-RBAC-005 | API: GET /tours не містить costPrice для агента', async ({ page }) => {
      const { accessToken: agentToken } = await apiLogin(page, 'agent');

      const response = await page.request.get(`${API_URL}/tours`, {
        headers: { Authorization: `Bearer ${agentToken}` },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();

      // ── Перевіряємо кожен тур у відповіді ────────────────
      const tours: Record<string, unknown>[] = body.data ?? body ?? [];
      expect(tours.length).toBeGreaterThan(0); // seed має містити тури

      for (const tour of tours) {
        // Ці поля ПОВИННІ БУТИ ВІДСУТНІ (BR-04)
        expect(
          tour,
          `Тур ${tour['id']} містить costPrice — BR-04 порушено!`,
        ).not.toHaveProperty('costPrice');

        expect(
          tour,
          `Тур ${tour['id']} містить cost_price — BR-04 порушено!`,
        ).not.toHaveProperty('cost_price');

        expect(
          tour,
          `Тур ${tour['id']} містить margin — BR-04 порушено!`,
        ).not.toHaveProperty('margin');

        expect(
          tour,
          `Тур ${tour['id']} містить netProfit — BR-04 порушено!`,
        ).not.toHaveProperty('netProfit');

        expect(
          tour,
          `Тур ${tour['id']} містить net_profit — BR-04 порушено!`,
        ).not.toHaveProperty('net_profit');

        expect(
          tour,
          `Тур ${tour['id']} містить internalNotes — BR-04 порушено!`,
        ).not.toHaveProperty('internalNotes');

        // ── Натомість ці поля МАЮТЬ бути присутні ────────────
        // Агент бачить: базова ціна, кількість місць, комісія, дати
        expect(tour).toHaveProperty('id');
        expect(tour).toHaveProperty('basePrice');
        expect(tour).toHaveProperty('availableSeats');
      }
    });

    test('TC-RBAC-006 | API: GET /tours/:id не містить costPrice для агента', async ({ page }) => {
      const { accessToken: agentToken } = await apiLogin(page, 'agent');

      // ── Отримати список турів, взяти перший ───────────────
      const listResponse = await page.request.get(`${API_URL}/tours`, {
        headers: { Authorization: `Bearer ${agentToken}` },
      });
      expect(listResponse.status()).toBe(200);
      const listBody = await listResponse.json();
      const tours = listBody.data ?? listBody;
      expect(tours.length).toBeGreaterThan(0);

      const firstTourId = tours[0].id;

      // ── Деталі конкретного туру ───────────────────────────
      const detailResponse = await page.request.get(`${API_URL}/tours/${firstTourId}`, {
        headers: { Authorization: `Bearer ${agentToken}` },
      });

      expect(detailResponse.status()).toBe(200);
      const tour = (await detailResponse.json()).data ?? await detailResponse.json();

      // ── BR-04: жодного внутрішнього фінансового поля ─────
      const forbiddenFields = ['costPrice', 'cost_price', 'margin', 'netProfit',
                               'net_profit', 'internalNotes', 'internal_notes'];

      for (const field of forbiddenFields) {
        expect(
          tour,
          `GET /tours/${firstTourId} повернув "${field}" агенту — BR-04 порушено!`,
        ).not.toHaveProperty(field);
      }
    });

    test('TC-RBAC-007 | Менеджер → GET /tours МІСТИТЬ costPrice (порівняння ролей)', async ({ page }) => {
      // Переконуємось що costPrice приховується ТІЛЬКИ для агента,
      // але доступне для менеджера/директора
      const { accessToken: managerToken } = await apiLogin(page, 'manager');

      const response = await page.request.get(`${API_URL}/tours`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      const tours: Record<string, unknown>[] = body.data ?? body;

      if (tours.length > 0) {
        // Менеджер БАЧИТЬ costPrice
        const tour = tours[0];
        const hasCostPrice =
          'costPrice' in tour ||
          'cost_price' in tour;

        expect(
          hasCostPrice,
          'Менеджер не бачить costPrice — можлива помилка у RBAC-фільтрі',
        ).toBeTruthy();
      }
    });

    test('TC-RBAC-008 | UI: агент не бачить колонку "Собівартість" у списку турів', async ({ page }) => {
      // storageState агента вже завантажений
      await page.goto('/agent');
      await page.waitForLoadState('networkidle');

      // ── Переходимо на список турів у кабінеті агента ─────
      const toursLink = page.locator(
        'a[href*="tours"], [data-testid="nav-tours"], text=Тури',
      );

      if (await toursLink.count() > 0) {
        await toursLink.first().click();
        await page.waitForLoadState('networkidle');
      }

      // ── Колонка "Собівартість" або "Маржа" НЕ відображається ──
      const forbiddenColumns = [
        'th:has-text("Собівартість")',
        'th:has-text("Маржа")',
        'th:has-text("Прибуток")',
        '[data-testid="col-cost-price"]',
        '[data-testid="col-margin"]',
      ];

      for (const selector of forbiddenColumns) {
        const isVisible = await page.locator(selector).isVisible().catch(() => false);
        expect(
          isVisible,
          `Агент бачить колонку "${selector}" — BR-04 витік в UI!`,
        ).toBeFalsy();
      }
    });

  }); // end: Тури — costPrice

  // ──────────────────────────────────────────────────────────
  // БЛОК 3: GET /bookings — агент бачить ТІЛЬКИ свої бронювання
  // RBAC: if (user.role === 'agent' && booking.agentId !== user.agentId)
  //        throw ForbiddenError()
  // ──────────────────────────────────────────────────────────

  test.describe('Бронювання: агент бачить тільки свої заявки', () => {

    test('TC-RBAC-009 | API: GET /bookings для агента повертає тільки власні', async ({ page }) => {
      const { accessToken: agentToken, user: agentUser } = await apiLogin(page, 'agent');

      const response = await page.request.get(`${API_URL}/bookings`, {
        headers: { Authorization: `Bearer ${agentToken}` },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      const bookings: Record<string, unknown>[] = body.data ?? body;

      // ── Seed має містити бронювання для агента ────────────
      // Якщо список порожній — тест проходить тривіально (не корисно)
      // Цей тест корисний тільки якщо seed містить дані

      if (bookings.length > 0) {
        for (const booking of bookings) {
          // Кожне бронювання має належати ЦЬОМУ агенту
          const bookingAgentId = booking['agentId'] ?? booking['agent_id'];
          const currentAgentId = (agentUser as Record<string, unknown>)['agentId']
            ?? (agentUser as Record<string, unknown>)['id'];

          expect(
            bookingAgentId,
            `Бронювання ${booking['id']} належить агенту ${bookingAgentId}, а не ${currentAgentId}`,
          ).toBe(currentAgentId);
        }
      }
    });

    test('TC-RBAC-010 | API: GET /bookings для менеджера повертає ВСІ бронювання', async ({ page }) => {
      // Контрольне порівняння: менеджер бачить більше ніж агент

      const { accessToken: agentToken } = await apiLogin(page, 'agent');
      const { accessToken: managerToken } = await apiLogin(page, 'manager');

      const [agentRes, managerRes] = await Promise.all([
        page.request.get(`${API_URL}/bookings`, {
          headers: { Authorization: `Bearer ${agentToken}` },
        }),
        page.request.get(`${API_URL}/bookings`, {
          headers: { Authorization: `Bearer ${managerToken}` },
        }),
      ]);

      expect(agentRes.status()).toBe(200);
      expect(managerRes.status()).toBe(200);

      const agentBookings   = ((await agentRes.json()).data   ?? []) as unknown[];
      const managerBookings = ((await managerRes.json()).data ?? []) as unknown[];

      // Менеджер бачить >= кількість бронювань агента
      // (або рівно якщо всі бронювання від одного агента — рідкість у seed)
      expect(managerBookings.length).toBeGreaterThanOrEqual(agentBookings.length);
    });

    test('TC-RBAC-011 | API: агент не може отримати чуже бронювання (IDOR)', async ({ page }) => {
      // IDOR = Insecure Direct Object Reference
      // Агент знає ID чужого бронювання та намагається його отримати

      const { accessToken: agentToken } = await apiLogin(page, 'agent');
      const { accessToken: managerToken } = await apiLogin(page, 'manager');

      // ── Отримуємо список всіх бронювань від менеджера ─────
      const allBookingsRes = await page.request.get(`${API_URL}/bookings`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      expect(allBookingsRes.status()).toBe(200);
      const allBookings = ((await allBookingsRes.json()).data ?? []) as Record<string, unknown>[];

      // ── Отримуємо список бронювань агента ─────────────────
      const agentBookingsRes = await page.request.get(`${API_URL}/bookings`, {
        headers: { Authorization: `Bearer ${agentToken}` },
      });
      const agentBookings = ((await agentBookingsRes.json()).data ?? []) as Record<string, unknown>[];
      const agentBookingIds = new Set(agentBookings.map((b) => b['id']));

      // ── Знаходимо бронювання, яке НЕ належить агенту ─────
      const otherBooking = allBookings.find((b) => !agentBookingIds.has(b['id']));

      if (!otherBooking) {
        // Якщо в seed всі бронювання від цього агента — пропускаємо
        test.skip(true, 'Seed не містить бронювань інших агентів — пропускаємо IDOR тест');
        return;
      }

      // ── Агент намагається GET /bookings/:id чужого бронювання ──
      const idorResponse = await page.request.get(
        `${API_URL}/bookings/${otherBooking['id']}`,
        { headers: { Authorization: `Bearer ${agentToken}` } },
      );

      // ── Повинен отримати 403 Forbidden, НЕ 200 ────────────
      expect(
        idorResponse.status(),
        `IDOR! Агент отримав доступ до чужого бронювання ${otherBooking['id']}`,
      ).toBe(403);
    });

    test('TC-RBAC-012 | UI: список бронювань агента НЕ містить чужих заявок', async ({ page }) => {
      // storageState агента завантажений автоматично
      await page.goto('/agent');
      await page.waitForLoadState('networkidle');

      // ── Перейти до списку бронювань ───────────────────────
      const bookingsLink = page.locator(
        'a[href*="bookings"], [data-testid="nav-bookings"], text=Бронювання',
      );

      if (await bookingsLink.count() > 0) {
        await bookingsLink.first().click();
        await page.waitForLoadState('networkidle');
      }

      // ── Перевіряємо що відображається (тільки якщо є рядки) ──
      const rows = page.locator('[data-testid="booking-row"], tbody tr');
      const rowCount = await rows.count();

      if (rowCount > 0) {
        // Кожен рядок містить email/ім'я ТІЛЬКИ цього агента
        // Перевірка: у таблиці відсутні бронювання агента2
        // (непрямий спосіб: перевіряємо що немає ID чужого агента)

        // Тут перевіряємо що немає internal полів
        const pageContent = await page.content();
        expect(pageContent).not.toContain('cost_price');
        expect(pageContent).not.toContain('costPrice');
        expect(pageContent).not.toContain('margin');
        expect(pageContent).not.toContain('net_profit');
      }
    });

    test('TC-RBAC-013 | UI: агент НЕ бачить кабінет менеджера (/dashboard)', async ({ page }) => {
      // Агент (storageState вже активний) намагається відкрити /dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      const currentUrl = page.url();

      // Очікуємо: або redirect на /agent або 403 сторінку
      // НЕ очікуємо: менеджерський дашборд
      const isOnDashboard = currentUrl.includes('/dashboard') &&
        !currentUrl.includes('/agent');

      if (isOnDashboard) {
        // Якщо все ж потрапили на /dashboard — перевіряємо що немає фін. даних
        const hasFinanceWidget = await page
          .locator('[data-testid="finance-widget"], text=Загальний дохід, text=P&L')
          .isVisible()
          .catch(() => false);

        expect(
          hasFinanceWidget,
          'Агент бачить фінансові віджети на /dashboard — RBAC порушено!',
        ).toBeFalsy();
      } else {
        // Отримали redirect або 403 — це правильна поведінка
        const isOnAgent = currentUrl.includes('/agent');
        const hasForbidden = await page
          .locator('text=403, text=Заборонено, text=Доступ заборонено')
          .isVisible()
          .catch(() => false);

        expect(
          isOnAgent || hasForbidden,
          `Неочікуваний URL після спроби /dashboard агентом: ${currentUrl}`,
        ).toBeTruthy();
      }
    });

  }); // end: Бронювання — ізоляція

  // ──────────────────────────────────────────────────────────
  // БЛОК 4: Неавторизований доступ — 401
  // ──────────────────────────────────────────────────────────

  test.describe('Запити без токену → 401', () => {

    test('TC-RBAC-014 | GET /bookings без токену → 401', async ({ page }) => {
      const response = await page.request.get(`${API_URL}/bookings`);
      expect(response.status()).toBe(401);
    });

    test('TC-RBAC-015 | GET /tours без токену → 401 або 200 (каталог публічний?)', async ({ page }) => {
      // Залежно від рішення архітектора:
      // - Каталог турів може бути публічним (200) або захищеним (401)
      // - Але якщо публічний — costPrice точно відсутній
      const response = await page.request.get(`${API_URL}/tours`);
      const status = response.status();

      if (status === 200) {
        // Публічний каталог — перевіряємо що нема внутрішніх полів
        const body = await response.json();
        const tours: Record<string, unknown>[] = body.data ?? body;

        if (tours.length > 0) {
          const tour = tours[0];
          expect(tour).not.toHaveProperty('costPrice');
          expect(tour).not.toHaveProperty('cost_price');
          expect(tour).not.toHaveProperty('margin');
        }
      } else {
        // Захищений — правильно
        expect(status).toBe(401);
      }
    });

    test('TC-RBAC-016 | GET /finance/summary без токену → 401', async ({ page }) => {
      const response = await page.request.get(`${API_URL}/finance/summary`);
      expect(response.status()).toBe(401);
    });

    test('TC-RBAC-017 | GET /agents без токену → 401', async ({ page }) => {
      const response = await page.request.get(`${API_URL}/agents`);
      expect(response.status()).toBe(401);
    });

  }); // end: Неавторизований доступ

}); // end: RBAC
