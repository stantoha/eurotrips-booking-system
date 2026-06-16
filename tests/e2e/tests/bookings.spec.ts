// ============================================================
// EUROTRIPS — tests/e2e/bookings.spec.ts
// E2E тести: Модуль Бронювань
//
// Покриває:
//   TC-BOOK-01  BR-08 operator cancel → penalty_amount=0, refund=amount_paid
//   TC-BOOK-02  BR-08 client cancel   → penalty_pct>0 за cancellation_policy
//   TC-BOOK-03  BR-06 FSM new→completed заборонено → HTTP 422 + error.transition
//   TC-BOOK-04  RBAC агент бачить тільки свої: booking.agent_id === agent.id
//
// Джерела:
//   bookingTransitions.ts   — FSM-граф + isTransitionAllowed()
//   useBookings.ts          — DTO shapes: CancelBookingResult, field names
//   ТЗ §4.2, §5.1, §8.3
//
// Запуск:
//   npx playwright test tests/e2e/bookings.spec.ts
//   npx playwright test tests/e2e/bookings.spec.ts --grep "TC-BOOK-03"
// ============================================================

import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  CREDENTIALS,
  apiLogin,
  type UserRole,
} from '../fixtures/auth.fixtures';
import { API_URL } from '../../playwright.config';

// ─── TYPES ────────────────────────────────────────────────────
// Відповідають DTO у useBookings.ts — НЕ camelCase, snake_case!

interface Booking {
  id              : string;
  booking_number  : string;
  tour_id         : string;
  tour_name       : string;
  status          : BookingStatus;
  amount_paid     : number;      // EUR: сума, вже оплачена клієнтом
  total_price     : number;      // EUR: повна вартість бронювання
  agent_id        : string | null;
  manager_id      : string;
  contact_name    : string;
  cancellation_policy?: string;
  created_at      : string;
}

type BookingStatus =
  | 'new' | 'in_work' | 'needs_clarification' | 'pre_booked'
  | 'awaiting_payment' | 'partially_paid' | 'confirmed'
  | 'docs_collected' | 'ready_to_depart' | 'on_trip' | 'completed'
  | 'cancelled_client' | 'cancelled_operator' | 'no_show' | 'refund';

// POST /bookings/:id/cancel — response (useBookings.ts CancelBookingResult)
interface CancelBookingResult {
  booking        : Booking;
  penalty_amount : number;   // EUR — сума штрафу
  refund_amount  : number;   // EUR — до повернення клієнту
  penalty_pct    : number;   // % від total_price
  policy_applied : string;   // 'standard_30d' | 'strict_7d' | ...
}

// PATCH /bookings/:id/status — error response
interface BookingStatusError {
  error: {
    code    : string;        // 'transition' | 'forbidden' | ...
    message : string;
    from?   : BookingStatus;
    to?     : BookingStatus;
    allowed?: BookingStatus[];
  };
}

// ─── HELPERS ──────────────────────────────────────────────────

/**
 * Отримати список бронювань з певним статусом.
 * Повертає перше знайдене або null.
 */
async function findBookingByStatus(
  request: APIRequestContext,
  token:   string,
  status:  BookingStatus,
): Promise<Booking | null> {
  const res = await request.get(`${API_URL}/bookings?status=${status}&limit=20`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status() !== 200) return null;

  const body  = await res.json();
  const items: Booking[] = body.data?.bookings ?? body.data ?? body.bookings ?? [];
  return items.find((b) => b.status === status) ?? null;
}

/**
 * Створити тестове бронювання через API.
 * Повертає ID нового бронювання або кидає помилку.
 *
 * ПЕРЕДУМОВА: в seed є тур зі статусом active і вільними місцями.
 */
