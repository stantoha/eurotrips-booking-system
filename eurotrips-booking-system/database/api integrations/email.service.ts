// =============================================================
// EUROTRIPS — Email Service (Brevo)
// SDK: @getbrevo/brevo  →  npm install @getbrevo/brevo
//
// Методи:
//   sendBookingConfirmation(booking, tourist)
//   sendPaymentReminder(booking, daysLeft)
//   sendPreDepartureInfo(booking, infolistUrl)
//   sendPaymentReceived(booking, amount)
//   sendCancellationNotice(booking, cancelledBy, refundAmount?)
//
// Всі помилки відправки логуються, але НЕ кидаються вгору —
// email не повинен зупиняти основну транзакцію бізнес-логіки.
// При помилці — задача потрапляє у BullMQ Dead Letter Queue.
// =============================================================

import * as Brevo from '@getbrevo/brevo';
import type { FastifyBaseLogger } from 'fastify';
import type { PrismaClient }     from '@prisma/client';
import type {
  BookingEmailContext,
  TouristEmailContext,
  EmailSendParams,
  EmailRecipient,
} from './email.types';

// ─── ENV ─────────────────────────────────────────────────────────────────────

function env(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

function envInt(key: string, fallback: number): number {
  const v = parseInt(process.env[key] ?? '', 10);
  return Number.isNaN(v) ? fallback : v;
}

const SENDER_EMAIL = env('BREVO_SENDER_EMAIL', 'noreply@eurotrips.ua');
const SENDER_NAME  = env('BREVO_SENDER_NAME',  'Eurotrips');
const APP_URL      = env('APP_FRONTEND_URL',   'https://eurotrips.ua');

/**
 * Template IDs з Brevo Dashboard (Settings → Templates).
 * Встановлюються в .env — можна змінити без перекомпіляції.
 *
 * Brevo → Templates → Create → "Transactional" → скопіювати ID
 */
const TMPL = {
  BOOKING_CONFIRMATION: envInt('BREVO_TMPL_BOOKING_CONFIRM',   1),
  PAYMENT_REMINDER:     envInt('BREVO_TMPL_PAYMENT_REMINDER',  2),
  PRE_DEPARTURE:        envInt('BREVO_TMPL_PRE_DEPARTURE',     3),
  PAYMENT_RECEIVED:     envInt('BREVO_TMPL_PAYMENT_RECEIVED',  4),
  CANCELLATION:         envInt('BREVO_TMPL_CANCELLATION',      5),
  AGENT_NEW_BOOKING:    envInt('BREVO_TMPL_AGENT_BOOKING',     6),
} as const;

// =============================================================================

export class EmailService {
  private readonly client: Brevo.TransactionalEmailsApi;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: FastifyBaseLogger,
  ) {
    const apiInstance = new Brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      Brevo.TransactionalEmailsApiApiKeys.apiKey,
      env('BREVO_API_KEY'),
    );
    this.client = apiInstance;
  }

  // ─── Публічні методи ───────────────────────────────────────────────────────

  /**
   * Підтвердження бронювання.
   *
   * Тригер: booking.status → 'confirmed'
   * Шаблон: BREVO_TMPL_BOOKING_CONFIRM
   *
   * Змінні шаблону: {{ params.tourist_name }}, {{ params.booking_number }},
   *   {{ params.tour_name }}, {{ params.departure_date }}, {{ params.total_price }},
   *   {{ params.deposit_amount }}, {{ params.balance_due }}, {{ params.payment_link }}
   */
  async sendBookingConfirmation(
    booking: BookingEmailContext,
    tourist: TouristEmailContext,
  ): Promise<void> {
    await this.safeSend({
      templateId: TMPL.BOOKING_CONFIRMATION,
      to: [{ email: tourist.email, name: tourist.fullName }],
      params: {
        tourist_name:      tourist.firstName,
        booking_number:    booking.bookingNumber,
        tour_name:         booking.tourName,
        tour_code:         booking.tourCode,
        departure_date:    booking.formattedDepartureDate,
        pax_count:         booking.paxCount,
        total_price:       booking.formattedTotalPrice,
        deposit_amount:    booking.formattedDepositAmount,
        balance_due:       booking.formattedBalanceDue,
        payment_deadline:  booking.formattedPaymentDeadline,
        departure_city:    booking.departureCitiy,
        included:          booking.included ?? '',
        payment_link:      `${APP_URL}/bookings/${booking.id}/pay`,
        booking_link:      `${APP_URL}/bookings/${booking.id}`,
      },
      bookingId:  booking.id,
      eventName: 'booking_confirmation',
    });
  }

  /**
   * Нагадування про доплату.
   *
   * Тригер: BullMQ scheduler (PaymentReminderWorker) — за 7, 3 та 1 день до дедлайну.
   * Шаблон: BREVO_TMPL_PAYMENT_REMINDER
   *
   * @param booking   Контекст бронювання
   * @param daysLeft  Скільки днів до дедлайну (7 | 3 | 1)
   */
  async sendPaymentReminder(
    booking: BookingEmailContext,
    daysLeft: number,
  ): Promise<void> {
    if (!booking.touristEmail) {
      this.logger.warn({ bookingId: booking.id }, 'sendPaymentReminder: email туриста відсутній — пропускаємо');
      return;
    }

    const urgency = daysLeft <= 1 ? 'urgent' : daysLeft <= 3 ? 'high' : 'normal';

    await this.safeSend({
      templateId: TMPL.PAYMENT_REMINDER,
      to: [{ email: booking.touristEmail, name: booking.touristFullName }],
      params: {
        tourist_name:      booking.touristFirstName,
        booking_number:    booking.bookingNumber,
        tour_name:         booking.tourName,
        departure_date:    booking.formattedDepartureDate,
        balance_due:       booking.formattedBalanceDue,
        payment_deadline:  booking.formattedPaymentDeadline,
        days_left:         daysLeft,
        urgency,
        // Прапорці для умовного рендерингу в Brevo шаблоні
        is_urgent: daysLeft <= 1,
        is_high:   daysLeft === 3,
        payment_link: `${APP_URL}/bookings/${booking.id}/pay`,
        support_email: 'info@eurotrips.ua',
      },
      bookingId:  booking.id,
      eventName: `payment_reminder_${daysLeft}d`,
    });
  }

  /**
   * Інформація перед виїздом (інфолист).
   *
   * Тригер:
   *   - booking.status → 'ready_to_depart'
   *   - АБО BullMQ scheduler за 3 дні до departure_date
   *
   * Шаблон: BREVO_TMPL_PRE_DEPARTURE
   * Містить посилання на PDF-інфолист та деталі збору.
   *
   * @param booking      Контекст бронювання
   * @param infolistUrl  URL PDF-інфолисту (з Documents service)
   */
  async sendPreDepartureInfo(
    booking: BookingEmailContext,
    infolistUrl: string,
  ): Promise<void> {
    if (!booking.touristEmail) {
      this.logger.warn({ bookingId: booking.id }, 'sendPreDepartureInfo: email туриста відсутній — пропускаємо');
      return;
    }

    await this.safeSend({
      templateId: TMPL.PRE_DEPARTURE,
      to: [{ email: booking.touristEmail, name: booking.touristFullName }],
      params: {
        tourist_name:    booking.touristFirstName,
        booking_number:  booking.bookingNumber,
        tour_name:       booking.tourName,
        tour_code:       booking.tourCode,
        departure_date:  booking.formattedDepartureDate,
        departure_time:  booking.departureTime ?? 'уточнюється',
        meeting_point:   booking.meetingPoint  ?? booking.departureCitiy,
        guide_name:      booking.guideName     ?? '',
        guide_phone:     booking.guidePhone    ?? '',
        infolist_url:    infolistUrl,
        download_link:   infolistUrl,
        booking_link:    `${APP_URL}/bookings/${booking.id}`,
      },
      bookingId:  booking.id,
      eventName: 'pre_departure_info',
    });
  }

  /**
   * Підтвердження отримання оплати.
   *
   * Тригер: POST /webhooks/liqpay → статус success (з LiqPayService)
   * Шаблон: BREVO_TMPL_PAYMENT_RECEIVED
   *
   * @param booking         Контекст бронювання (оновлений після платежу)
   * @param paymentAmount   Сума щойно отриманого платежу
   */
  async sendPaymentReceived(
    booking: BookingEmailContext,
    paymentAmount: number,
  ): Promise<void> {
    if (!booking.touristEmail) return;

    await this.safeSend({
      templateId: TMPL.PAYMENT_RECEIVED,
      to: [{ email: booking.touristEmail, name: booking.touristFullName }],
      params: {
        tourist_name:      booking.touristFirstName,
        booking_number:    booking.bookingNumber,
        tour_name:         booking.tourName,
        payment_amount:    formatCurrency(paymentAmount, booking.currency),
        amount_paid:       booking.formattedAmountPaid,
        balance_due:       booking.formattedBalanceDue,
        is_fully_paid:     booking.balanceDue <= 0,
        departure_date:    booking.formattedDepartureDate,
        booking_link:      `${APP_URL}/bookings/${booking.id}`,
      },
      bookingId:  booking.id,
      eventName: 'payment_received',
    });
  }

  /**
   * Повідомлення про скасування бронювання.
   *
   * Тригер:
   *   - booking.status → 'cancelled_client'
   *   - booking.status → 'cancelled_operator' (BR-08: включає автоматичне повернення)
   *
   * Шаблон: BREVO_TMPL_CANCELLATION
   *
   * @param booking       Контекст бронювання
   * @param cancelledBy   Ініціатор скасування
   * @param refundAmount  Сума до повернення (якщо є; може бути 0 через штраф)
   */
  async sendCancellationNotice(
    booking: BookingEmailContext,
    cancelledBy: 'client' | 'operator',
    refundAmount?: number,
  ): Promise<void> {
    if (!booking.touristEmail) return;

    const hasRefund    = typeof refundAmount === 'number' && refundAmount > 0;
    const cancelLabel  = cancelledBy === 'operator' ? 'туроператором' : 'клієнтом';

    await this.safeSend({
      templateId: TMPL.CANCELLATION,
      to: [{ email: booking.touristEmail, name: booking.touristFullName }],
      params: {
        tourist_name:         booking.touristFirstName,
        booking_number:       booking.bookingNumber,
        tour_name:            booking.tourName,
        cancelled_by:         cancelledBy,
        cancelled_by_label:   cancelLabel,
        has_refund:           hasRefund,
        refund_amount:        hasRefund ? formatCurrency(refundAmount!, booking.currency) : null,
        support_email:        'info@eurotrips.ua',
        support_phone:        env('SUPPORT_PHONE', '+38 XX XXX XXXX'),
      },
      bookingId:  booking.id,
      eventName: `cancellation_${cancelledBy}`,
    });
  }

  /**
   * Нотифікація агента про нове бронювання його клієнтом.
   *
   * Тригер: POST /api/v1/bookings (booking_type = 'agent')
   * Шаблон: BREVO_TMPL_AGENT_BOOKING
   *
   * @param agentEmail   Email агента
   * @param agentName    ПІБ або назва агентства
   * @param booking      Контекст бронювання
   */
  async sendAgentBookingNotification(
    agentEmail: string,
    agentName: string,
    booking: BookingEmailContext,
  ): Promise<void> {
    await this.safeSend({
      templateId: TMPL.AGENT_NEW_BOOKING,
      to: [{ email: agentEmail, name: agentName }],
      params: {
        agent_name:         agentName,
        booking_number:     booking.bookingNumber,
        tour_name:          booking.tourName,
        pax_count:          booking.paxCount,
        departure_date:     booking.formattedDepartureDate,
        total_price:        booking.formattedTotalPrice,
        booking_link:       `${APP_URL}/agent/bookings/${booking.id}`,
      },
      bookingId:  booking.id,
      eventName: 'agent_new_booking',
    });
  }

  // ─── Допоміжні методи ──────────────────────────────────────────────────────

  /**
   * Будує BookingEmailContext з Prisma Booking + пов'язаних сутностей.
   * Зручний factory-метод для використання в обробниках.
   */
  static buildBookingContext(booking: {
    id: string;
    bookingNumber: string;
    paxCount: number;
    totalPrice: { toNumber(): number };
    amountPaid: { toNumber(): number };
    balanceDue: { toNumber(): number };
    depositAmount: { toNumber(): number };
    currency: string;
    paymentDeadline: Date | null;
    status: string;
    tour: {
      name: string;
      code: string;
      departureDate: Date;
      departureCity: string;
      meetingPoint?: string | null;
      departureTime?: string | null;
      includedServices?: string | null;
    };
    tourist?: {
      email?: string | null;
      firstName: string;
      lastName: string;
      phone?: string | null;
    } | null;
    guide?: { fullName?: string | null; phone?: string | null } | null;
  }): BookingEmailContext {
    const totalPrice    = booking.totalPrice.toNumber();
    const amountPaid    = booking.amountPaid.toNumber();
    const balanceDue    = booking.balanceDue.toNumber();
    const depositAmount = booking.depositAmount.toNumber();
    const currency      = booking.currency;

    return {
      id:             booking.id,
      bookingNumber:  booking.bookingNumber,
      tourName:       booking.tour.name,
      tourCode:       booking.tour.code,
      paxCount:       booking.paxCount,
      totalPrice,
      amountPaid,
      balanceDue,
      depositAmount,
      currency,

      formattedTotalPrice:      formatCurrency(totalPrice, currency),
      formattedAmountPaid:      formatCurrency(amountPaid, currency),
      formattedBalanceDue:      formatCurrency(balanceDue, currency),
      formattedDepositAmount:   formatCurrency(depositAmount, currency),

      departureDate:            booking.tour.departureDate,
      formattedDepartureDate:   formatDate(booking.tour.departureDate),
      formattedPaymentDeadline: booking.paymentDeadline
        ? formatDate(booking.paymentDeadline)
        : 'не вказано',

      departureCitiy: booking.tour.departureCity,
      meetingPoint:   booking.tour.meetingPoint ?? undefined,
      departureTime:  booking.tour.departureTime ?? undefined,
      included:       booking.tour.includedServices ?? undefined,
      guideName:      booking.guide?.fullName ?? undefined,
      guidePhone:     booking.guide?.phone ?? undefined,

      touristEmail:     booking.tourist?.email ?? undefined,
      touristFullName:  booking.tourist
        ? `${booking.tourist.firstName} ${booking.tourist.lastName}`.trim()
        : undefined,
      touristFirstName: booking.tourist?.firstName,
    };
  }

  // ─── Приватна відправка ─────────────────────────────────────────────────────

  /**
   * Відправляє email через Brevo API.
   * Fire-and-forget: помилка логується, але не кидається вгору.
   * При помилці — задача ставиться у BullMQ retry queue (3 спроби, back-off 5хв).
   */
  private async safeSend(params: EmailSendParams): Promise<void> {
    const { templateId, to, params: templateParams, bookingId, eventName } = params;

    try {
      const email = new Brevo.SendSmtpEmail();
      email.templateId = templateId;
      email.to         = to;
      email.sender     = { email: SENDER_EMAIL, name: SENDER_NAME };
      email.params     = templateParams;

      const result    = await this.client.sendTransacEmail(email);
      const messageId = (result.body as { messageId?: string })?.messageId ?? 'unknown';

      this.logger.info(
        { eventName, bookingId, to: to.map((r: EmailRecipient) => r.email), messageId },
        `Email відправлено: ${eventName}`,
      );

      // Логуємо в таблицю communications
      if (bookingId) {
        await this.logCommunication({
          bookingId,
          eventName,
          recipientEmail: to[0].email,
          messageId,
        });
      }

    } catch (err: unknown) {
      const error = err as { message?: string; statusCode?: number };
      this.logger.error(
        { err: error, eventName, bookingId, templateId, to },
        `Помилка відправки email: ${eventName}`,
      );
      // Не re-throw — email не зупиняє основну логіку
    }
  }

  /**
   * Зберігає запис про відправлений email у таблиці communications.
   * Дозволяє менеджерам бачити всю email-активність по бронюванню.
   */
  private async logCommunication(params: {
    bookingId:      string;
    eventName:      string;
    recipientEmail: string;
    messageId:      string;
  }): Promise<void> {
    try {
      await this.prisma.communication.create({
        data: {
          bookingId:          params.bookingId,
          channel:            'email',
          direction:          'outbound',
          subject:            params.eventName,
          body:               `Brevo messageId: ${params.messageId}`,
          recipientEmail:     params.recipientEmail,
          status:             'sent',
          externalMessageId:  params.messageId,
          sentAt:             new Date(),
        },
      });
    } catch (dbErr) {
      // Помилка логування не повинна впливати на відправку
      this.logger.warn({ dbErr }, 'Не вдалося записати communication лог');
    }
  }
}

// ─── Утиліти форматування ────────────────────────────────────────────────────

/**
 * Форматує суму у людиночитабельний вигляд українською.
 * @example formatCurrency(1680, 'EUR') → "1 680,00 EUR"
 */
function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('uk-UA', {
    style:                 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Форматує дату українською (довга форма).
 * @example formatDate(new Date('2025-10-25')) → "25 жовтня 2025 р."
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day:   'numeric',
    month: 'long',
    year:  'numeric',
  }).format(date);
}
