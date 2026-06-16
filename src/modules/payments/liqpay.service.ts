// =============================================================
// EUROTRIPS — LiqPay Service
// POST /webhooks/liqpay  — обробник callback від LiqPay
//
// Алгоритм:
//  1. Верифікація підпису SHA1(PRIVATE_KEY + data + PRIVATE_KEY)
//  2. Декодування base64 → JSON
//  3. success/sandbox → створити Payment + оновити booking.status
//  4. reversed        → записати refund Payment + booking → 'refund'
//  5. failure/error   → записати в audit_log
// =============================================================

import crypto from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type {
  LiqPayWebhookPayload,
  LiqPayCallbackData,
  LiqPayCheckoutParams,
  LiqPayCheckoutData,
} from './liqpay.types';

// ─── ENV ─────────────────────────────────────────────────────────────────────

const LIQPAY_PRIVATE_KEY = process.env.LIQPAY_PRIVATE_KEY ?? '';
const LIQPAY_PUBLIC_KEY  = process.env.LIQPAY_PUBLIC_KEY  ?? '';
const APP_FRONTEND_URL   = process.env.APP_FRONTEND_URL   ?? 'https://eurotrips.ua';
const API_URL            = process.env.API_URL            ?? 'https://api.eurotrips.ua';

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
   * Успішна оплата → створити Payment + оновити booking.status.
   *
   * Idempotency: перевіряємо external_payment_id перед записом.
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
        action: 'LIQPAY_BOOKING_NOT_FOUND',
        entityType: 'payment',
        entityId: order_id,
        details: { payment_id: String(payment_id), order_id },
        severity: 'error',
      });
      return;
    }

    // ── Idempotency check ──
    const existing = await this.prisma.payment.findFirst({
      where: { externalPaymentId: String(payment_id) },
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
      const isDeposit = this.isDepositPayment(order_id, booking.amountPaid.toNumber());

      // Зберегти Payment
      await tx.payment.create({
        data: {
          bookingId: booking.id,
          amount:             amount,
          currency:           currency ?? 'UAH',
          type:               isDeposit ? 'deposit' : 'final_payment',
          method:             'liqpay',
          status:             'completed',
          externalPaymentId:  String(payment_id),
          paidAt:             end_date ? new Date(end_date) : new Date(),
          // metadata: free-form JSON для діагностики
          metadata: {
            liqpay_order_id:  order_id,
            liqpay_status:    data.status,
            liqpay_payment_id: payment_id,
            card_mask:        data.sender_card_mask2 ?? null,
          },
        },
      });

      // Перерахувати фінансовий стан
      const newAmountPaid  = booking.amountPaid.toNumber() + amount;
      const totalPrice     = booking.totalPrice.toNumber();
      const newBalanceDue  = Math.max(0, totalPrice - newAmountPaid);

      // Наступний статус за BR-06
      const nextStatus = this.resolveNextStatus(booking.status, newAmountPaid, totalPrice);

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          amountPaid:  newAmountPaid,
          balanceDue:  newBalanceDue,
          status:      nextStatus,
          updatedAt:   new Date(),
        },
      });

      // Лог у communications
      await tx.communication.create({
        data: {
          bookingId:  booking.id,
          channel:    'system',
          direction:  'inbound',
          subject:    `LiqPay платіж: ${amount} ${currency ?? 'UAH'}`,
          body: [
            `order_id: ${order_id}`,
            `payment_id: ${payment_id}`,
            `статус: success`,
            `новий статус бронювання: ${nextStatus}`,
          ].join('\n'),
          status:  'delivered',
          sentAt:  new Date(),
        },
      });

      this.logger.info(
        {
          bookingId:  booking.id,
          amount,
          newAmountPaid,
          newBalanceDue,
          nextStatus,
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
          bookingId:          bookingId,
          amount:             -Math.abs(amount),
          currency:           currency ?? 'UAH',
          type:               'refund',
          method:             'liqpay',
          status:             'completed',
          externalPaymentId:  `rev_${payment_id}`,
          paidAt:             new Date(),
          metadata:           { liqpay_order_id: order_id, reversed: true },
        },
      });

      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'refund', updatedAt: new Date() },
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
      action:     `LIQPAY_${status.toUpperCase()}`,
      entityType: 'payment',
      entityId:   order_id,
      details: {
        payment_id:      String(payment_id),
        status,
        err_code:        err_code ?? null,
        err_description: err_description ?? null,
      },
      severity: status === 'wait_accept' ? 'info' : 'warning',
    });
  }

  // ─── Генерація checkout форми ───────────────────────────────────────────────

  /**
   * Генерує data + signature для HTML-форми LiqPay.
   * Викликається з /api/v1/bookings/:id/payment (payments service).
   *
   * @example
   *   const { data, signature } = liqPayService.generateCheckout({
   *     orderId: `ET-${bookingId}-deposit`,
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
   *   ET-{uuid}              → {uuid}
   *   ET-{uuid}-deposit      → {uuid}
   *   ET-{uuid}-final        → {uuid}
   *   ET-{uuid}-retry_3      → {uuid}
   */
  extractBookingId(orderId: string): string {
    return orderId.replace(/-(deposit|final|retry_\d+)$/, '');
  }

  /**
   * Визначає, чи платіж є передоплатою (депозитом).
   */
  private isDepositPayment(orderId: string, currentAmountPaid: number): boolean {
    return orderId.includes('-deposit') || currentAmountPaid === 0;
  }

  /**
   * Визначає наступний статус бронювання після успішної оплати.
   * Дотримується BR-06 (статусна машина).
   */
  private resolveNextStatus(
    currentStatus: string,
    newAmountPaid: number,
    totalPrice: number,
  ): string {
    if (newAmountPaid >= totalPrice) {
      // Повністю оплачено — якщо бронювання ще в awaiting_payment або partially_paid
      if (currentStatus === 'awaiting_payment' || currentStatus === 'partially_paid') {
        return 'confirmed';
      }
    } else if (newAmountPaid > 0) {
      // Передоплата сплачена
      if (currentStatus === 'awaiting_payment') {
        return 'partially_paid';
      }
    }
    // Інші статуси не змінюємо (confirmed, docs_collected тощо)
    return currentStatus;
  }

  /**
   * Записує подію в audit_log.
   */
  private async writeAuditLog(entry: {
    action: string;
    entityType: string;
    entityId?: string;
    details: Record<string, unknown>;
    severity: 'info' | 'warning' | 'error';
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action:     entry.action,
          entityType: entry.entityType,
          entityId:   entry.entityId ?? null,
          details:    entry.details,
          severity:   entry.severity,
          source:     'liqpay_webhook',
          createdAt:  new Date(),
        },
      });
    } catch (err) {
      // audit_log нікoli не повинен падати основний flow
      this.logger.error({ err, entry }, 'Не вдалося записати в audit_log');
    }
  }
}
