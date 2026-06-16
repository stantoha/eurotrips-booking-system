// =============================================================
// EUROTRIPS — Email Service (Brevo + BullMQ) v2.0
// Сигнатури:
//   sendBookingConfirmation(bookingId: string): Promise<void>
//   sendPaymentReminder(bookingId: string, daysLeft: number): Promise<void>
//   sendPreDepartureInfo(bookingId: string): Promise<void>
//
// Транспорт: Brevo API (@getbrevo/brevo)
// Шаблони: inline HTML (email.templates.ts) — незалежно від Brevo Dashboard
// Тригер: BullMQ Worker (email.worker.ts) після зміни booking.status
// =============================================================

import * as Brevo from '@getbrevo/brevo';
import type { FastifyBaseLogger } from 'fastify';
import type { PrismaClient }     from '@prisma/client';
import {
  bookingConfirmationHtml,
  bookingConfirmationSubject,
  paymentReminderHtml,
  paymentReminderSubject,
  preDepartureHtml,
  preDepartureSubject,
} from './templates/email.templates';

// ─── ENV ─────────────────────────────────────────────────────

const BREVO_API_KEY  = process.env.BREVO_API_KEY  ?? '';
const SENDER_EMAIL   = process.env.BREVO_SENDER_EMAIL ?? 'noreply@eurotrips.ua';
const SENDER_NAME    = process.env.BREVO_SENDER_NAME  ?? 'Eurotrips';
const APP_URL        = process.env.APP_FRONTEND_URL   ?? 'https://eurotrips.ua';

// ─── Prisma include ───────────────────────────────────────────

const BOOKING_INCLUDE = {
  tour: {
    select: {
      name:             true,
      code:             true,
      departureDate:    true,
      departureCity:    true,
      meetingPoint:     true,
      departureTime:    true,
      includedServices: true,
    },
  },
  tourist: {
    select: {
      id:        true,
      firstName: true,
      lastName:  true,
      email:     true,
      phone:     true,
    },
  },
  guide: {
    select: {
      fullName: true,
      phone:    true,
    },
  },
} as const;

// =============================================================================

