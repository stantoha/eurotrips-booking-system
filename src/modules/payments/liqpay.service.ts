// =============================================================
// EUROTRIPS — LiqPay Service
// POST /webhooks/liqpay  — обробник callback від LiqPay
//
// Алгоритм:
//  1. Верифікація підпису SHA1(PRIVATE_KEY + data + PRIVATE_KEY)
//  2. Декодування base64 → JSON
//  3. success/sandbox → створити Payment + оновити booking (depositPaid/balancePaid/paymentStatus/status)
//  4. reversed        → записати refund Payment + booking → 'refund'
//  5. failure/error   → записати в audit_log
//
// Поля Payment/Booking/AuditLog/Communication нижче звірені напряму проти
// prisma/schema.prisma (paymentType/paymentMethod/externalId,
// depositPaid/balancePaid/balanceAmount/paymentStatus, tableName/recordId/
// newData на AuditLog, channel:'internal') — попередня версія файлу мала
// 20 розбіжностей з реальною схемою (type/method/externalPaymentId,
// booking.amountPaid/totalPrice/balanceDue яких не існує, auditLog з
// entityType/entityId/details/severity/source яких немає в моделі).
// =============================================================

import crypto from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { PrismaClient, Prisma, BookingStatus } from '@prisma/client';
import type {
  LiqPayWebhookPayload,
  LiqPayCallbackData,
  LiqPayCheckoutParams,
  LiqPayCheckoutData,
} from './liqpay.types';

// ─── ENV ─────────────────────────────────────────────────────────────────────

const LIQPAY_PRIVATE_KEY = process.env.LIQPAY_PRIVATE_KEY ?? '';
const LIQPAY_PUBLIC_KEY  = process.env.LIQPAY_PUBLIC_KEY  ?? '';

// Системний userId для audit_log у webhook-контексті (немає залогіненого
// користувача) — AuditLog.userId є обов'язковим полем у схемі. Встановити
// у Railway Variables (UUID користувача з role=admin). Якщо не встановлено —
// подія лише логується, без запису в audit_log (не критично для основного flow).
const SYSTEM_USER_ID = process.env.SYSTEM_USER_ID ?? null;

// =============================================================================

