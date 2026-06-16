// =============================================================
// EUROTRIPS — HTML Email Templates
// Мова: українська
// Брендинг: navy #1B4F9C, gold #F5A623
// Сумісність: Gmail, Apple Mail, Outlook 2016+, мобільні
// =============================================================

// ─── Кольори бренду ──────────────────────────────────────────

const BRAND = {
  navy:       '#1B4F9C',
  navyDark:   '#163D78',
  gold:       '#F5A623',
  goldDark:   '#D4891A',
  white:      '#FFFFFF',
  offWhite:   '#F8F9FA',
  gray:       '#6C757D',
  grayLight:  '#DEE2E6',
  textDark:   '#212529',
  textMuted:  '#6C757D',
  success:    '#1A6B3C',
  successBg:  '#D4EDDA',
  warning:    '#856404',
  warningBg:  '#FFF3CD',
  danger:     '#721C24',
  dangerBg:   '#F8D7DA',
} as const;

// ─── Загальний layout ─────────────────────────────────────────

function layout(content: string, previewText = ''): string {
  return `<!DOCTYPE html>
<html lang="uk" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Eurotrips</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: ${BRAND.offWhite}; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .fluid { width: 100% !important; max-width: 100% !important; }
      .stack-column { display: block !important; width: 100% !important; max-width: 100% !important; }
      .btn-full { width: 100% !important; text-align: center !important; }
      .hide-mobile { display: none !important; }
      .pad-mobile { padding: 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.offWhite};">
${previewText ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${BRAND.offWhite};">${previewText}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌</div>` : ''}
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${BRAND.offWhite};">
  <tr><td align="center" style="padding:24px 16px;">
    <table class="email-container" role="presentation" cellspacing="0" cellpadding="0" border="0"
           width="580" style="max-width:580px;background-color:${BRAND.white};border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

      ${header()}
      ${content}
      ${footer()}

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ─── Шапка ───────────────────────────────────────────────────

function header(): string {
  return `
      <!-- HEADER -->
      <tr>
        <td style="background-color:${BRAND.navy};padding:28px 32px;text-align:center;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td align="center">
                <!-- Логотип (текстовий) -->
                <a href="https://eurotrips.ua" target="_blank" style="text-decoration:none;">
                  <span style="font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:700;
                               color:${BRAND.white};letter-spacing:2px;">EURO</span><span
                        style="font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:700;
                               color:${BRAND.gold};letter-spacing:2px;">TRIPS</span>
                </a>
                <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:rgba(255,255,255,0.7);
                           margin:4px 0 0 0;letter-spacing:1px;">ТУРИСТИЧНА КОМПАНІЯ</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
}

// ─── Підвал ───────────────────────────────────────────────────

function footer(): string {
  return `
      <!-- FOOTER -->
      <tr>
        <td style="background-color:${BRAND.navyDark};padding:28px 32px;text-align:center;">
          <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:rgba(255,255,255,0.8);
                    margin:0 0 8px 0;">
            Залишились питання? Пишіть нам:
            <a href="mailto:info@eurotrips.ua"
               style="color:${BRAND.gold};text-decoration:none;font-weight:600;">info@eurotrips.ua</a>
          </p>
          <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:rgba(255,255,255,0.8);
                    margin:0 0 16px 0;">
            Або телефонуйте:
            <a href="tel:+380XXXXXXXXX"
               style="color:${BRAND.gold};text-decoration:none;">+38 (0XX) XXX-XX-XX</a>
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
            <tr>
              <td style="padding:0 8px;">
                <a href="https://www.instagram.com/eurotrips.ua" target="_blank"
                   style="font-family:Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.6);text-decoration:none;">Instagram</a>
              </td>
              <td style="color:rgba(255,255,255,0.3);font-size:12px;">|</td>
              <td style="padding:0 8px;">
                <a href="https://www.facebook.com/eurotrips.ua" target="_blank"
                   style="font-family:Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.6);text-decoration:none;">Facebook</a>
              </td>
              <td style="color:rgba(255,255,255,0.3);font-size:12px;">|</td>
              <td style="padding:0 8px;">
                <a href="https://t.me/eurotrips_ua" target="_blank"
                   style="font-family:Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.6);text-decoration:none;">Telegram</a>
              </td>
            </tr>
          </table>
          <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:rgba(255,255,255,0.4);
                    margin:16px 0 0 0;">
            © ${new Date().getFullYear()} Eurotrips. Всі права захищено.<br/>
            Ви отримали цей лист, оскільки маєте активне бронювання.
          </p>
        </td>
      </tr>`;
}

// ─── Компоненти ───────────────────────────────────────────────

function btn(text: string, url: string, color = BRAND.gold): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">
    <tr>
      <td style="border-radius:6px;background-color:${color};">
        <a href="${url}" target="_blank"
           style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;
                  color:${BRAND.white};text-decoration:none;padding:14px 32px;
                  display:inline-block;border-radius:6px;letter-spacing:0.5px;">${text}</a>
      </td>
    </tr>
  </table>`;
}