export class EmailService {
  private readonly brevo: Brevo.TransactionalEmailsApi;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: FastifyBaseLogger,
  ) {
    if (!BREVO_API_KEY) {
      this.logger.warn('BREVO_API_KEY не налаштований — email відправлятись не будуть');
    }
    const api = new Brevo.TransactionalEmailsApi();
    api.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, BREVO_API_KEY);
    this.brevo = api;
  }

  // ═══════════════════════════════════════════════════════════
  //  Три публічні методи (завдання #8 v2)
  // ═══════════════════════════════════════════════════════════

  /**
   * Підтвердження бронювання.
   *
   * Тригер: booking.status → 'confirmed'
   * Flow: bookings.service → emailQueue.add('booking:confirmed') →
   *       email.worker → emailService.sendBookingConfirmation(bookingId)
   */
  async sendBookingConfirmation(bookingId: string): Promise<void> {
    const booking = await this.loadBooking(bookingId);
    if (!booking) return;

    const email = booking.tourist?.email;
    if (!email) {
      this.logger.warn({ bookingId }, 'sendBookingConfirmation: email туриста відсутній');
      return;
    }

    const tourist      = booking.tourist!;
    const currency     = (booking as any).currency ?? 'EUR';
    const depositAmt   = (booking as any).depositAmount?.toNumber?.() ?? 0;
    const balanceDue   = booking.balanceDue.toNumber();
    const totalPrice   = booking.totalPrice.toNumber();
    const deadline     = (booking as any).paymentDeadline;

    const html = bookingConfirmationHtml({
      touristFirstName:         tourist.firstName,
      bookingNumber:            (booking as any).bookingNumber,
      tourName:                 booking.tour.name,
      tourCode:                 booking.tour.code,
      departureCitiy:           booking.tour.departureCity,
      formattedDepartureDate:   formatDate(booking.tour.departureDate),
      paxCount:                 booking.paxCount,
      formattedTotalPrice:      formatCurrency(totalPrice, currency),
      formattedDepositAmount:   formatCurrency(depositAmt, currency),
      formattedBalanceDue:      formatCurrency(balanceDue, currency),
      formattedPaymentDeadline: deadline ? formatDate(deadline) : 'не вказано',
      included:   booking.tour.includedServices ?? 'уточнюється',
      paymentLink: `${APP_URL}/bookings/${bookingId}/pay`,
      bookingLink: `${APP_URL}/bookings/${bookingId}`,
    });

    await this.send({
      to:        [{ email, name: `${tourist.firstName} ${tourist.lastName}`.trim() }],
      subject:   bookingConfirmationSubject((booking as any).bookingNumber, booking.tour.name),
      html,
      bookingId,
      eventName: 'booking_confirmation',
    });
  }

  // ───────────────────────────────────────────────────────────

  /**
   * Нагадування про доплату.
   *
   * Тригер: BullMQ scheduler (schedulePaymentReminders) — за 7/3/1 день до дедлайну
   * Guard: пропускає якщо balanceDue <= 0 або booking скасовано
   *
   * @param bookingId  UUID бронювання
   * @param daysLeft   7 | 3 | 1
   */
  async sendPaymentReminder(bookingId: string, daysLeft: number): Promise<void> {
    const booking = await this.loadBooking(bookingId);
    if (!booking) return;

    const balanceDue = booking.balanceDue.toNumber();

    if (balanceDue <= 0) {
      this.logger.info({ bookingId }, 'sendPaymentReminder: вже сплачено — пропускаємо');
      return;
    }

    if (['cancelled_client', 'cancelled_operator', 'no_show', 'refund'].includes(booking.status)) {
      this.logger.info({ bookingId, status: booking.status }, 'sendPaymentReminder: скасовано — пропускаємо');
      return;
    }

    const email = booking.tourist?.email;
    if (!email) {
      this.logger.warn({ bookingId }, 'sendPaymentReminder: email туриста відсутній');
      return;
    }

    const tourist  = booking.tourist!;
    const currency = (booking as any).currency ?? 'EUR';
    const deadline = (booking as any).paymentDeadline;

    const html = paymentReminderHtml({
      touristFirstName:         tourist.firstName,
      bookingNumber:            (booking as any).bookingNumber,
      tourName:                 booking.tour.name,
      formattedDepartureDate:   formatDate(booking.tour.departureDate),
      formattedBalanceDue:      formatCurrency(balanceDue, currency),
      formattedPaymentDeadline: deadline ? formatDate(deadline) : 'не вказано',
      daysLeft,
      paymentLink: `${APP_URL}/bookings/${bookingId}/pay`,
    });

    await this.send({
      to:        [{ email, name: `${tourist.firstName} ${tourist.lastName}`.trim() }],
      subject:   paymentReminderSubject(daysLeft, booking.tour.name, formatCurrency(balanceDue, currency)),
      html,
      bookingId,
      eventName: `payment_reminder_${daysLeft}d`,
    });
  }

  // ───────────────────────────────────────────────────────────

  /**
   * Інформація перед виїздом (інфолист).
   *
   * Тригер: BullMQ scheduler (schedulePreDepartureEmail) — за 3 дні до departure_date
   * Guard: пропускає якщо booking скасовано
   *
   * @param bookingId  UUID бронювання
   */
  async sendPreDepartureInfo(bookingId: string): Promise<void> {
    const booking = await this.loadBooking(bookingId);
    if (!booking) return;

    if (['cancelled_client', 'cancelled_operator', 'no_show'].includes(booking.status)) {
      this.logger.info({ bookingId, status: booking.status }, 'sendPreDepartureInfo: скасовано — пропускаємо');
      return;
    }

    const email = booking.tourist?.email;
    if (!email) {
      this.logger.warn({ bookingId }, 'sendPreDepartureInfo: email туриста відсутній');
      return;
    }

    const tourist     = booking.tourist!;
    const infolistUrl = await this.findInfolistUrl(bookingId);

    const html = preDepartureHtml({
      touristFirstName:       tourist.firstName,
      bookingNumber:          (booking as any).bookingNumber,
      tourName:               booking.tour.name,
      tourCode:               booking.tour.code,
      formattedDepartureDate: formatDate(booking.tour.departureDate),
      departureTime:          booking.tour.departureTime  ?? 'уточнюється',
      meetingPoint:           booking.tour.meetingPoint   ?? booking.tour.departureCity,
      guideName:              booking.guide?.fullName     ?? '',
      guidePhone:             booking.guide?.phone        ?? '',
      infolistUrl,
      bookingLink:            `${APP_URL}/bookings/${bookingId}`,
    });

    await this.send({
      to:        [{ email, name: `${tourist.firstName} ${tourist.lastName}`.trim() }],
      subject:   preDepartureSubject(booking.tour.name, formatDate(booking.tour.departureDate)),
      html,
      bookingId,
      eventName: 'pre_departure_info',
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  Приватні методи
  // ═══════════════════════════════════════════════════════════

  private async loadBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where:   { id: bookingId },
      include: BOOKING_INCLUDE,
    });
    if (!booking) {
      this.logger.error({ bookingId }, 'EmailService.loadBooking: не знайдено');
    }
    return booking;
  }

  /** Шукає PDF інфолист, fallback — URL сторінки бронювання */
  private async findInfolistUrl(bookingId: string): Promise<string> {
    try {
      const doc = await (this.prisma as any).document?.findFirst?.({
        where: { bookingId, type: { in: ['infolist', 'tourist_info', 'program'] } },
        orderBy: { createdAt: 'desc' },
        select:  { fileUrl: true },
      });
      if (doc?.fileUrl) return doc.fileUrl;
    } catch { /* документи ще не реалізовані */ }
    return `${APP_URL}/bookings/${bookingId}/documents`;
  }

  /**
   * Відправляє email через Brevo з inline HTML.
   *
   * Retry-логіка:
   *  - Brevo 4xx → логуємо, НЕ кидаємо (configuraton error, retry безглуздий)
   *  - Brevo 5xx або network → кидаємо, BullMQ Worker зробить retry (3x, back-off 5хв)
   */
  private async send(params: {
    to:        { email: string; name?: string }[];
    subject:   string;
    html:      string;
    bookingId: string;
    eventName: string;
  }): Promise<void> {
    const { to, subject, html, bookingId, eventName } = params;

    if (!BREVO_API_KEY) {
      this.logger.warn({ eventName, bookingId }, 'BREVO_API_KEY не встановлено — пропускаємо');
      return;
    }

    try {
      const msg       = new Brevo.SendSmtpEmail();
      msg.sender      = { email: SENDER_EMAIL, name: SENDER_NAME };
      msg.to          = to;
      msg.subject     = subject;
      msg.htmlContent = html;
      msg.replyTo     = { email: 'info@eurotrips.ua', name: SENDER_NAME };
      (msg as any).headers = {
        'X-Booking-Id': bookingId,
        'X-Event-Name': eventName,
      };

      const result    = await this.brevo.sendTransacEmail(msg);
      const messageId = (result.body as { messageId?: string })?.messageId ?? 'n/a';

      this.logger.info(
        { eventName, bookingId, to: to.map((r) => r.email), messageId },
        `✉️  Email відправлено: ${eventName}`,
      );

      await this.logCommunication({ bookingId, eventName, recipient: to[0].email, subject, messageId });

    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number };

      if (e.statusCode && e.statusCode >= 400 && e.statusCode < 500) {
        this.logger.error(
          { err: e.message, statusCode: e.statusCode, eventName, bookingId },
          `❌ Brevo ${e.statusCode} — перевірте налаштування API`,
        );
        return;  // не кидаємо — безглузді ретраї
      }

      // 5xx / network → кидаємо для BullMQ retry
      this.logger.error({ err: e.message, eventName, bookingId }, `❌ Brevo error — буде retry`);
      throw err;
    }
  }

  private async logCommunication(p: {
    bookingId: string; eventName: string;
    recipient: string; subject: string; messageId: string;
  }): Promise<void> {
    try {
      await this.prisma.communication.create({
        data: {
          bookingId:         p.bookingId,
          channel:           'email',
          direction:         'outbound',
          subject:           p.subject,
          body:              `${p.eventName} | Brevo messageId: ${p.messageId}`,
          recipientEmail:    p.recipient,
          status:            'sent',
          externalMessageId: p.messageId,
          sentAt:            new Date(),
        },
      });
    } catch (dbErr) {
      this.logger.warn({ dbErr }, 'Не вдалося записати communication лог');
    }
  }
}

// ─── Утиліти ─────────────────────────────────────────────────

export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency', currency, minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(date);
}