export class LiqPayService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: FastifyBaseLogger,
  ) {}

  // ─── Верифікація підпису ────────────────────────────────────────────────────

  /**
   * Верифікує HMAC-SHA1 підпис від LiqPay.
   *
   * Алгоритм: base64( SHA1( PRIVATE_KEY + data + PRIVATE_KEY ) )
   * Constant-time compare проти timing attacks.
   */
  verifySignature(data: string, receivedSignature: string): boolean {
    if (!LIQPAY_PRIVATE_KEY) {
      this.logger.warn('LIQPAY_PRIVATE_KEY не налаштований');
      return false;
    }

    const expected = crypto
      .createHash('sha1')
      .update(LIQPAY_PRIVATE_KEY + data + LIQPAY_PRIVATE_KEY)
      .digest('base64');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(receivedSignature),
      );
    } catch {
      // Буфери різної довжини → невалідний підпис
      return false;
    }
  }

  /**
   * Декодує base64 payload → LiqPayCallbackData.
   */
  decodePayload(data: string): LiqPayCallbackData {
    const json = Buffer.from(data, 'base64').toString('utf-8');
    return JSON.parse(json) as LiqPayCallbackData;
  }

  // ─── Головний обробник webhook ──────────────────────────────────────────────

  /**
   * POST /webhooks/liqpay
   *
   * LiqPay очікує HTTP 200 в будь-якому разі.
   * Всі помилки логуємо, але НЕ кидаємо — щоб LiqPay не ретраїв нескінченно.
   */
  async handleWebhook(payload: LiqPayWebhookPayload): Promise<void> {
    const { data: rawData, signature } = payload;

    // 1. Верифікація підпису
    if (!this.verifySignature(rawData, signature)) {
      this.logger.warn({ rawData: rawData.slice(0, 50) }, 'LiqPay webhook: невалідний підпис — відхилено');
      // Не кидаємо — просто ігноруємо підроблений запит
      return;
    }

    // 2. Декодування
    let callbackData: LiqPayCallbackData;
    try {
      callbackData = this.decodePayload(rawData);
    } catch (err) {
      this.logger.error({ err }, 'LiqPay webhook: не вдалося декодувати payload');
      return;
    }

    const { order_id, status, amount, currency, payment_id } = callbackData;

    this.logger.info(
      { order_id, status, amount, currency, payment_id },
      `LiqPay webhook: отримано статус="${status}"`,
    );

    // 3. Маршрутизація за статусом
    if (status === 'success' || status === 'sandbox') {
      await this.handleSuccess(callbackData);
    } else if (status === 'reversed') {
      await this.handleReversal(callbackData);
    } else if (status === 'wait_accept' || status === 'hold_wait') {
      // Hold — нічого не робимо, чекаємо наступного webhook
      this.logger.info({ order_id, status }, 'LiqPay: hold — очікуємо підтвердження');
    } else {
      // failure, error, wait_secure, тощо
      await this.handleFailure(callbackData);
    }
  }

  // ─── Успішний платіж ────────────────────────────────────────────────────────

  /**
   * Успішна оплата → створити Payment + оновити фінансовий стан бронювання.
   *
   * Idempotency: перевіряємо externalId перед записом.
   * Транзакція: Payment + Booking + Communication — все або нічого.
   */
  private async handleSuccess(data: LiqPayCallbackData): Promise<void> {
    const { order_id, amount, currency, payment_id, end_date } = data;
    const bookingId = this.extractBookingId(order_id);

    // ── Знайти бронювання ──
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { tour: { select: { name: true, code: true } } },
    });

    if (!booking) {
      this.logger.error({ order_id, bookingId }, 'LiqPay success: бронювання не знайдено');
      await this.writeAuditLog({
        action:    'LIQPAY_BOOKING_NOT_FOUND',
        tableName: 'payments',
        recordId:  order_id,
        newData:   { payment_id: String(payment_id), order_id, status: 'error' },
      });
      return;
    }

    // ── Idempotency check ──
    const existing = await this.prisma.payment.findFirst({
      where: { externalId: String(payment_id) },
    });
    if (existing) {
      this.logger.info(
        { payment_id, bookingId },
        'LiqPay: платіж вже оброблено — пропускаємо (idempotency)',
      );
      return;
    }

    // ── Транзакція ──
    await this.prisma.$transaction(async (tx) => {
      const currentDepositPaid = Number(booking.depositPaid);
      const currentBalancePaid = Number(booking.balancePaid);
      const totalAmount        = Number(booking.totalAmount);
      const depositAmount      = Number(booking.depositAmount ?? 0);

      const isDeposit = this.isDepositPayment(order_id, currentDepositPaid);

      // Зберегти Payment
      await tx.payment.create({
        data: {
          bookingId:     booking.id,
          amount,
          currency:      currency ?? 'UAH',
          paymentType:   isDeposit ? 'deposit' : 'balance',
          paymentMethod: 'payment_link',
          status:        'confirmed',
          externalId:    String(payment_id),
          paidAt:        end_date ? new Date(end_date) : new Date(),
          // metadata: free-form JSON для діагностики
          metadata: {
            liqpay_order_id:   order_id,
            liqpay_status:     data.status,
            liqpay_payment_id: payment_id,
            card_mask:         data.sender_card_mask2 ?? null,
          },
        },
      });

      // Перерахувати фінансовий стан — депозит/баланс окремо (Booking не
      // має єдиного amountPaid/balanceDue, тільки depositPaid+balancePaid)
      const newDepositPaid = isDeposit ? currentDepositPaid + amount : currentDepositPaid;
      const newBalancePaid = !isDeposit ? currentBalancePaid + amount : currentBalancePaid;
      const totalPaid       = newDepositPaid + newBalancePaid;
      const newBalanceAmount = Math.max(0, totalAmount - totalPaid);

      const newPaymentStatus = this.resolvePaymentStatus(totalPaid, depositAmount, totalAmount);
      const nextStatus        = this.resolveNextStatus(booking.status, totalPaid, totalAmount);

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          depositPaid:   newDepositPaid,
          balancePaid:   newBalancePaid,
          balanceAmount: newBalanceAmount,
          paymentStatus: newPaymentStatus,
          status:        nextStatus as BookingStatus,
          updatedAt:     new Date(),
        },
      });

      // Лог у communications
      await tx.communication.create({
        data: {
          bookingId:  booking.id,
          channel:    'internal',
          direction:  'inbound',
          subject:    `LiqPay платіж: ${amount} ${currency ?? 'UAH'}`,
          body: [
            `order_id: ${order_id}`,
            `payment_id: ${payment_id}`,
            `тип: ${isDeposit ? 'deposit' : 'balance'}`,
            `статус: success`,
            `новий статус бронювання: ${nextStatus}`,
            `новий paymentStatus: ${newPaymentStatus}`,
          ].join('\n'),
          status:  'delivered',
          sentAt:  new Date(),
        },
      });

      this.logger.info(
        {
          bookingId:  booking.id,
          amount,
          totalPaid,
          newBalanceAmount,
          nextStatus,
          newPaymentStatus,
        },
        'LiqPay: платіж успішно збережено',
      );
    });
  }

  // ─── Повернення коштів ──────────────────────────────────────────────────────

  /**
   * LiqPay reversed → Payment(type=refund, amount=negative) + booking → 'refund'.
   * BR-08: при cancelled_operator — повне повернення вже виконано в BookingService,
   *        тут фіксуємо факт повернення від платіжного шлюзу.
   */
  private async handleReversal(data: LiqPayCallbackData): Promise<void> {
    const { order_id, amount, currency, payment_id } = data;
    const bookingId = this.extractBookingId(order_id);

    await this.prisma.$transaction(async (tx) => {
      // Від'ємна сума = повернення коштів
      await tx.payment.create({
        data: {
          bookingId,
          amount:        -Math.abs(amount),
          currency:      currency ?? 'UAH',
          paymentType:   'refund',
          paymentMethod: 'payment_link',
          status:        'confirmed',
          externalId:    `rev_${payment_id}`,
          paidAt:        new Date(),
          metadata:      { liqpay_order_id: order_id, reversed: true },
        },
      });

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status:        'refund',
          paymentStatus: 'unpaid',
          updatedAt:     new Date(),
        },
      });
    });

    this.logger.info({ order_id, amount, bookingId }, 'LiqPay: повернення оброблено');
  }

  // ─── Помилка / відмова ──────────────────────────────────────────────────────

  /**
   * Всі нестандартні статуси → audit_log.
   * Статус бронювання НЕ змінюємо — клієнт може спробувати знову.
   */
  private async handleFailure(data: LiqPayCallbackData): Promise<void> {
    const { order_id, status, payment_id, err_code, err_description } = data;

    this.logger.warn(
      { order_id, status, payment_id, err_code, err_description },
      `LiqPay: платіж не успішний (status=${status})`,
    );

    await this.writeAuditLog({
      action:    `LIQPAY_${status.toUpperCase()}`,
      tableName: 'payments',
      recordId:  order_id,
      newData: {
        payment_id:      String(payment_id),
        status,
        err_code:        err_code ?? null,
        err_description: err_description ?? null,
      },
    });
  }

  // ─── Генерація checkout форми ───────────────────────────────────────────────

  /**
   * Генерує data + signature для HTML-форми LiqPay.
   * Викликається з /api/v1/bookings/:id/payment/liqpay (liqpay.routes.ts).
   *
   * @example
   *   const { data, signature } = liqPayService.generateCheckout({
   *     orderId: `${bookingId}-deposit`,
   *     amount: depositAmountUah,
   *     description: `Тур "${tourName}" — передоплата`,
   *     resultUrl: `${APP_FRONTEND_URL}/bookings/${bookingId}/success`,
   *     serverUrl: `${API_URL}/webhooks/liqpay`,
   *   });
   */
  generateCheckout(params: LiqPayCheckoutParams): LiqPayCheckoutData {
    const payload = {
      version:     3,
      public_key:  LIQPAY_PUBLIC_KEY,
      action:      'pay',
      amount:      params.amount,
      currency:    'UAH',
      description: params.description,
      order_id:    params.orderId,
      result_url:  params.resultUrl,
      server_url:  params.serverUrl,
      language:    'uk',
    };

    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = crypto
      .createHash('sha1')
      .update(LIQPAY_PRIVATE_KEY + data + LIQPAY_PRIVATE_KEY)
      .digest('base64');

    return { data, signature };
  }

  // ─── Допоміжні методи ───────────────────────────────────────────────────────

  /**
   * Витягує bookingId з order_id.
   *
   * Формати:
   *   {uuid}                  → {uuid}
   *   {uuid}-deposit          → {uuid}
   *   {uuid}-final_payment    → {uuid}  (тип платежу з liqpay.routes.ts)
   *   {uuid}-final            → {uuid}
   *   {uuid}-retry_3          → {uuid}
   */
  extractBookingId(orderId: string): string {
    return orderId.replace(/^ET-/, '').replace(/-(deposit|final_payment|final|retry_\d+)$/, '');
  }

  /**
   * Визначає, чи платіж є передоплатою (депозитом).
   */
  private isDepositPayment(orderId: string, currentDepositPaid: number): boolean {
    return orderId.includes('-deposit') || currentDepositPaid === 0;
  }

  /**
   * Визначає paymentStatus бронювання після оплати (BookingPaymentStatus enum).
   */
  private resolvePaymentStatus(
    totalPaid:     number,
    depositAmount: number,
    totalAmount:   number,
  ): 'unpaid' | 'deposit_paid' | 'partially_paid' | 'fully_paid' {
    if (totalPaid <= 0)              return 'unpaid';
    if (totalPaid >= totalAmount)    return 'fully_paid';
    if (totalPaid >= depositAmount)  return 'deposit_paid';
    return 'partially_paid';
  }

  /**
   * Визначає наступний статус бронювання після успішної оплати.
   * Дотримується BR-06 (статусна машина).
   */
  private resolveNextStatus(
    currentStatus: string,
    totalPaid:     number,
    totalAmount:   number,
  ): string {
    if (totalPaid >= totalAmount) {
      // Повністю оплачено — якщо бронювання ще в awaiting_payment або partially_paid
      if (currentStatus === 'awaiting_payment' || currentStatus === 'partially_paid') {
        return 'confirmed';
      }
    } else if (totalPaid > 0) {
      // Передоплата сплачена
      if (currentStatus === 'awaiting_payment') {
        return 'partially_paid';
      }
    }
    // Інші статуси не змінюємо (confirmed, docs_collected тощо)
    return currentStatus;
  }

  /**
   * Записує подію в audit_log. userId — обов'язкове поле в схемі, тому без
   * SYSTEM_USER_ID запис лише логується (не критично для основного flow).
   */
  private async writeAuditLog(entry: {
    action:    string;
    tableName: string;
    recordId:  string;
    newData:   Prisma.InputJsonValue;
  }): Promise<void> {
    if (!SYSTEM_USER_ID) {
      this.logger.info(
        { audit: entry },
        'AuditLog: SYSTEM_USER_ID не встановлено — запис тільки в лог (встановити SYSTEM_USER_ID у Railway Variables)',
      );
      return;
    }
    try {
      await this.prisma.auditLog.create({
        data: {
          userId:    SYSTEM_USER_ID,
          action:    entry.action,
          tableName: entry.tableName,
          recordId:  entry.recordId,
          newData:   entry.newData,
          createdAt: new Date(),
        },
      });
    } catch (err) {
      // audit_log ніколи не повинен ламати основний flow
      this.logger.error({ err, entry }, 'Не вдалося записати в audit_log');
    }
  }
}