function infoRow(label: string, value: string, highlight = false): string {
  return `<tr>
    <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND.textMuted};
               padding:8px 0;border-bottom:1px solid ${BRAND.grayLight};width:45%;">${label}</td>
    <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;
               color:${highlight ? BRAND.navy : BRAND.textDark};
               font-weight:${highlight ? '700' : '400'};
               padding:8px 0 8px 12px;border-bottom:1px solid ${BRAND.grayLight};">${value}</td>
  </tr>`;
}

function alertBox(text: string, type: 'success' | 'warning' | 'danger' | 'info' = 'info'): string {
  const colors = {
    success: { bg: BRAND.successBg, border: BRAND.success, text: BRAND.success },
    warning: { bg: BRAND.warningBg, border: BRAND.warning, text: BRAND.warning },
    danger:  { bg: BRAND.dangerBg,  border: BRAND.danger,  text: BRAND.danger  },
    info:    { bg: '#D1ECF1',       border: '#0C5460',     text: '#0C5460'     },
  }[type];
  return `<tr><td style="padding:0 32px 20px 32px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="background-color:${colors.bg};border-left:4px solid ${colors.border};
                   border-radius:4px;padding:14px 16px;">
          <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;
                    color:${colors.text};margin:0;">${text}</p>
        </td>
      </tr>
    </table>
  </td></tr>`;
}

// ─── Параметри шаблонів ───────────────────────────────────────

export interface BookingConfirmationData {
  touristFirstName:      string;
  bookingNumber:         string;
  tourName:              string;
  tourCode:              string;
  departureCitiy:        string;
  formattedDepartureDate: string;
  paxCount:              number;
  formattedTotalPrice:   string;
  formattedDepositAmount: string;
  formattedBalanceDue:   string;
  formattedPaymentDeadline: string;
  included:              string;
  paymentLink:           string;
  bookingLink:           string;
}

export interface PaymentReminderData {
  touristFirstName:        string;
  bookingNumber:           string;
  tourName:                string;
  formattedDepartureDate:  string;
  formattedBalanceDue:     string;
  formattedPaymentDeadline: string;
  daysLeft:                number;
  paymentLink:             string;
}

export interface PreDepartureData {
  touristFirstName:       string;
  bookingNumber:          string;
  tourName:               string;
  tourCode:               string;
  formattedDepartureDate: string;
  departureTime:          string;
  meetingPoint:           string;
  guideName:              string;
  guidePhone:             string;
  infolistUrl:            string;
  bookingLink:            string;
}

// ─── Шаблони ─────────────────────────────────────────────────

/**
 * Підтвердження бронювання.
 * Тригер: booking.status → 'confirmed'
 */
