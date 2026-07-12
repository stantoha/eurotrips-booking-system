// =============================================================================
// EUROTRIPS — HTML-шаблони для PDF-документів (OPS-18/19)
// Формат колонок звірений з реальними файлами команди:
// "MB26070401 - Румінг.csv" та "MB26070401 - Песенджер.csv"
// =============================================================================

const MEAL_LABELS: Record<string, string> = {
  RO: 'RO - room only',
  BB: 'BB - bed & breakfast',
  HB: 'HB - half board',
  FB: 'FB - full board',
};

const ROOM_TYPE_LABELS: Record<string, string> = {
  twin: 'TWIN', double: 'DOUBLE', triple: 'TRIPLE', single: 'SINGLE', no_preference: '',
};

export function baseStyles(): string {
  return `
    body { font-family: 'Arial', sans-serif; font-size: 11px; color: #1a1a2e; margin: 24px; }
    h1 { font-size: 16px; margin-bottom: 4px; }
    p.meta { font-size: 11px; color: #4a5578; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f0f4f8; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; border-bottom: 2px solid #dde3ef; }
    td { padding: 5px 8px; border-bottom: 1px solid #eef1f7; }
    tr:nth-child(even) { background: #fafbfc; }
    .footer { margin-top: 16px; font-size: 9px; color: #8b98b5; }
  `;
}

export function escapeHtml(value: string | null | undefined): string {
  if (value == null) return '';
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export interface RoomingRow {
  bookingNumber: string;
  lastName: string;
  firstName: string;
  passportNumber: string | null;
  dateOfBirth: Date | null;
  actualRoomNumber: string | null;
  actualRoomType: string | null;
  mealType: string | null;
  notes: string | null;
}

export function roomingHtml(tourCode: string, tourName: string, hotelName: string, rows: RoomingRow[]): string {
  const body = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(r.bookingNumber)}</td>
      <td>${escapeHtml(r.lastName)}</td>
      <td>${escapeHtml(r.firstName)}</td>
      <td>${escapeHtml(r.passportNumber)}</td>
      <td>${r.dateOfBirth ? r.dateOfBirth.toLocaleDateString('uk-UA') : ''}</td>
      <td>${escapeHtml(r.actualRoomNumber)} ${r.actualRoomType ? ROOM_TYPE_LABELS[r.actualRoomType] ?? '' : ''}</td>
      <td>${r.mealType ? MEAL_LABELS[r.mealType] ?? r.mealType : ''}</td>
      <td>${escapeHtml(r.notes)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8"><style>${baseStyles()}</style></head>
  <body>
    <h1>Румінг для готелю — ${escapeHtml(hotelName)}</h1>
    <p class="meta">Тур: ${escapeHtml(tourCode)} — ${escapeHtml(tourName)} · Сформовано: ${new Date().toLocaleDateString('uk-UA')} · Усього туристів: ${rows.length}</p>
    <table>
      <thead><tr><th>№</th><th>№ бронювання</th><th>Прізвище</th><th>Ім'я</th><th>Паспорт</th><th>Дата народж.</th><th>Кімната</th><th>Харчування</th><th>Примітки</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p class="footer">Eurotrips · Автоматично згенерований документ</p>
  </body></html>`;
}

export interface PassengerRow {
  lastName: string;
  firstName: string;
  passportNumber: string | null;
  dateOfBirth: Date | null;
  busSeatNumber: number | null;
  phone: string | null;
}

export function passengerListHtml(tourCode: string, tourName: string, rows: PassengerRow[]): string {
  const sorted = [...rows].sort((a, b) => a.lastName.localeCompare(b.lastName));
  const body = sorted.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(r.lastName)}</td>
      <td>${escapeHtml(r.firstName)}</td>
      <td>${escapeHtml(r.passportNumber)}</td>
      <td>${r.dateOfBirth ? r.dateOfBirth.toLocaleDateString('uk-UA') : ''}</td>
      <td>${r.busSeatNumber ?? ''}</td>
      <td>${escapeHtml(r.phone)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8"><style>${baseStyles()}</style></head>
  <body>
    <h1>Пасенджер-ліст</h1>
    <p class="meta">Тур: ${escapeHtml(tourCode)} — ${escapeHtml(tourName)} · Сформовано: ${new Date().toLocaleDateString('uk-UA')} · Усього пасажирів: ${rows.length}</p>
    <table>
      <thead><tr><th>№</th><th>Прізвище</th><th>Ім'я</th><th>Паспорт</th><th>Дата народж.</th><th>Місце</th><th>Телефон</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p class="footer">Eurotrips · Автоматично згенерований документ</p>
  </body></html>`;
}
