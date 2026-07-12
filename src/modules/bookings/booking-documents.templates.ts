// =============================================================================
// EUROTRIPS — HTML-шаблони PDF-документів бронювання (Реліз 1: «документи»)
// Ваучер туриста + договір на туристичне обслуговування.
// =============================================================================

import { baseStyles, escapeHtml } from '../tours/documents/templates';

export interface BookingDocData {
  bookingNumber: string;
  createdAt: Date;
  status: string;
  totalAmount: number;
  depositPaid: number;
  balancePaid: number;
  currency: string;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  tourCode: string;
  tourName: string;
  direction: string | null;
  departureDate: Date;
  returnDate: Date;
  departureCity: string | null;
  included: string | null;
  tourists: { lastName: string; firstName: string; dateOfBirth: Date | null; passportNumber: string | null }[];
}

const fmtDate = (d: Date) => d.toLocaleDateString('uk-UA');
const fmtMoney = (n: number, cur: string) => `${n.toLocaleString('uk-UA')} ${cur}`;

function touristsTable(tourists: BookingDocData['tourists']): string {
  const rows = tourists.map((t, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(t.lastName)} ${escapeHtml(t.firstName)}</td>
      <td>${t.dateOfBirth ? fmtDate(t.dateOfBirth) : '—'}</td>
      <td>${escapeHtml(t.passportNumber) || '—'}</td>
    </tr>`).join('');
  return `
    <table>
      <thead><tr><th>№</th><th>ПІБ</th><th>Дата народження</th><th>Паспорт</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function voucherHtml(d: BookingDocData): string {
  const paid = d.depositPaid + d.balancePaid;
  return `<!DOCTYPE html>
<html lang="uk"><head><meta charset="utf-8"><style>${baseStyles()}
  .box { border: 1px solid #dde3ef; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; }
  .grid { display: flex; gap: 24px; flex-wrap: wrap; }
  .grid div { min-width: 180px; }
  .label { font-size: 9px; text-transform: uppercase; color: #8b98b5; }
  .value { font-size: 12px; margin-top: 2px; }
</style></head><body>
  <h1>ТУРИСТИЧНИЙ ВАУЧЕР № ${escapeHtml(d.bookingNumber)}</h1>
  <p class="meta">Eurotrips · eurotrips.ua · Видано ${fmtDate(new Date())}</p>

  <div class="box">
    <div class="grid">
      <div><p class="label">Тур</p><p class="value">${escapeHtml(d.tourCode)} — ${escapeHtml(d.tourName)}</p></div>
      <div><p class="label">Напрямок</p><p class="value">${escapeHtml(d.direction) || '—'}</p></div>
      <div><p class="label">Дати</p><p class="value">${fmtDate(d.departureDate)} — ${fmtDate(d.returnDate)}</p></div>
      <div><p class="label">Виїзд з</p><p class="value">${escapeHtml(d.departureCity) || '—'}</p></div>
    </div>
  </div>

  <div class="box">
    <div class="grid">
      <div><p class="label">Замовник</p><p class="value">${escapeHtml(d.contactName)}</p></div>
      <div><p class="label">Телефон</p><p class="value">${escapeHtml(d.contactPhone) || '—'}</p></div>
      <div><p class="label">Email</p><p class="value">${escapeHtml(d.contactEmail) || '—'}</p></div>
      <div><p class="label">Вартість / Сплачено</p><p class="value">${fmtMoney(d.totalAmount, d.currency)} / ${fmtMoney(paid, d.currency)}</p></div>
    </div>
  </div>

  <h1 style="font-size:13px">Учасники поїздки (${d.tourists.length})</h1>
  ${touristsTable(d.tourists)}

  ${d.included ? `<p class="meta" style="margin-top:14px"><strong>Включено:</strong> ${escapeHtml(d.included)}</p>` : ''}
  <p class="footer">Ваучер є підставою для отримання оплачених послуг. Дійсний за наявності документа, що посвідчує особу.</p>
</body></html>`;
}

export function contractHtml(d: BookingDocData): string {
  return `<!DOCTYPE html>
<html lang="uk"><head><meta charset="utf-8"><style>${baseStyles()}
  h2 { font-size: 12px; margin: 14px 0 6px; }
  p.text { font-size: 11px; line-height: 1.55; margin: 4px 0; }
  .sign { display: flex; gap: 40px; margin-top: 32px; }
  .sign div { flex: 1; border-top: 1px solid #4a5578; padding-top: 6px; font-size: 10px; color: #4a5578; }
</style></head><body>
  <h1>ДОГОВІР НА ТУРИСТИЧНЕ ОБСЛУГОВУВАННЯ № ${escapeHtml(d.bookingNumber)}</h1>
  <p class="meta">м. Львів · ${fmtDate(new Date())}</p>

  <p class="text">Туроператор <strong>Eurotrips</strong> (далі — «Туроператор») з однієї сторони та
  <strong>${escapeHtml(d.contactName)}</strong> (далі — «Турист») з іншої сторони уклали цей договір про наступне:</p>

  <h2>1. Предмет договору</h2>
  <p class="text">Туроператор зобов'язується забезпечити надання комплексу туристичних послуг за туром
  <strong>${escapeHtml(d.tourCode)} — ${escapeHtml(d.tourName)}</strong>
  (${fmtDate(d.departureDate)} — ${fmtDate(d.returnDate)}${d.departureCity ? `, виїзд з м. ${escapeHtml(d.departureCity)}` : ''}),
  а Турист — прийняти та оплатити ці послуги.</p>
  ${d.included ? `<p class="text"><strong>До складу туру входить:</strong> ${escapeHtml(d.included)}.</p>` : ''}

  <h2>2. Учасники поїздки</h2>
  ${touristsTable(d.tourists)}

  <h2>3. Вартість та порядок оплати</h2>
  <p class="text">Загальна вартість туру становить <strong>${fmtMoney(d.totalAmount, d.currency)}</strong>.
  Сплачено на момент укладення: ${fmtMoney(d.depositPaid + d.balancePaid, d.currency)}.
  Залишок сплачується згідно з умовами бронювання до дати виїзду.</p>

  <h2>4. Відповідальність та умови скасування</h2>
  <p class="text">Умови скасування бронювання визначаються політикою скасування, чинною на дату бронювання.
  У разі скасування туру з вини Туроператора — повне повернення сплачених коштів.</p>

  <div class="sign">
    <div>Туроператор: Eurotrips</div>
    <div>Турист: ${escapeHtml(d.contactName)}</div>
  </div>
  <p class="footer">Згенеровано автоматично системою бронювання Eurotrips · ${escapeHtml(d.bookingNumber)}</p>
</body></html>`;
}