export function bookingConfirmationHtml(d: BookingConfirmationData): string {
  const content = `
      <!-- HERO -->
      <tr>
        <td style="background:linear-gradient(135deg,${BRAND.navy} 0%,${BRAND.navyDark} 100%);
                   padding:32px;text-align:center;">
          <p style="font-family:Arial,Helvetica,sans-serif;font-size:40px;margin:0 0 8px 0;">✈️</p>
          <h1 style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;
                     color:${BRAND.white};margin:0 0 6px 0;">Бронювання підтверджено!</h1>
          <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;
                    color:rgba(255,255,255,0.8);margin:0;">
            Вітаємо, ${d.touristFirstName}! Ваша подорож вже чекає 🎉
          </p>
        </td>
      </tr>

      <!-- BOOKING NUMBER BADGE -->
      <tr>
        <td style="padding:24px 32px 0;text-align:center;">
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;
                       color:${BRAND.navy};background:${BRAND.offWhite};border:2px solid ${BRAND.navy};
                       border-radius:20px;padding:6px 20px;letter-spacing:1px;">
            БРОНЮВАННЯ № ${d.bookingNumber}
          </span>
        </td>
      </tr>

      <!-- TOUR INFO TABLE -->
      <tr>
        <td style="padding:24px 32px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            ${infoRow('Тур', d.tourName, true)}
            ${infoRow('Код туру', d.tourCode)}
            ${infoRow('Місто відправлення', d.departureCitiy)}
            ${infoRow('Дата виїзду', d.formattedDepartureDate, true)}
            ${infoRow('Кількість осіб', `${d.paxCount} ос.`)}
            ${infoRow('Вартість туру', d.formattedTotalPrice, true)}
            ${infoRow('Включено', d.included || 'Транспорт, проживання')}
          </table>
        </td>
      </tr>

      <!-- PAYMENT BLOCK -->
      <tr>
        <td style="padding:0 32px 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                 style="background:${BRAND.offWhite};border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:${BRAND.navy};padding:12px 20px;">
                <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;
                           color:${BRAND.white};margin:0;letter-spacing:0.5px;">💳 ОПЛАТА</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};padding:4px 0;">Передоплата:</td>
                    <td style="font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:${BRAND.success};text-align:right;padding:4px 0;">${d.formattedDepositAmount}</td>
                  </tr>
                  <tr>
                    <td style="font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};padding:4px 0;border-top:1px solid ${BRAND.grayLight};">Залишок до сплати:</td>
                    <td style="font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:${BRAND.navy};text-align:right;padding:4px 0;border-top:1px solid ${BRAND.grayLight};">${d.formattedBalanceDue}</td>
                  </tr>
                  <tr>
                    <td style="font-family:Arial,sans-serif;font-size:12px;color:${BRAND.textMuted};padding:6px 0 0;">Дедлайн оплати:</td>
                    <td style="font-family:Arial,sans-serif;font-size:12px;font-weight:600;color:${BRAND.warning};text-align:right;padding:6px 0 0;">до ${d.formattedPaymentDeadline}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td style="padding:0 32px 32px;text-align:center;">
          ${btn('💳 Сплатити зараз', d.paymentLink)}
          <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};">
            <a href="${d.bookingLink}" style="color:${BRAND.navy};text-decoration:none;">
              Переглянути деталі бронювання →
            </a>
          </p>
        </td>
      </tr>`;

  return layout(content, `Бронювання ${d.bookingNumber} підтверджено — ${d.tourName}`);
}

export function bookingConfirmationSubject(bookingNumber: string, tourName: string): string {
  return `✅ Бронювання ${bookingNumber} підтверджено — ${tourName}`;
}

// ─────────────────────────────────────────────────────────────

/**
 * Нагадування про оплату.
 * Тригер: BullMQ scheduler — за 7, 3, 1 день до дедлайну
 */
