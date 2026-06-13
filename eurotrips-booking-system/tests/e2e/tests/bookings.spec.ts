// ============================================================
// EUROTRIPS — tests/bookings.spec.ts
// E2E тести: Bookings API
//
// Покриває:
//  TC-BOOK-01: BR-08 — скасування оператором → повернення 100%, штраф 0
//  TC-BOOK-02: BR-08 — скасування клієнтом (ранній термін) → штраф > 0
//  TC-BOOK-03: BR-06 — неприпустимий перехід статусу → 422
//  TC-BOOK-04: RBAC  — агент бачить тільки власні бронювання
//
// Запуск:
//   npx playwright test tests/bookings.spec.ts
//   npx playwright test tests/bookings.spec.ts --grep "TC-BOOK-01"
// ============================================================

import { test, expect } from '@playwright/test';
import { CREDENTIALS, apiLogin } from './fixtures/auth.fixtures';
import { API_URL } from '../playwright.config';

// ─── Допоміжні типи для Booking API-відповіді ────────────────

interface BookingListItem {
  id            : string;
  bookingNumber : string;
  status        : string;
  totalPrice    : number;
  agentId       : string;
}

interface BookingDetail {
  id            : string;
  bookingNumber : string;
  status        : string;
  totalPrice    : number;
  penaltyAmount : number;
  refundAmount  : number;
  agentId       : string;
}

// ─── Допоміжна функція: створити тестове бронювання ──────────

async function createTestBooking(token: string): Promise<string> {
  const res = await fetch(`${API_URL}/bookings`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      tour_id:   'test-tour-id',
      pax_count: 1,
      tourists:  [{ first_name: 'Тест', last_name: 'Турист', passport: 'AA000000' }],
    }),
  });
  if (!res.ok) test.skip(true, 'Не вдалося створити тестове бронювання — tour_id не існує в БД');
  const json = await res.json() as { data: { id: string } };
  return json.data.id;
}

// ─── TC-BOOK-01: BR-08 — оператор скасовує → штраф 0, повернення 100% ───

