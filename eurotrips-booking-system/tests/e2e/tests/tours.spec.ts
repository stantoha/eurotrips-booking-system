// ============================================================
// EUROTRIPS — tests/tours.spec.ts
// E2E тести: Tours API
//
// Покриває:
//  TC-TOURS-01: GET /tours → 200, список, пагінація, обов'язкові поля
//  TC-TOURS-02: GET /tours агентом → costPrice/margin відсутні (BR-04)
//  TC-TOURS-03: GET /tours/:id/availability → правильні лічильники місць
//  TC-TOURS-04: POST /tours без ролі admin/ops → 403
//
// Запуск:
//   npx playwright test tests/tours.spec.ts
//   npx playwright test tests/tours.spec.ts --grep "TC-TOURS-02"
// ============================================================

import { test, expect } from '@playwright/test';
import { CREDENTIALS, apiLogin } from './fixtures/auth.fixtures';
import { API_URL } from '../playwright.config';

// ─── Допоміжні типи для Tour API-відповіді ───────────────────

interface TourListItem {
  id             : string;
  name           : string;
  status         : string;
  basePrice      : number;
  availableSeats : number;
  totalSeats     : number;
  departureDate  : string;
  returnDate     : string;
  // Поля, яких НЕ повинно бути для агента (BR-04):
  costPrice?     : number;
  cost_price?    : number;
  margin?        : number;
  netProfit?     : number;
  net_profit?    : number;
  internalNotes? : string;
}

interface ApiListResponse<T> {
  data : T[];
  meta?: {
    total   : number;
    page    : number;
    limit   : number;
    pages   : number;
  };
}

interface TourAvailability {
  tourId          : string;
  totalSeats      : number;
  availableSeats  : number;
  bookedSeats     : number;
  reservedSeats   : number;
  status          : string;
}

// ─── SUITE: Tours API ─────────────────────────────────────────