export function paymentReminderHtml(d: PaymentReminderData): string {
  const isUrgent  = d.daysLeft <= 1;
  const isHigh    = d.daysLeft === 3;

  const alertType  = isUrgent ? 'danger' : isHigh ? 'warning' : 'info';
  const alertEmoji = isUrgent ? '🚨' : isHigh ? '⚠️' : '🔔';
  const alertMsg   = isUrgent
    ? `${alertEmoji} <strong>Залишився 1 день!</strong> Термінова оплата для підтвердження місця в турі.`
    : isHigh
    ? `${alertEmoji} До дедлайну залишилося <strong>${d.daysLeft} дні</strong>. Будь ласка, не зволікайте.`
    : `${alertEmoji} Нагадуємо про необхідність сплатити залишок — до дедлайну <strong>${d.daysLeft} днів</strong>.`;

  const content = `
      <!-- HERO -->
      <tr>
        <td style="background-color:${isUrgent ? BRAND.dangerBg : BRAND.navy};
                   padding:28px 32px;text-align:center;
                   border-top:4px solid ${isUrgent ? BRAND.danger : BRAND.gold};">
          <h1 style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;
                     color:${isUrgent ? BRAND.danger : BRAND.white};margin:0 0 6px 0;">
            ${isUrgent ? '🚨 Терміновий нагадувач' : '🔔 Нагадування про оплату'}
          </h1>
          <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;
                    color:${isUrgent ? BRAND.textDark : 'rgba(255,255,255,0.85)'};margin:0;">
            ${d.touristFirstName}, для туру <strong>${d.tourName}</strong>
          </p>
        </td>
      </tr>

      <!-- ALERT -->
      ${alertBox(alertMsg, alertType)}

      <!-- AMOUNT BLOCK -->
      <tr>
        <td style="padding:0 32px 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                 style="background:${BRAND.offWhite};border-radius:8px;">
            <tr>
              <td style="padding:20px;text-align:center;">
                <p style="font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};margin:0 0 4px 0;">Сума до оплати</p>
                <p style="font-family:Arial,sans-serif;font-size:32px;font-weight:700;
                           color:${BRAND.navy};margin:0 0 8px 0;">${d.formattedBalanceDue}</p>
                <p style="font-family:Arial,sans-serif;font-size:13px;
                           color:${isUrgent ? BRAND.danger : BRAND.textMuted};
                           font-weight:${isUrgent ? '700' : '400'};margin:0;">
                  Дедлайн: ${d.formattedPaymentDeadline}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- INFO -->
      <tr>
        <td style="padding:0 32px 16px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            ${infoRow('Бронювання', d.bookingNumber)}
            ${infoRow('Тур', d.tourName)}
            ${infoRow('Дата виїзду', d.formattedDepartureDate, true)}
          </table>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td style="padding:8px 32px 32px;text-align:center;">
          ${btn(isUrgent ? '🚨 Сплатити ЗАРАЗ' : '💳 Сплатити залишок', d.paymentLink,
                isUrgent ? BRAND.danger : BRAND.gold)}
          <p style="margin:14px 0 0;font-family:Arial,sans-serif;font-size:12px;color:${BRAND.textMuted};">
            Питання щодо оплати?
            <a href="mailto:info@eurotrips.ua" style="color:${BRAND.navy};text-decoration:none;">info@eurotrips.ua</a>
          </p>
        </td>
      </tr>`;

  return layout(content, `Залишок ${d.formattedBalanceDue} по бронюванню ${d.bookingNumber}`);
}

export function paymentReminderSubject(daysLeft: number, tourName: string, balance: string): string {
  if (daysLeft <= 1) return `🚨 Останній день! Оплата ${balance} — ${tourName}`;
  if (daysLeft <= 3) return `⚠️ ${daysLeft} дні до дедлайну оплати — ${tourName}`;
  return `🔔 Нагадування: залишок ${balance} — ${tourName}`;
}

// ─────────────────────────────────────────────────────────────

/**
 * Інформація перед виїздом (інфолист).
 * Тригер: BullMQ scheduler — за 3 дні до departure_date
 */