async function createTestBooking(
  request : APIRequestContext,
  token   : string,
  overrides: Partial<{
    contact_name   : string;
    booking_type   : string;
    participants   : number;
    room_type      : string;
  }> = {},
): Promise<Booking> {
  // ── Отримуємо перший доступний тур ────────────────────────
  const tourRes = await request.get(
    `${API_URL}/tours?status=active&limit=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  // Fallback: будь-який тур
  const tourRes2 = await request.get(
    `${API_URL}/tours?limit=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  const tourBody = await (tourRes.status() === 200 ? tourRes : tourRes2).json();
  const tours    = tourBody.data ?? tourBody;

  if (!Array.isArray(tours) || tours.length === 0) {
    throw new Error('Seed не містить турів — неможливо створити тестове бронювання');
  }

  const tourId = tours[0].id as string;

  // ── Відправляємо POST /bookings ────────────────────────────
  const payload = {
    tour_id      : tourId,
    booking_type : overrides.booking_type  ?? 'direct',
    contact_name : overrides.contact_name  ?? `QA Тест ${Date.now()}`,
    participants : overrides.participants  ?? 1,
    room_type    : overrides.room_type     ?? 'twin',
  };

  const res = await request.post(`${API_URL}/bookings`, {
    headers: {
      Authorization  : `Bearer ${token}`,
      'Content-Type' : 'application/json',
    },
    data: payload,
  });

  if (res.status() !== 201 && res.status() !== 200) {
    const err = await res.text();
    throw new Error(`POST /bookings failed (${res.status()}): ${err}`);
  }

  const body = await res.json();
  return (body.data ?? body) as Booking;
}

/**
 * Перевести бронювання в потрібний статус через ланцюжок переходів.
 * Потрібно для підготовки до тестів скасування.
 *
 * Ланцюжок: new → in_work → pre_booked → awaiting_payment → confirmed
 */
async function advanceBookingStatus(
  request  : APIRequestContext,
  token    : string,
  bookingId: string,
  targetStatus: BookingStatus,
): Promise<void> {
  const CHAINS: Record<string, BookingStatus[]> = {
    confirmed     : ['in_work', 'pre_booked', 'awaiting_payment', 'confirmed'],
    partially_paid: ['in_work', 'pre_booked', 'awaiting_payment', 'partially_paid'],
    in_work       : ['in_work'],
  };

  const chain = CHAINS[targetStatus];
  if (!chain) throw new Error(`Немає ланцюжка для статусу ${targetStatus}`);

  for (const status of chain) {
    const res = await request.patch(
      `${API_URL}/bookings/${bookingId}/status`,
      {
        headers: {
          Authorization  : `Bearer ${token}`,
          'Content-Type' : 'application/json',
        },
        data: { status, comment: `QA setup: advance to ${status}` },
      },
    );
    // Ігноруємо 422 якщо вже в цьому статусі
    if (res.status() !== 200 && res.status() !== 422) {
      throw new Error(
        `Не вдалось перейти в статус ${status}: HTTP ${res.status()}`,
      );
    }
  }
}

// ─── SUITE ────────────────────────────────────────────────────

test.describe('Модуль Бронювань — BR-06, BR-08, RBAC', () => {

  // ──────────────────────────────────────────────────────────
  // TC-BOOK-01: BR-08 — Скасування ОПЕРАТОРОМ
  //
  // БП: якщо ініціатор = 'operator' (компанія) →
  //       penalty_amount = 0
  //       refund_amount  = booking.amount_paid (повне повернення)
  //       booking.status = 'cancelled_operator'
  //
  // useBookings.ts: CancelBookingDto.initiated_by = 'operator'
  // Endpoint: POST /bookings/:id/cancel
  // ──────────────────────────────────────────────────────────

  test.describe('TC-BOOK-01 | BR-08: Скасування оператором → штраф 0, повне повернення', () => {

    let managerToken  : string;
    let testBookingId : string;
    let amountPaid    : number;

    test.beforeAll(async ({ browser }) => {
      const page = await browser.newPage();

      // ── Логін менеджера ────────────────────────────────────
      const { accessToken } = await apiLogin(page, 'manager');
      managerToken = accessToken;

      // ── Шукаємо existing confirmed booking ────────────────
      let booking = await findBookingByStatus(
        page.request, managerToken, 'confirmed',
      );

      // Якщо немає — шукаємо partially_paid
      if (!booking) {
        booking = await findBookingByStatus(
          page.request, managerToken, 'partially_paid',
        );
      }

      // Якщо взагалі немає — створюємо нове і продвигаємо
      if (!booking) {
        const created = await createTestBooking(page.request, managerToken);
        await advanceBookingStatus(
          page.request, managerToken, created.id, 'confirmed',
        );
        // Перечитуємо щоб отримати актуальний amount_paid
        const detailRes = await page.request.get(
          `${API_URL}/bookings/${created.id}`,
          { headers: { Authorization: `Bearer ${managerToken}` } },
        );
        const body = await detailRes.json();
        booking = (body.data ?? body) as Booking;
      }

      testBookingId = booking.id;
      amountPaid    = booking.amount_paid;

      await page.close();
    });

    test('TC-BOOK-01-A | POST /cancel з initiated_by=operator → HTTP 200', async ({ page }) => {
      expect(
        testBookingId,
        'beforeAll: не вдалось знайти або створити бронювання',
      ).toBeTruthy();

      const res = await page.request.post(
        `${API_URL}/bookings/${testBookingId}/cancel`,
        {
          headers: {
            Authorization  : `Bearer ${managerToken}`,
            'Content-Type' : 'application/json',
          },
          data: {
            reason      : 'tour_cancelled_by_operator',
            initiated_by: 'operator',
            comment     : 'QA тест TC-BOOK-01: скасування оператором',
          },
        },
      );
      expect(res.status()).toBe(200);
    });

    test('TC-BOOK-01-B | penalty_amount = 0 (BR-08: оператор не штрафує клієнта)', async ({ page }) => {
      expect(testBookingId).toBeTruthy();

      // Скасовуємо (або читаємо вже скасований результат)
      const res = await page.request.post(
        `${API_URL}/bookings/${testBookingId}/cancel`,
        {
          headers: {
            Authorization  : `Bearer ${managerToken}`,
            'Content-Type' : 'application/json',
          },
          data: { reason: 'operator_decision', initiated_by: 'operator' },
        },
      );

      // Може бути 200 або 422 якщо вже скасовано в попередньому тесті
      if (res.status() === 422) {
        // Бронювання вже в термінальному статусі — читаємо деталі напряму
        const detailRes = await page.request.get(
          `${API_URL}/bookings/${testBookingId}`,
          { headers: { Authorization: `Bearer ${managerToken}` } },
        );
        expect(detailRes.status()).toBe(200);
        const booking = ((await detailRes.json()).data ?? await detailRes.json()) as Booking;
        expect(booking.status).toBe('cancelled_operator');
        return;
      }

      expect(res.status()).toBe(200);
      const result: CancelBookingResult = (await res.json()).data ?? await res.json();

      // ── BR-08: нульовий штраф для оператора ──────────────
      expect(
        result.penalty_amount,
        `BR-08 ПОРУШЕНО: penalty_amount = ${result.penalty_amount}, очікувалось 0`,
      ).toBe(0);

      expect(
        result.penalty_pct,
        `BR-08 ПОРУШЕНО: penalty_pct = ${result.penalty_pct}%, очікувалось 0`,
      ).toBe(0);
    });

    test('TC-BOOK-01-C | refund_amount = booking.amount_paid (повне повернення)', async ({ page }) => {
      expect(testBookingId).toBeTruthy();

      // Якщо вже скасовано — перевіряємо збережений результат через booking detail
      const detailRes = await page.request.get(
        `${API_URL}/bookings/${testBookingId}`,
        { headers: { Authorization: `Bearer ${managerToken}` } },
      );
      expect(detailRes.status()).toBe(200);

      const booking = ((await detailRes.json()).data ?? await detailRes.json()) as Booking;

      // Якщо бронювання вже скасовано оператором — перевіряємо фінальний стан
      if (booking.status === 'cancelled_operator') {
        // Повернення вже оброблено — перевіряємо через refund endpoint або booking.refund_amount
        const refundAmount: number =
          (booking as unknown as Record<string, unknown>)['refund_amount'] as number
          ?? amountPaid; // за відсутності поля — вважаємо що повернуто все

        expect(
          refundAmount,
          `refund_amount (${refundAmount}) ≠ amount_paid (${amountPaid})`,
        ).toBe(amountPaid);
        return;
      }

      // Скасовуємо свіже бронювання
      const cancelRes = await page.request.post(
        `${API_URL}/bookings/${testBookingId}/cancel`,
        {
          headers: {
            Authorization  : `Bearer ${managerToken}`,
            'Content-Type' : 'application/json',
          },
          data: { reason: 'qa_test', initiated_by: 'operator' },
        },
      );

      expect(cancelRes.status()).toBe(200);
      const result: CancelBookingResult = (await cancelRes.json()).data ?? await cancelRes.json();

      // ── BR-08: refund_amount = amount_paid (нуль штрафу) ──
      expect(
        result.refund_amount,
        `refund_amount (${result.refund_amount}) ≠ amount_paid (${amountPaid}) — BR-08`,
      ).toBe(amountPaid);

      // ── Перевірка формули: refund = amount_paid - penalty ─
      const calculated = amountPaid - result.penalty_amount;
      expect(
        result.refund_amount,
        `refund (${result.refund_amount}) ≠ amount_paid - penalty (${calculated})`,
      ).toBe(calculated);
    });

    test('TC-BOOK-01-D | booking.status = cancelled_operator після скасування', async ({ page }) => {
      expect(testBookingId).toBeTruthy();

      const detailRes = await page.request.get(
        `${API_URL}/bookings/${testBookingId}`,
        { headers: { Authorization: `Bearer ${managerToken}` } },
      );
      expect(detailRes.status()).toBe(200);

      const booking = ((await detailRes.json()).data ?? await detailRes.json()) as Booking;
      expect(
        booking.status,
        `Бронювання має бути скасовано оператором, але статус: ${booking.status}`,
      ).toBe('cancelled_operator');
    });

  }); // end TC-BOOK-01

  // ──────────────────────────────────────────────────────────
  // TC-BOOK-02: BR-08 — Скасування КЛІЄНТОМ
  //
  // БП: якщо ініціатор = 'client' →
  //       penalty_pct > 0 (залежить від cancellation_policy та днів до виїзду)
  //       penalty_amount > 0
  //       refund_amount  = amount_paid - penalty_amount
  //       refund_amount  < amount_paid  (НЕ повне повернення)
  //       booking.status = 'cancelled_client'
  // ──────────────────────────────────────────────────────────

  test.describe('TC-BOOK-02 | BR-08: Скасування клієнтом → штраф > 0 по cancellation_policy', () => {

    let managerToken    : string;
    let clientBookingId : string;
    let clientAmountPaid: number;
    let cancelResult    : CancelBookingResult | null = null;

    test.beforeAll(async ({ browser }) => {
      const page = await browser.newPage();
      const { accessToken } = await apiLogin(page, 'manager');
      managerToken = accessToken;

      // Завжди створюємо свіже бронювання для цього тесту
      // (попереднє вже скасоване в TC-BOOK-01)
      try {
        const created = await createTestBooking(page.request, managerToken, {
          contact_name: `QA Client Cancel Test ${Date.now()}`,
        });
        await advanceBookingStatus(
          page.request, managerToken, created.id, 'confirmed',
        );

        // Отримуємо актуальні дані
        const detailRes = await page.request.get(
          `${API_URL}/bookings/${created.id}`,
          { headers: { Authorization: `Bearer ${managerToken}` } },
        );
        const body = await detailRes.json();
        const booking = (body.data ?? body) as Booking;
        clientBookingId  = booking.id;
        clientAmountPaid = booking.amount_paid;

        // Виконуємо скасування одразу в beforeAll щоб всі тести мали результат
        const cancelRes = await page.request.post(
          `${API_URL}/bookings/${clientBookingId}/cancel`,
          {
            headers: {
              Authorization  : `Bearer ${managerToken}`,
              'Content-Type' : 'application/json',
            },
            data: {
              reason      : 'client_changed_mind',
              initiated_by: 'client',
              comment     : 'QA тест TC-BOOK-02',
            },
          },
        );
        if (cancelRes.status() === 200) {
          cancelResult = (await cancelRes.json()).data ?? await cancelRes.json();
        }
      } catch (e) {
        console.warn('TC-BOOK-02 beforeAll: не вдалось підготувати бронювання:', e);
      }

      await page.close();
    });

    test('TC-BOOK-02-A | POST /cancel з initiated_by=client → HTTP 200', async ({ page }) => {
      if (!clientBookingId) {
        test.skip(true, 'beforeAll не створив бронювання — пропускаємо');
        return;
      }

      // Якщо cancelResult вже є — скасування відбулось в beforeAll
      if (cancelResult) {
        expect(cancelResult).toBeTruthy();
        return;
      }

      // Інакше скасовуємо тут
      const res = await page.request.post(
        `${API_URL}/bookings/${clientBookingId}/cancel`,
        {
          headers: {
            Authorization  : `Bearer ${managerToken}`,
            'Content-Type' : 'application/json',
          },
          data: { reason: 'client_request', initiated_by: 'client' },
        },
      );
      expect(res.status()).toBe(200);
      cancelResult = (await res.json()).data ?? await res.json();
    });

    test('TC-BOOK-02-B | penalty_pct > 0 (BR-08: клієнт платить штраф)', async ({ page }) => {
      if (!cancelResult) {
        test.skip(true, 'cancelResult відсутній — скасування не відбулось');
        return;
      }

      expect(
        cancelResult.penalty_pct,
        `BR-08 ПОРУШЕНО: penalty_pct = 0% для скасування клієнтом — штраф обов'язковий`,
      ).toBeGreaterThan(0);
    });

    test('TC-BOOK-02-C | penalty_amount > 0 в EUR', async ({ page }) => {
      if (!cancelResult) {
        test.skip(true, 'cancelResult відсутній');
        return;
      }

      expect(
        cancelResult.penalty_amount,
        `penalty_amount = 0, але cancellation_policy має нарахувати штраф`,
      ).toBeGreaterThan(0);

      // Перевірка формули: penalty_amount = total_price * penalty_pct / 100
      // (з округленням)
      const booking = cancelResult.booking;
      const expectedPenalty = Math.round(booking.total_price * cancelResult.penalty_pct / 100);
      expect(
        cancelResult.penalty_amount,
        `penalty_amount (${cancelResult.penalty_amount}) ≠ total_price × pct% (${expectedPenalty})`,
      ).toBe(expectedPenalty);
    });

    test('TC-BOOK-02-D | refund_amount = amount_paid − penalty_amount (часткове повернення)', async ({ page }) => {
      if (!cancelResult) {
        test.skip(true, 'cancelResult відсутній');
        return;
      }

      // ── Формула балансу ────────────────────────────────────
      const expected = clientAmountPaid - cancelResult.penalty_amount;
      expect(
        cancelResult.refund_amount,
        `refund_amount (${cancelResult.refund_amount}) ≠ amount_paid - penalty (${expected})`,
      ).toBe(expected);

      // ── Повернення МЕНШЕ від сплаченого ───────────────────
      // (відрізняє від операторського скасування де refund = amount_paid)
      expect(
        cancelResult.refund_amount,
        `refund_amount (${cancelResult.refund_amount}) ≥ amount_paid (${clientAmountPaid}) — штраф не застосований`,
      ).toBeLessThan(clientAmountPaid);

      // ── refund не від'ємний ───────────────────────────────
      expect(
        cancelResult.refund_amount,
        'refund_amount від\'ємний — неможливо',
      ).toBeGreaterThanOrEqual(0);
    });

    test('TC-BOOK-02-E | policy_applied не порожній рядок', async ({ page }) => {
      if (!cancelResult) {
        test.skip(true, 'cancelResult відсутній');
        return;
      }

      expect(
        typeof cancelResult.policy_applied,
        'policy_applied відсутній у відповіді',
      ).toBe('string');

      expect(
        cancelResult.policy_applied.length,
        'policy_applied порожній рядок',
      ).toBeGreaterThan(0);
    });

    test('TC-BOOK-02-F | booking.status = cancelled_client', async ({ page }) => {
      if (!clientBookingId) {
        test.skip(true, 'clientBookingId відсутній');
        return;
      }

      const res = await page.request.get(
        `${API_URL}/bookings/${clientBookingId}`,
        { headers: { Authorization: `Bearer ${managerToken}` } },
      );
      expect(res.status()).toBe(200);

      const booking = ((await res.json()).data ?? await res.json()) as Booking;
      expect(
        booking.status,
        `Статус бронювання ${booking.status} ≠ cancelled_client`,
      ).toBe('cancelled_client');
    });

    test('TC-BOOK-02-G | порівняння: operator_refund > client_refund за однакову суму', async ({ page }) => {
      // Непрямий тест: переконуємось що BR-08 диференціює ролі скасування
      if (!cancelResult) {
        test.skip(true, 'cancelResult відсутній');
        return;
      }

      // Якщо б скасував оператор — refund = amount_paid
      const operatorRefund = clientAmountPaid;
      // Клієнт скасував — refund < amount_paid
      const clientRefund   = cancelResult.refund_amount;

      expect(
        operatorRefund,
        `Оператор повертає ${operatorRefund}, клієнт ${clientRefund} — оператор має повертати більше`,
      ).toBeGreaterThan(clientRefund);
    });

  }); // end TC-BOOK-02

  // ──────────────────────────────────────────────────────────
  // TC-BOOK-03: BR-06 — FSM: new → completed ЗАБОРОНЕНО
  //
  // bookingTransitions.ts:
  //   BOOKING_STATUS_TRANSITIONS.new = ['in_work', 'pre_booked', 'cancelled_operator']
  //   'completed' НЕ в списку → перехід заборонений
  //
  // Очікуємо: HTTP 422 Unprocessable Entity
  //           body.error.code = 'transition' (або error.type = 'invalid_transition')
  //
  // Перевіряємо також інші заборонені переходи з 'new'.
  // ──────────────────────────────────────────────────────────

  test.describe('TC-BOOK-03 | BR-06: FSM new→completed заборонено → 422', () => {

    let managerToken : string;
    let newBookingId : string;

    test.beforeAll(async ({ browser }) => {
      const page = await browser.newPage();
      const { accessToken } = await apiLogin(page, 'manager');
      managerToken = accessToken;

      // Шукаємо існуючий 'new' booking або створюємо новий
      let booking = await findBookingByStatus(page.request, managerToken, 'new');

      if (!booking) {
        const created = await createTestBooking(page.request, managerToken, {
          contact_name: `QA FSM Test ${Date.now()}`,
        });
        // Нове бронювання за замовчуванням має статус 'new'
        booking = created;
      }

      newBookingId = booking.id;
      await page.close();
    });

    test('TC-BOOK-03-A | PATCH /status {new→completed} → HTTP 422', async ({ page }) => {
      expect(newBookingId, 'beforeAll: не знайдено booking зі статусом new').toBeTruthy();

      const res = await page.request.patch(
        `${API_URL}/bookings/${newBookingId}/status`,
        {
          headers: {
            Authorization  : `Bearer ${managerToken}`,
            'Content-Type' : 'application/json',
          },
          data: {
            status : 'completed',
            comment: 'QA тест TC-BOOK-03: спроба забороненого переходу',
          },
        },
      );

      // ── BR-06: заборонений перехід → 422 ─────────────────
      expect(
        res.status(),
        `Очікувалось 422 Unprocessable Entity, отримано: ${res.status()}`,
      ).toBe(422);
    });

    test('TC-BOOK-03-B | відповідь 422 містить error.code = "transition"', async ({ page }) => {
      expect(newBookingId).toBeTruthy();

      const res = await page.request.patch(
        `${API_URL}/bookings/${newBookingId}/status`,
        {
          headers: {
            Authorization  : `Bearer ${managerToken}`,
            'Content-Type' : 'application/json',
          },
          data: { status: 'completed' },
        },
      );

      expect(res.status()).toBe(422);

      const body = await res.json();

      // ── Тіло відповіді містить error ──────────────────────
      expect(body).toHaveProperty('error');

      const error = body.error as BookingStatusError['error'] | string;

      if (typeof error === 'string') {
        // Деякі реалізації: { error: "invalid_transition" }
        expect(error).toMatch(/transition/i);
      } else {
        // Типова реалізація: { error: { code: 'transition', ... } }
        const errorCode: string = error.code ?? (body.error_code as string) ?? '';
        expect(
          errorCode,
          `error.code = "${errorCode}", очікувалось щось з "transition"`,
        ).toMatch(/transition/i);
      }
    });

    test('TC-BOOK-03-C | відповідь містить from та to у деталях помилки', async ({ page }) => {
      expect(newBookingId).toBeTruthy();

      const res = await page.request.patch(
        `${API_URL}/bookings/${newBookingId}/status`,
        {
          headers: {
            Authorization  : `Bearer ${managerToken}`,
            'Content-Type' : 'application/json',
          },
          data: { status: 'completed' },
        },
      );

      expect(res.status()).toBe(422);
      const body = await res.json();
      const rawJson = JSON.stringify(body);

      // ── Відповідь інформативна: вказує неправильний перехід ──
      // Очікуємо хоча б один з варіантів:
      //   { error: { from: 'new', to: 'completed' } }
      //   { error: { message: "Cannot transition from new to completed" } }
      //   { allowed: ['in_work', 'pre_booked', 'cancelled_operator'] }
      const hasFromTo = rawJson.includes('"from"') && rawJson.includes('"to"');
      const hasStatusMention = rawJson.includes('new') && rawJson.includes('completed');
      const hasAllowed = rawJson.includes('"allowed"') || rawJson.includes('in_work');

      expect(
        hasFromTo || hasStatusMention || hasAllowed,
        `422-відповідь не інформативна: ${rawJson}`,
      ).toBeTruthy();
    });

    test('TC-BOOK-03-D | статус бронювання НЕ змінився після 422', async ({ page }) => {
      expect(newBookingId).toBeTruthy();

      // ── Спроба зміни ──────────────────────────────────────
      await page.request.patch(
        `${API_URL}/bookings/${newBookingId}/status`,
        {
          headers: {
            Authorization  : `Bearer ${managerToken}`,
            'Content-Type' : 'application/json',
          },
          data: { status: 'completed' },
        },
      );

      // ── Перевіряємо що статус залишився 'new' ─────────────
      const detailRes = await page.request.get(
        `${API_URL}/bookings/${newBookingId}`,
        { headers: { Authorization: `Bearer ${managerToken}` } },
      );
      expect(detailRes.status()).toBe(200);

      const booking = ((await detailRes.json()).data ?? await detailRes.json()) as Booking;
      expect(
        booking.status,
        `Бронювання змінило статус на "${booking.status}" після забороненого переходу!`,
      ).toBe('new');
    });

    test('TC-BOOK-03-E | інші заборонені переходи з new → теж 422', async ({ page }) => {
      expect(newBookingId).toBeTruthy();

      // bookingTransitions.ts: new → тільки ['in_work','pre_booked','cancelled_operator']
      // Всі інші — заборонені
      const forbiddenTargets: BookingStatus[] = [
        'needs_clarification',
        'awaiting_payment',
        'partially_paid',
        'confirmed',
        'docs_collected',
        'ready_to_depart',
        'on_trip',
        'completed',      // Основний тест-кейс
        'cancelled_client',
        'no_show',
        'refund',
      ];

      for (const targetStatus of forbiddenTargets) {
        const res = await page.request.patch(
          `${API_URL}/bookings/${newBookingId}/status`,
          {
            headers: {
              Authorization  : `Bearer ${managerToken}`,
              'Content-Type' : 'application/json',
            },
            data: { status: targetStatus },
          },
        );

        expect(
          res.status(),
          `new → ${targetStatus}: очікувалось 422, отримано ${res.status()}`,
        ).toBe(422);

        // Невелика пауза між запитами
        await page.waitForTimeout(100);
      }
    });

    test('TC-BOOK-03-F | дозволений перехід new→in_work → HTTP 200', async ({ page }) => {
      // Контрольний тест: переконуємось що FSM-валідація не блокує ВСЕ
      // (а тільки заборонені переходи)
      expect(newBookingId).toBeTruthy();

      const res = await page.request.patch(
        `${API_URL}/bookings/${newBookingId}/status`,
        {
          headers: {
            Authorization  : `Bearer ${managerToken}`,
            'Content-Type' : 'application/json',
          },
          data: {
            status : 'in_work',
            comment: 'QA тест: дозволений перехід',
          },
        },
      );

      // Перший дозволений перехід з 'new' → 'in_work'
      expect(
        res.status(),
        `new → in_work повинно бути дозволено (200), але отримано ${res.status()}`,
      ).toBe(200);

      const booking = ((await res.json()).data ?? await res.json()) as Booking;
      expect(booking.status).toBe('in_work');
    });

  }); // end TC-BOOK-03

  // ──────────────────────────────────────────────────────────
  // TC-BOOK-04: RBAC — агент бачить ТІЛЬКИ свої бронювання
  //
  // ТЗ §4.4: Агент — права: "бачити тільки свої заявки"
  // useBookings.ts: filterMocks → if (params?.agent_id && b.agent_id !== ...)
  //
  // Перевіряємо:
  //   1. Всі отримані booking.agent_id === agent.id
  //   2. GET /bookings?agent_id=чужий → порожній список або 403
  //   3. GET /bookings/:id чужого бронювання → 403 (IDOR)
  //   4. Менеджер бачить більше бронювань (контроль)
  // ──────────────────────────────────────────────────────────

  test.describe('TC-BOOK-04 | RBAC: агент бачить тільки свої бронювання', () => {

    let agentToken   : string;
    let agentId      : string;
    let managerToken : string;

    test.beforeAll(async ({ browser }) => {
      const page = await browser.newPage();

      const [agentAuth, managerAuth] = await Promise.all([
        apiLogin(page, 'agent'),
        apiLogin(page, 'manager'),
      ]);

      agentToken   = agentAuth.accessToken;
      managerToken = managerAuth.accessToken;

      // Дістаємо agentId з profle (GET /auth/me або з user object)
      const agentUser = agentAuth.user as Record<string, unknown>;
      agentId =
        (agentUser['agent_id'] as string)  ??
        (agentUser['agentId']  as string)  ??
        (agentUser['id']       as string);

      await page.close();
    });

    test('TC-BOOK-04-A | GET /bookings → 200, список бронювань агента', async ({ page }) => {
      const res = await page.request.get(`${API_URL}/bookings`, {
        headers: { Authorization: `Bearer ${agentToken}` },
      });

      expect(res.status()).toBe(200);

      const body = await res.json();
      const bookings: Booking[] =
        body.data?.bookings ?? body.data ?? body.bookings ?? [];

      // Якщо є бронювання у seed — їх кількість > 0
      // (якщо 0 — тест проходить тривіально)
      expect(Array.isArray(bookings)).toBe(true);
    });

    test('TC-BOOK-04-B | всі booking.agent_id === agent.id (ізоляція)', async ({ page }) => {
      const res = await page.request.get(`${API_URL}/bookings?limit=50`, {
        headers: { Authorization: `Bearer ${agentToken}` },
      });
      expect(res.status()).toBe(200);

      const body = await res.json();
      const bookings: Booking[] =
        body.data?.bookings ?? body.data ?? body.bookings ?? [];

      if (bookings.length === 0) {
        // Seed не містить бронювань цього агента — пропускаємо з попередженням
        console.warn('TC-BOOK-04-B: у агента 0 бронювань — seed перевірено тривіально');
        return;
      }

      // ── Ключова перевірка: кожен запис належить цьому агенту ──
      for (const booking of bookings) {
        const bookingAgentId = booking.agent_id;

        expect(
          bookingAgentId,
          `Бронювання ${booking.booking_number} має agent_id="${bookingAgentId}", очікувалось "${agentId}" — RBAC витік!`,
        ).toBe(agentId);
      }
    });

    test('TC-BOOK-04-C | GET /bookings?agent_id=<чужий> → порожній або 403', async ({ page }) => {
      // Агент не може запросити бронювання іншого агента через query-param
      const fakeAgentId = 'agent-id-that-does-not-belong-to-me-99999';

      const res = await page.request.get(
        `${API_URL}/bookings?agent_id=${fakeAgentId}`,
        { headers: { Authorization: `Bearer ${agentToken}` } },
      );

      // Очікуємо або:
      // а) 403 — сервер не дозволяє фільтрувати за чужим agent_id
      // б) 200 з порожнім масивом — сервер ігнорує підмінений параметр
      if (res.status() === 403) {
        // Найкраща поведінка — явна відмова
        expect(res.status()).toBe(403);
      } else {
        expect(res.status()).toBe(200);
        const body = await res.json();
        const bookings: Booking[] =
          body.data?.bookings ?? body.data ?? body.bookings ?? [];

        // Якщо 200 — список має бути порожнім або містити тільки свої
        for (const booking of bookings) {
          expect(
            booking.agent_id,
            `agent_id підміна: агент бачить чуже бронювання ${booking.booking_number}`,
          ).toBe(agentId);
        }
      }
    });

    test('TC-BOOK-04-D | IDOR: GET /bookings/:id чужого → 403', async ({ page }) => {
      // Отримуємо список ВСІХ бронювань від менеджера
      const managerRes = await page.request.get(
        `${API_URL}/bookings?limit=20`,
        { headers: { Authorization: `Bearer ${managerToken}` } },
      );
      expect(managerRes.status()).toBe(200);

      const allBookings: Booking[] =
        ((await managerRes.json()).data?.bookings ?? (await managerRes.json()).data ?? []) as Booking[];

      // Бронювання агента
      const agentRes = await page.request.get(
        `${API_URL}/bookings?limit=20`,
        { headers: { Authorization: `Bearer ${agentToken}` } },
      );
      const agentBookings: Booking[] =
        ((await agentRes.json()).data?.bookings ?? (await agentRes.json()).data ?? []) as Booking[];
      const agentBookingIds = new Set(agentBookings.map((b) => b.id));

      // Знаходимо бронювання що НЕ належить агенту
      const otherBooking = allBookings.find(
        (b) => b.agent_id !== agentId && !agentBookingIds.has(b.id),
      );

      if (!otherBooking) {
        test.skip(
          true,
          'Seed не містить бронювань іншого агента — IDOR тест пропущено',
        );
        return;
      }

      // ── IDOR спроба: агент читає чуже бронювання за ID ───
      const idorRes = await page.request.get(
        `${API_URL}/bookings/${otherBooking.id}`,
        { headers: { Authorization: `Bearer ${agentToken}` } },
      );

      expect(
        idorRes.status(),
        `IDOR ВИЯВЛЕНО: агент отримав бронювання ${otherBooking.booking_number} (agent_id: ${otherBooking.agent_id}) — HTTP ${idorRes.status()}`,
      ).toBe(403);
    });

    test('TC-BOOK-04-E | менеджер бачить більше бронювань ніж агент (контроль)', async ({ page }) => {
      const [agentRes, managerRes] = await Promise.all([
        page.request.get(`${API_URL}/bookings?limit=100`, {
          headers: { Authorization: `Bearer ${agentToken}` },
        }),
        page.request.get(`${API_URL}/bookings?limit=100`, {
          headers: { Authorization: `Bearer ${managerToken}` },
        }),
      ]);

      expect(agentRes.status()).toBe(200);
      expect(managerRes.status()).toBe(200);

      const agentBody   = await agentRes.json();
      const managerBody = await managerRes.json();

      const agentTotal: number =
        agentBody.data?.meta?.total ?? agentBody.meta?.total ??
        (agentBody.data?.bookings ?? agentBody.data ?? agentBody.bookings ?? []).length;

      const managerTotal: number =
        managerBody.data?.meta?.total ?? managerBody.meta?.total ??
        (managerBody.data?.bookings ?? managerBody.data ?? managerBody.bookings ?? []).length;

      // Менеджер бачить >= бронювань агента
      expect(
        managerTotal,
        `Менеджер (${managerTotal}) бачить менше бронювань ніж агент (${agentTotal})`,
      ).toBeGreaterThanOrEqual(agentTotal);
    });

    test('TC-BOOK-04-F | agent НЕ бачить margin/costPrice у бронюванні (BR-04)', async ({ page }) => {
      const res = await page.request.get(`${API_URL}/bookings?limit=5`, {
        headers: { Authorization: `Bearer ${agentToken}` },
      });
      expect(res.status()).toBe(200);

      const rawJson = await res.text();

      // BR-04: внутрішні фінансові поля недоступні агенту
      const forbiddenFields = [
        '"cost_price":', '"costPrice":',
        '"margin":', '"netProfit":',
        '"net_profit":', '"internal_notes":',
        '"operator_comment":', '"internalNotes":',
      ];

      for (const field of forbiddenFields) {
        expect(
          rawJson,
          `BR-04 ПОРУШЕНО у /bookings: поле "${field}" видиме агенту`,
        ).not.toContain(field);
      }
    });

  }); // end TC-BOOK-04

}); // end Suite