test.describe('Tours API', () => {

  // ──────────────────────────────────────────────────────────
  // TC-TOURS-01: GET /tours → 200, список, пагінація
  // ──────────────────────────────────────────────────────────

  test.describe('TC-TOURS-01 | GET /tours → список з пагінацією', () => {

    test('TC-TOURS-01-A | повертає 200 та непорожній список турів', async ({ page }) => {
      const { accessToken } = await apiLogin(page, 'manager');

      const response = await page.request.get(`${API_URL}/tours`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      // ── HTTP статус ────────────────────────────────────────
      expect(response.status()).toBe(200);

      const body: ApiListResponse<TourListItem> = await response.json();

      // ── Структура відповіді: { data: [], meta: {} } ────────
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);

      // ── Seed має містити тури ─────────────────────────────
      expect(
        body.data.length,
        'GET /tours повернув порожній масив — seed не завантажений?',
      ).toBeGreaterThan(0);
    });

    test('TC-TOURS-01-B | кожен тур містить обов\'язкові поля', async ({ page }) => {
      const { accessToken } = await apiLogin(page, 'manager');

      const response = await page.request.get(`${API_URL}/tours`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(response.status()).toBe(200);

      const body: ApiListResponse<TourListItem> = await response.json();
      const tours = body.data;

      // ── Перевіряємо перші 5 турів (повний список може бути великим) ──
      const sampleTours = tours.slice(0, Math.min(5, tours.length));

      for (const tour of sampleTours) {
        // Обов'язкові поля з ТЗ §4.1 Каталог турів
        expect(tour, `Тур ${tour.id}: відсутнє поле id`).toHaveProperty('id');
        expect(tour, `Тур ${tour.id}: відсутнє поле name`).toHaveProperty('name');
        expect(tour, `Тур ${tour.id}: відсутнє поле status`).toHaveProperty('status');
        expect(tour, `Тур ${tour.id}: відсутнє поле basePrice`).toHaveProperty('basePrice');
        expect(tour, `Тур ${tour.id}: відсутнє поле availableSeats`).toHaveProperty('availableSeats');
        expect(tour, `Тур ${tour.id}: відсутнє поле departureDate`).toHaveProperty('departureDate');

        // Типи полів
        expect(typeof tour.id).toBe('string');
        expect(typeof tour.name).toBe('string');
        expect(typeof tour.basePrice).toBe('number');
        expect(tour.basePrice).toBeGreaterThanOrEqual(0);
        expect(typeof tour.availableSeats).toBe('number');
        expect(tour.availableSeats).toBeGreaterThanOrEqual(0);
      }
    });

    test('TC-TOURS-01-C | пагінація: ?page=1&limit=5 повертає max 5 турів', async ({ page }) => {
      const { accessToken } = await apiLogin(page, 'manager');

      const response = await page.request.get(`${API_URL}/tours?page=1&limit=5`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(response.status()).toBe(200);

      const body: ApiListResponse<TourListItem> = await response.json();

      // ── Не більше 5 елементів ─────────────────────────────
      expect(body.data.length).toBeLessThanOrEqual(5);

      // ── Meta містить поля пагінації ───────────────────────
      if (body.meta) {
        expect(body.meta).toHaveProperty('total');
        expect(body.meta).toHaveProperty('page');
        expect(body.meta).toHaveProperty('limit');
        expect(body.meta.page).toBe(1);
        expect(body.meta.limit).toBe(5);
        expect(typeof body.meta.total).toBe('number');
      }
    });

    test('TC-TOURS-01-D | пагінація: page=2 відрізняється від page=1', async ({ page }) => {
      const { accessToken } = await apiLogin(page, 'manager');

      const [res1, res2] = await Promise.all([
        page.request.get(`${API_URL}/tours?page=1&limit=3`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        page.request.get(`${API_URL}/tours?page=2&limit=3`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      expect(res1.status()).toBe(200);
      expect(res2.status()).toBe(200);

      const page1 = ((await res1.json()) as ApiListResponse<TourListItem>).data;
      const page2 = ((await res2.json()) as ApiListResponse<TourListItem>).data;

      // ── Якщо є достатньо турів — сторінки мають різатись ──
      if (page1.length > 0 && page2.length > 0) {
        const page1ids = page1.map((t) => t.id);
        const page2ids = page2.map((t) => t.id);

        // Жоден ID зі сторінки 1 не повинен бути на сторінці 2
        const overlap = page1ids.filter((id) => page2ids.includes(id));
        expect(
          overlap.length,
          `Сторінки 1 і 2 мають однакові тури: ${overlap.join(', ')}`,
        ).toBe(0);
      }
    });

    test('TC-TOURS-01-E | фільтр за статусом: ?status=active', async ({ page }) => {
      const { accessToken } = await apiLogin(page, 'manager');

      const response = await page.request.get(`${API_URL}/tours?status=active`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      // Або 200 з відфільтрованими турами, або 200 з порожнім масивом
      // (не 400 — статус active є валідним)
      expect(response.status()).toBe(200);

      const body: ApiListResponse<TourListItem> = await response.json();

      // Якщо є результати — всі мають статус 'active'
      for (const tour of body.data) {
        expect(tour.status).toBe('active');
      }
    });

  }); // end TC-TOURS-01

  // ──────────────────────────────────────────────────────────
  // TC-TOURS-02: GET /tours агентом → costPrice/margin відсутні
  // Бізнес-правило BR-04: агент НІКОЛИ не бачить собівартість
  // CLAUDE_backend.md: "Використовувати окремий DTO: TourPublicDto (без costPrice)"
  // ──────────────────────────────────────────────────────────

  test.describe('TC-TOURS-02 | BR-04: агент не отримує costPrice/margin', () => {

    // Список заборонених полів відповідно до BR-04 + CLAUDE_backend.md
    const FORBIDDEN_FIELDS = [
      'costPrice',
      'cost_price',
      'margin',
      'netProfit',
      'net_profit',
      'internalNotes',
      'internal_notes',
      'operationalNotes',
      'operational_notes',
    ] as const;

    test('TC-TOURS-02-A | GET /tours — жодне заборонене поле не потрапляє до агента', async ({ page }) => {
      const { accessToken: agentToken } = await apiLogin(page, 'agent');

      const response = await page.request.get(`${API_URL}/tours`, {
        headers: { Authorization: `Bearer ${agentToken}` },
      });
      expect(response.status()).toBe(200);

      const body: ApiListResponse<TourListItem> = await response.json();
      const tours = body.data;

      expect(
        tours.length,
        'GET /tours для агента повернув порожній список — seed потрібен',
      ).toBeGreaterThan(0);

      // ── Перевірка кожного туру ─────────────────────────────
      for (const tour of tours) {
        for (const field of FORBIDDEN_FIELDS) {
          expect(
            tour,
            `BR-04 ПОРУШЕНО: тур "${tour.id}" містить поле "${field}" у відповіді агенту`,
          ).not.toHaveProperty(field);
        }
      }

      // ── Перевіряємо також весь raw JSON (на випадок nested полів) ──
      const rawJson = await response.text();
      for (const field of FORBIDDEN_FIELDS) {
        // Camel + snake case
        expect(
          rawJson,
          `BR-04 ПОРУШЕНО: raw JSON містить "${field}"`,
        ).not.toContain(`"${field}":`);
      }
    });

    test('TC-TOURS-02-B | GET /tours/:id — деталі туру без costPrice для агента', async ({ page }) => {
      const { accessToken: agentToken } = await apiLogin(page, 'agent');

      // ── Беремо ID першого туру ─────────────────────────────
      const listRes = await page.request.get(`${API_URL}/tours?limit=1`, {
        headers: { Authorization: `Bearer ${agentToken}` },
      });
      expect(listRes.status()).toBe(200);

      const listBody: ApiListResponse<TourListItem> = await listRes.json();
      expect(listBody.data.length).toBeGreaterThan(0);
      const tourId = listBody.data[0].id;

      // ── Деталі конкретного туру ───────────────────────────
      const detailRes = await page.request.get(`${API_URL}/tours/${tourId}`, {
        headers: { Authorization: `Bearer ${agentToken}` },
      });
      expect(detailRes.status()).toBe(200);

      const rawJson = await detailRes.text();
      const tour = JSON.parse(rawJson).data ?? JSON.parse(rawJson);

      // ── Заборонені поля відсутні ──────────────────────────
      for (const field of FORBIDDEN_FIELDS) {
        expect(
          tour,
          `BR-04 ПОРУШЕНО: GET /tours/${tourId} містить "${field}" для агента`,
        ).not.toHaveProperty(field);

        expect(
          rawJson,
          `BR-04 ПОРУШЕНО: raw JSON /tours/${tourId} містить "${field}"`,
        ).not.toContain(`"${field}":`);
      }

      // ── Поля які МАЮТЬ бути доступні агенту ──────────────
      expect(tour).toHaveProperty('id');
      expect(tour).toHaveProperty('basePrice');
      expect(tour).toHaveProperty('availableSeats');
      expect(tour).toHaveProperty('departureDate');
    });

    test('TC-TOURS-02-C | менеджер БАЧИТЬ costPrice (контрольне порівняння)', async ({ page }) => {
      // Переконуємось що приховування стосується ТІЛЬКИ агента,
      // не є глобальним обрізанням DTO для всіх ролей

      const { accessToken: managerToken } = await apiLogin(page, 'manager');

      const response = await page.request.get(`${API_URL}/tours?limit=1`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      expect(response.status()).toBe(200);

      const body = await response.json();
      const tours = body.data ?? body;

      if (Array.isArray(tours) && tours.length > 0) {
        const tour = tours[0] as Record<string, unknown>;
        const hasCostPrice =
          'costPrice'  in tour ||
          'cost_price' in tour;

        expect(
          hasCostPrice,
          'Менеджер НЕ бачить costPrice — схоже TourPublicDto застосований для всіх ролей помилково',
        ).toBeTruthy();
      }
    });

  }); // end TC-TOURS-02

  // ──────────────────────────────────────────────────────────
  // TC-TOURS-03: GET /tours/:id/availability
  // Перевіряємо правильність лічильників місць
  // BR-01: availableSeats = totalSeats − bookedSeats − reservedSeats
  // ──────────────────────────────────────────────────────────

  test.describe('TC-TOURS-03 | GET /tours/:id/availability → правильні лічильники', () => {

    test('TC-TOURS-03-A | endpoint повертає 200 та структуру availability', async ({ page }) => {
      const { accessToken } = await apiLogin(page, 'manager');

      // ── Беремо ID першого туру ─────────────────────────────
      const listRes = await page.request.get(`${API_URL}/tours?limit=1&status=active`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      // Якщо active немає — беремо будь-який
      const listRes2 = await page.request.get(`${API_URL}/tours?limit=1`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const listBody = await (listRes.status() === 200 ? listRes : listRes2).json();
      const tours = listBody.data ?? listBody;

      if (!Array.isArray(tours) || tours.length === 0) {
        test.skip(true, 'Немає турів у seed — пропускаємо TC-TOURS-03');
        return;
      }

      const tourId = (tours[0] as TourListItem).id;

      // ── Запит availability ────────────────────────────────
      const availRes = await page.request.get(`${API_URL}/tours/${tourId}/availability`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(availRes.status()).toBe(200);

      const avail: TourAvailability =
        ((await availRes.json()) as { data?: TourAvailability }).data ??
        await availRes.json();

      // ── Обов'язкові поля ──────────────────────────────────
      expect(avail).toHaveProperty('tourId');
      expect(avail).toHaveProperty('totalSeats');
      expect(avail).toHaveProperty('availableSeats');
      expect(avail).toHaveProperty('bookedSeats');
      expect(avail).toHaveProperty('status');

      // ── Типи ─────────────────────────────────────────────
      expect(typeof avail.totalSeats).toBe('number');
      expect(typeof avail.availableSeats).toBe('number');
      expect(typeof avail.bookedSeats).toBe('number');

      // ── Значення не від'ємні ──────────────────────────────
      expect(avail.totalSeats).toBeGreaterThan(0);
      expect(avail.availableSeats).toBeGreaterThanOrEqual(0);
      expect(avail.bookedSeats).toBeGreaterThanOrEqual(0);
    });

    test('TC-TOURS-03-B | лічильники математично узгоджені (BR-01)', async ({ page }) => {
      // BR-01: availableSeats = totalSeats − bookedSeats − reservedSeats
      // Перевіряємо цілісність даних

      const { accessToken } = await apiLogin(page, 'manager');

      const listRes = await page.request.get(`${API_URL}/tours?limit=5`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(listRes.status()).toBe(200);

      const tours: TourListItem[] = ((await listRes.json()) as ApiListResponse<TourListItem>).data;

      if (tours.length === 0) {
        test.skip(true, 'Немає турів — пропускаємо');
        return;
      }

      for (const tourSummary of tours.slice(0, 3)) {
        const availRes = await page.request.get(
          `${API_URL}/tours/${tourSummary.id}/availability`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );

        if (availRes.status() !== 200) continue;

        const avail: TourAvailability =
          ((await availRes.json()) as { data?: TourAvailability }).data ??
          await availRes.json();

        const reserved = avail.reservedSeats ?? 0;

        // ── BR-01: Баланс місць ────────────────────────────
        // totalSeats = availableSeats + bookedSeats + reservedSeats
        const calculated = avail.availableSeats + avail.bookedSeats + reserved;

        expect(
          calculated,
          `Тур ${tourSummary.id}: ${avail.availableSeats} + ${avail.bookedSeats} + ${reserved} ≠ ${avail.totalSeats} (BR-01)`,
        ).toBe(avail.totalSeats);

        // ── Не може бути більше місць ніж загальна кількість ──
        expect(avail.availableSeats).toBeLessThanOrEqual(avail.totalSeats);
        expect(avail.bookedSeats).toBeLessThanOrEqual(avail.totalSeats);
      }
    });

    test('TC-TOURS-03-C | статус "almost_full" якщо місць < 20%', async ({ page }) => {
      // ТЗ §5.2: статус туру "майже заповнений" (almost_full)
      // Перевіряємо відображення для турів де мало місць

      const { accessToken } = await apiLogin(page, 'manager');

      // Фільтруємо тури зі статусом almost_full
      const response = await page.request.get(
        `${API_URL}/tours?status=almost_full&limit=5`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      expect(response.status()).toBe(200);

      const body: ApiListResponse<TourListItem> = await response.json();

      // Якщо є "майже заповнені" тури — перевіряємо availability
      for (const tour of body.data) {
        const availRes = await page.request.get(
          `${API_URL}/tours/${tour.id}/availability`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );

        if (availRes.status() !== 200) continue;

        const avail: TourAvailability =
          ((await availRes.json()) as { data?: TourAvailability }).data ??
          await availRes.json();

        // almost_full: availableSeats ≤ 20% від totalSeats
        if (avail.totalSeats > 0) {
          const ratio = avail.availableSeats / avail.totalSeats;
          expect(
            ratio,
            `Тур ${tour.id} має статус almost_full, але заповнений лише ${Math.round(ratio * 100)}%`,
          ).toBeLessThanOrEqual(0.20);
        }
      }
    });

    test('TC-TOURS-03-D | availability для неіснуючого туру → 404', async ({ page }) => {
      const { accessToken } = await apiLogin(page, 'manager');

      const response = await page.request.get(
        `${API_URL}/tours/NONEXISTENT-TOUR-ID-99999/availability`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      expect(response.status()).toBe(404);

      const body = await response.json();
      expect(body).toHaveProperty('error');
    });

  }); // end TC-TOURS-03

  // ──────────────────────────────────────────────────────────
  // TC-TOURS-04: POST /tours без ролі admin/ops → 403
  // App.tsx + CLAUDE_backend.md:
  //   POST /tours [admin, ops]
  //   PUT  /tours/:id [admin, ops]
  //   PATCH /tours/:id/status [admin, ops, director]
  // ──────────────────────────────────────────────────────────

  test.describe('TC-TOURS-04 | POST /tours → 403 для непривілейованих ролей', () => {

    // Мінімальний валідний payload для створення туру
    const newTourPayload = {
      name           : 'Тест-тур QA Playwright',
      destinationCity: 'Рим',
      country        : 'Італія',
      tourType       : 'автобус',
      departureDate  : '2026-06-01',
      returnDate     : '2026-06-10',
      durationDays   : 9,
      departureCityId: 'kyiv',
      basePrice      : 850,
      currency       : 'EUR',
      totalSeats     : 40,
      status         : 'draft',
    };

    test('TC-TOURS-04-A | агент не може створити тур → 403', async ({ page }) => {
      const { accessToken: agentToken } = await apiLogin(page, 'agent');

      const response = await page.request.post(`${API_URL}/tours`, {
        headers: {
          Authorization  : `Bearer ${agentToken}`,
          'Content-Type' : 'application/json',
        },
        data: newTourPayload,
      });

      // ── Очікуємо 403 Forbidden ────────────────────────────
      expect(
        response.status(),
        `Агент отримав статус ${response.status()} замість 403 при POST /tours`,
      ).toBe(403);

      const body = await response.json();
      expect(body).toHaveProperty('error');

      // ── Тур НЕ з'явився у каталозі ───────────────────────
      const listRes = await page.request.get(
        `${API_URL}/tours?limit=5`,
        { headers: { Authorization: `Bearer ${agentToken}` } },
      );
      const tours: TourListItem[] = ((await listRes.json()) as ApiListResponse<TourListItem>).data ?? [];
      const created = tours.find((t) => t.name === newTourPayload.name);
      expect(created).toBeUndefined();
    });

    test('TC-TOURS-04-B | менеджер не може створити тур → 403', async ({ page }) => {
      const { accessToken: managerToken } = await apiLogin(page, 'manager');

      const response = await page.request.post(`${API_URL}/tours`, {
        headers: {
          Authorization : `Bearer ${managerToken}`,
          'Content-Type': 'application/json',
        },
        data: { ...newTourPayload, name: 'Менеджер-тест-тур QA' },
      });

      // Менеджер НЕ в списку [admin, ops] для POST /tours
      expect(response.status()).toBe(403);
    });

    test('TC-TOURS-04-C | без токену → 401 (не 403)', async ({ page }) => {
      // Розрізняємо: 401 = не авторизований, 403 = авторизований але без прав
      const response = await page.request.post(`${API_URL}/tours`, {
        headers: { 'Content-Type': 'application/json' },
        data: newTourPayload,
      });

      expect(response.status()).toBe(401);
    });

    test('TC-TOURS-04-D | PATCH /tours/:id/status → 403 для агента та менеджера', async ({ page }) => {
      const { accessToken: agentToken } = await apiLogin(page, 'agent');
      const { accessToken: managerToken } = await apiLogin(page, 'manager');

      // ── Беремо ID першого туру ─────────────────────────────
      const listRes = await page.request.get(`${API_URL}/tours?limit=1`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      const tours: TourListItem[] = ((await listRes.json()) as ApiListResponse<TourListItem>).data ?? [];

      if (tours.length === 0) {
        test.skip(true, 'Немає турів для тесту');
        return;
      }

      const tourId = tours[0].id;

      // ── Агент намагається змінити статус туру ─────────────
      const agentRes = await page.request.patch(
        `${API_URL}/tours/${tourId}/status`,
        {
          headers: {
            Authorization : `Bearer ${agentToken}`,
            'Content-Type': 'application/json',
          },
          data: { status: 'cancelled' },
        },
      );
      expect(agentRes.status()).toBe(403);

      // ── Менеджер намагається змінити статус туру ──────────
      // CLAUDE_backend.md: PATCH /tours/:id/status → [admin, ops, director]
      // Менеджер (manager) НЕ в цьому списку
      const managerRes = await page.request.patch(
        `${API_URL}/tours/${tourId}/status`,
        {
          headers: {
            Authorization : `Bearer ${managerToken}`,
            'Content-Type': 'application/json',
          },
          data: { status: 'active' },
        },
      );
      // Менеджер також 403 (не ops, не admin, не director)
      expect(managerRes.status()).toBe(403);
    });

  }); // end TC-TOURS-04

  // ──────────────────────────────────────────────────────────
  // БОНУС: Edge cases та граничні умови Tours API
  // ──────────────────────────────────────────────────────────

  test.describe('Edge cases: Tours API', () => {

    test('GET /tours?page=0 → коректна обробка невалідної сторінки', async ({ page }) => {
      const { accessToken } = await apiLogin(page, 'manager');

      const response = await page.request.get(`${API_URL}/tours?page=0&limit=5`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      // Або 400 Bad Request, або нормалізація до page=1
      expect([200, 400]).toContain(response.status());

      if (response.status() === 200) {
        const body: ApiListResponse<TourListItem> = await response.json();
        // Якщо нормалізовано — перша сторінка
        expect(body.meta?.page ?? 1).toBeGreaterThanOrEqual(1);
      }
    });

    test('GET /tours?limit=1000 → не повертає більше MAX_LIMIT', async ({ page }) => {
      const { accessToken } = await apiLogin(page, 'manager');

      const response = await page.request.get(`${API_URL}/tours?limit=1000`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(response.status()).toBe(200);

      const body: ApiListResponse<TourListItem> = await response.json();
      // API має мати верхній ліміт (наприклад 100)
      expect(body.data.length).toBeLessThanOrEqual(100);
    });

    test('GET /tours/:id → 404 для неіснуючого ID', async ({ page }) => {
      const { accessToken } = await apiLogin(page, 'manager');

      const response = await page.request.get(
        `${API_URL}/tours/TOUR-DOES-NOT-EXIST-QA-99`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body).toHaveProperty('error');
      // Без стек-трейсів у відповіді
      expect(JSON.stringify(body)).not.toContain('at Object.');
      expect(JSON.stringify(body)).not.toContain('prisma');
    });

  }); // end Edge cases

}); // end Tours API