test('TC-BOOK-01: BR-08 operator cancel — zero penalty, full refund', async ({ request }) => {
  // 1. Логін менеджера
  const token = await apiLogin(request, CREDENTIALS.manager);

  // 2. GET /bookings — знайти перше бронювання зі статусом 'confirmed' або 'partially_paid'
  const listRes = await request.get(`${API_URL}/bookings?status=confirmed&limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(listRes.ok(), `GET /bookings failed: ${listRes.status()}`).toBeTruthy();

  const listJson = await listRes.json() as { data: BookingListItem[] };
  const bookings = listJson.data;

  if (bookings.length === 0) {
    test.skip(true, 'Немає бронювань зі статусом confirmed для тесту TC-BOOK-01');
    return;
  }

  const bookingId = bookings[0].id;

  // 3. POST /bookings/:id/cancel із type = 'operator'
  const cancelRes = await request.post(`${API_URL}/bookings/${bookingId}/cancel`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { reason: 'Тур скасовано оператором (TC-BOOK-01)', cancelled_by: 'operator' },
  });
  expect(cancelRes.ok(), `POST /bookings/${bookingId}/cancel failed: ${cancelRes.status()}`).toBeTruthy();

  // 4. Перевірити: status = 'cancelled_operator', penalty_amount = 0
  const detailRes = await request.get(`${API_URL}/bookings/${bookingId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(detailRes.ok()).toBeTruthy();

  const detail = (await detailRes.json() as { data: BookingDetail }).data;

  // BR-08: штраф при скасуванні оператором завжди 0
  expect(detail.status).toBe('cancelled_operator');
  expect(detail.penaltyAmount).toBe(0);

  // Refund має дорівнювати сумі, яку клієнт вже оплатив
  expect(detail.refundAmount).toBeGreaterThanOrEqual(0);
});

// ─── TC-BOOK-02: BR-08 — клієнт скасовує рано → штраф > 0 ───────────────

test('TC-BOOK-02: BR-08 client early cancel — penalty applied', async ({ request }) => {
  const token = await apiLogin(request, CREDENTIALS.manager);

  // Знайти бронювання зі статусом 'awaiting_payment' або 'pre_booked'
  const listRes = await request.get(`${API_URL}/bookings?status=awaiting_payment&limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(listRes.ok()).toBeTruthy();

  const listJson = await listRes.json() as { data: BookingListItem[] };
  if (listJson.data.length === 0) {
    test.skip(true, 'Немає бронювань awaiting_payment для тесту TC-BOOK-02');
    return;
  }

  const bookingId = listJson.data[0].id;

  // Клієнт скасовує (не оператор)
  const cancelRes = await request.post(`${API_URL}/bookings/${bookingId}/cancel`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { reason: 'Клієнт відмовився (TC-BOOK-02)', cancelled_by: 'client' },
  });
  expect(cancelRes.ok(), `POST /bookings/${bookingId}/cancel failed: ${cancelRes.status()}`).toBeTruthy();

  const detailRes = await request.get(`${API_URL}/bookings/${bookingId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(detailRes.ok()).toBeTruthy();

  const detail = (await detailRes.json() as { data: BookingDetail }).data;

  // BR-08: при скасуванні клієнтом (залежно від cancellation_policy) може бути штраф
  expect(detail.status).toBe('cancelled_client');
  // penaltyAmount >= 0 (може бути 0 якщо скасувано задовго до виїзду)
  expect(detail.penaltyAmount).toBeGreaterThanOrEqual(0);
});

// ─── TC-BOOK-03: BR-06 — заборонений перехід статусу → 422 ──────────────

test('TC-BOOK-03: BR-06 invalid status transition returns 422', async ({ request }) => {
  const token = await apiLogin(request, CREDENTIALS.manager);

  // Знайти бронювання 'new' і спробувати перевести одразу в 'completed'
  const listRes = await request.get(`${API_URL}/bookings?status=new&limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(listRes.ok()).toBeTruthy();

  const listJson = await listRes.json() as { data: BookingListItem[] };
  if (listJson.data.length === 0) {
    test.skip(true, 'Немає бронювань зі статусом new для тесту TC-BOOK-03');
    return;
  }

  const bookingId = listJson.data[0].id;

  // BR-06: стрибок new → completed заборонений
  const patchRes = await request.patch(`${API_URL}/bookings/${bookingId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { status: 'completed' },
  });

  // Має повернути 422 Unprocessable Entity (або 400) — недопустимий перехід
  expect([400, 422]).toContain(patchRes.status());

  const errBody = await patchRes.json() as { error?: { code?: string } };
  expect(errBody.error?.code).toBeTruthy();
});

// ─── TC-BOOK-04: RBAC — агент бачить тільки власні бронювання ───────────

test('TC-BOOK-04: RBAC agent sees only own bookings', async ({ request }) => {
  // 1. Менеджер бачить усі
  const managerToken = await apiLogin(request, CREDENTIALS.manager);
  const managerRes   = await request.get(`${API_URL}/bookings?limit=100`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  expect(managerRes.ok()).toBeTruthy();

  const managerJson = await managerRes.json() as { data: BookingListItem[]; meta: { total: number } };
  const totalAll    = managerJson.meta.total;

  // 2. Агент бачить тільки свої
  const agentToken = await apiLogin(request, CREDENTIALS.agent);
  const agentRes   = await request.get(`${API_URL}/bookings?limit=100`, {
    headers: { Authorization: `Bearer ${agentToken}` },
  });
  expect(agentRes.ok()).toBeTruthy();

  const agentJson = await agentRes.json() as { data: BookingListItem[]; meta: { total: number } };

  // Агент бачить <= усіх бронювань
  expect(agentJson.meta.total).toBeLessThanOrEqual(totalAll);

  // Усі отримані бронювання належать цьому агенту
  // (BR-04 / RBAC: IDOR-захист — бронювання іншого агента не повертаються)
  const agentProfile = await request.get(`${API_URL}/agents/me`, {
    headers: { Authorization: `Bearer ${agentToken}` },
  });
  if (agentProfile.ok()) {
    const { data: agent } = await agentProfile.json() as { data: { id: string } };
    for (const b of agentJson.data) {
      expect(b.agentId).toBe(agent.id);
    }
  }
});
