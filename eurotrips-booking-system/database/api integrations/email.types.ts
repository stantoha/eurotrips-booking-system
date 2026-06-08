// =============================================================
// EUROTRIPS — Email Service Types
// Транспорт: Brevo (колишній Sendinblue)
// SDK: @getbrevo/brevo
// =============================================================

// ─── Контекст бронювання для email-шаблонів ──────────────────

/**
 * Дані бронювання, необхідні для всіх email-шаблонів.
 * Формується з Prisma Booking + Tour + Tourist у email.service.ts.
 */
export interface BookingEmailContext {
  id:                      string;
  bookingNumber:           string;   // ET-2026-00123
  tourName:                string;
  tourCode:                string;   // PN25102505
  paxCount:                number;

  // Фінанси
  totalPrice:              number;
  amountPaid:              number;
  balanceDue:              number;
  depositAmount:           number;
  currency:                string;   // EUR

  // Відформатовані рядки (для вставки в шаблон)
  formattedTotalPrice:     string;   // "1 680,00 EUR"
  formattedAmountPaid:     string;
  formattedBalanceDue:     string;
  formattedDepositAmount:  string;

  // Дати
  departureDate:           Date;
  formattedDepartureDate:  string;   // "25 жовтня 2025"
  formattedPaymentDeadline: string;

  // Місце збору
  departureCitiy:          string;
  meetingPoint?:           string;   // "Автостанція Центральна, платформа 3"
  departureTime?:          string;   // "06:30"

  // Тур
  included?:               string;   // "Транспорт, готель 3*, сніданки"
  guideName?:              string;
  guidePhone?:             string;

  // Контакт туриста (може бути відсутній при агентських бронюваннях)
  touristEmail?:           string;
  touristFullName?:        string;
  touristFirstName?:       string;
}

/**
 * Дані туриста для email.
 */
export interface TouristEmailContext {
  id:        string;
  email:     string;
  fullName:  string;
  firstName: string;
  phone?:    string;
}

// ─── Внутрішній тип для відправки ────────────────────────────

export interface EmailRecipient {
  email: string;
  name?: string;
}

/**
 * Параметри внутрішнього методу send().
 */
export interface EmailSendParams {
  templateId:  number;
  to:          EmailRecipient[];
  params:      Record<string, unknown>;
  bookingId?:  string;    // для логування в communications
  eventName:   string;    // назва тригера, напр. 'booking_confirmation'
}

// ─── Template IDs (Brevo Dashboard → Templates) ──────────────

/**
 * Ідентифікатори шаблонів у Brevo.
 * Зберігаються в .env — змінюються без перекомпіляції.
 */
export interface BrevoTemplateIds {
  BOOKING_CONFIRMATION:  number;  // BREVO_TMPL_BOOKING_CONFIRM
  PAYMENT_REMINDER:      number;  // BREVO_TMPL_PAYMENT_REMINDER
  PRE_DEPARTURE:         number;  // BREVO_TMPL_PRE_DEPARTURE
  PAYMENT_RECEIVED:      number;  // BREVO_TMPL_PAYMENT_RECEIVED
  CANCELLATION:          number;  // BREVO_TMPL_CANCELLATION
  AGENT_NEW_BOOKING:     number;  // BREVO_TMPL_AGENT_BOOKING    (для агента)
  WEEKLY_REPORT:         number;  // BREVO_TMPL_WEEKLY_REPORT   (для директора)
}

// ─── Параметри шаблонів (документація для Brevo Editor) ──────

/**
 * Змінні шаблону "Підтвердження бронювання".
 * Використовуються в Brevo Template Editor як {{ params.tourist_name }}.
 */
export interface BookingConfirmationParams {
  tourist_name:        string;
  booking_number:      string;
  tour_name:           string;
  departure_date:      string;
  pax_count:           number;
  total_price:         string;
  deposit_amount:      string;
  balance_due:         string;
  payment_deadline:    string;
  departure_city:      string;
  included:            string;
  payment_link:        string;
}

/**
 * Змінні шаблону "Нагадування про оплату".
 */
export interface PaymentReminderParams {
  tourist_name:        string;
  booking_number:      string;
  tour_name:           string;
  departure_date:      string;
  balance_due:         string;
  payment_deadline:    string;
  days_left:           number;
  urgency:             'normal' | 'high' | 'urgent';
  payment_link:        string;
}

/**
 * Змінні шаблону "Інформація перед виїздом".
 */
export interface PreDepartureParams {
  tourist_name:        string;
  booking_number:      string;
  tour_name:           string;
  departure_date:      string;
  departure_time:      string;
  meeting_point:       string;
  guide_name:          string;
  guide_phone:         string;
  infolist_url:        string;
  download_link:       string;
}