export function preDepartureHtml(d: PreDepartureData): string {
  const content = `
      <!-- HERO -->
      <tr>
        <td style="background:linear-gradient(135deg,${BRAND.navy} 0%,#0F3460 100%);
                   padding:32px;text-align:center;">
          <p style="font-family:Arial,Helvetica,sans-serif;font-size:48px;margin:0 0 8px 0;">🚌</p>
          <h1 style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;
                     color:${BRAND.white};margin:0 0 6px 0;">До виїзду залишилося 3 дні!</h1>
          <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;
                    color:rgba(255,255,255,0.85);margin:0;">
            ${d.touristFirstName}, готуйтесь до незабутньої подорожі 🌍
          </p>
        </td>
      </tr>

      <!-- GREETING -->
      <tr>
        <td style="padding:24px 32px 8px;">
          <p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${BRAND.textDark};
                    line-height:1.6;margin:0;">
            Вже зовсім скоро ваш тур <strong style="color:${BRAND.navy};">${d.tourName}</strong>
            (код: ${d.tourCode}) почнеться ${d.formattedDepartureDate}.
            Нижче — всі важливі деталі для відправлення.
          </p>
        </td>
      </tr>

      <!-- DEPARTURE BLOCK -->
      <tr>
        <td style="padding:16px 32px 8px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                 style="background:${BRAND.offWhite};border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:${BRAND.gold};padding:12px 20px;">
                <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;
                           color:${BRAND.white};margin:0;">📍 МІСЦЕ ТА ЧАС ВІДПРАВЛЕННЯ</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="padding:6px 0;width:40%;">
                      <p style="font-family:Arial,sans-serif;font-size:12px;color:${BRAND.textMuted};margin:0;">ДАТА ВИЇЗДУ</p>
                      <p style="font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:${BRAND.navy};margin:4px 0 0;">${d.formattedDepartureDate}</p>
                    </td>
                    <td style="padding:6px 0;width:30%;">
                      <p style="font-family:Arial,sans-serif;font-size:12px;color:${BRAND.textMuted};margin:0;">ЧАС ЗБОРУ</p>
                      <p style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:${BRAND.gold};margin:4px 0 0;">${d.departureTime}</p>
                    </td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colspan="3" style="padding:12px 0 0;">
                      <p style="font-family:Arial,sans-serif;font-size:12px;color:${BRAND.textMuted};margin:0;">МІСЦЕ ЗБОРУ</p>
                      <p style="font-family:Arial,sans-serif;font-size:15px;font-weight:600;
                                 color:${BRAND.textDark};margin:4px 0 0;">📍 ${d.meetingPoint}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- GUIDE BLOCK -->
      ${d.guideName ? `
      <tr>
        <td style="padding:8px 32px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                 style="background:${BRAND.offWhite};border-radius:8px;padding:16px 20px;">
            <tr>
              <td>
                <p style="font-family:Arial,sans-serif;font-size:12px;color:${BRAND.textMuted};margin:0 0 4px;">👤 ВАШ ГІД / СУПРОВОДЖУЮЧИЙ</p>
                <p style="font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:${BRAND.textDark};margin:0 0 4px;">${d.guideName}</p>
                ${d.guidePhone ? `<a href="tel:${d.guidePhone}" style="font-family:Arial,sans-serif;font-size:14px;color:${BRAND.navy};text-decoration:none;font-weight:600;">📞 ${d.guidePhone}</a>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>` : ''}

      <!-- INFO TABLE -->
      <tr>
        <td style="padding:8px 32px 16px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            ${infoRow('Номер бронювання', d.bookingNumber)}
          </table>
        </td>
      </tr>

      <!-- CHECKLIST -->
      <tr>
        <td style="padding:0 32px 16px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                 style="background:#EBF5FB;border-radius:8px;border-left:4px solid ${BRAND.navy};">
            <tr>
              <td style="padding:16px 20px;">
                <p style="font-family:Arial,sans-serif;font-size:13px;font-weight:700;
                           color:${BRAND.navy};margin:0 0 10px 0;">📋 ЧЕКЛІСТ ПЕРЕД ВИЇЗДОМ</p>
                ${['Паспорт / ID-картка (перевірте термін дії)', 'Страховий поліс', 'Готівка (EUR/PLN/USD в залежності від маршруту)', 'Зарядні пристрої та адаптери', 'Ліки (за необхідності)', 'Зручне взуття для прогулянок'].map(item =>
                  `<p style="font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};
                             margin:0 0 6px 0;">✅ ${item}</p>`
                ).join('')}
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- CTA BUTTONS -->
      <tr>
        <td style="padding:8px 32px 32px;text-align:center;">
          ${btn('📄 Завантажити інфолист', d.infolistUrl, BRAND.navy)}
          <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};">
            <a href="${d.bookingLink}" style="color:${BRAND.navy};text-decoration:none;">
              Переглянути бронювання →
            </a>
          </p>
          <p style="margin:20px 0 0;font-family:Arial,sans-serif;font-size:15px;font-weight:700;
                    color:${BRAND.gold};">
            Бажаємо незабутньої подорожі! 🌟
          </p>
        </td>
      </tr>`;

  return layout(content, `До виїзду ${d.tourName} залишилося 3 дні!`);
}

export function preDepartureSubject(tourName: string, date: string): string {
  return `🚌 До виїзду 3 дні! ${tourName} — ${date}`;
}
