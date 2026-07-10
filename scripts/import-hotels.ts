// =============================================================================
// EUROTRIPS — одноразовий імпорт бази готелів з CSV (563 записи)
// Джерело: "Final Hotel Database - Sheet1.csv" (563+ готелів, CLAUDE.md §5)
// Запуск: npx tsx scripts/import-hotels.ts "C:/шлях/до/файлу.csv"
//
// Колонки "All Emails", "Email Type", "Enrichment Source", "Status", "Email
// Source" з CSV — метадані email-верифікації (з lead-gen інструменту), не
// мають відповідних полів у Hotel-моделі і навмисно НЕ імпортуються. CSV
// "Status" НЕ мапиться на модельне поле status (active/inactive/archived) —
// це різні речі (email-верифікація vs. операційний статус готелю).
// =============================================================================

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import prisma from '../src/shared/database/prisma';

interface CsvRow {
  Country: string;
  City: string;
  'Hotel Name': string;
  'Hotel ID': string;
  Email: string;
  'Price (EUR, 1 night, Apr)': string;
  'Price (EUR, 1 night, Jun)': string;
  'Price (EUR, 1 night, Oct)': string;
  Phone: string;
  'Booking URL': string;
  Website: string;
  'Accommodation Type': string;
  Stars: string;
  'Review Score': string;
  'Review Count': string;
  Address: string;
  Zip: string;
  District: string;
  'Distance from Centre': string;
  Latitude: string;
  Longitude: string;
  'Family Friendly': string;
  'Breakfast Review Score': string;
  'WiFi Review Score': string;
  'Avg Room Size (m2)': string;
  Facilities: string;
  'Languages Spoken': string;
  Verified: string;
  Notes: string;
}

function strOrNull(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

/** Деякі значення в "Price ... Jun" мають префікс "EUR " (напр. "EUR 70.00") */
function numOrNull(v: string | undefined): number | null {
  const t = v?.trim();
  if (!t) return null;
  const cleaned = t.replace(/^EUR\s*/i, '');
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

function intOrNull(v: string | undefined): number | null {
  const n = numOrNull(v);
  return n === null ? null : Math.round(n);
}

/** CSV містить суміш "TRUE"/"FALSE"/"Yes"/"No"/"" — нормалізуємо до boolean */
function yesNoToBool(v: string | undefined): boolean {
  const t = v?.trim().toLowerCase();
  return t === 'yes' || t === 'true';
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Використання: npx tsx scripts/import-hotels.ts <шлях-до-csv>');
    process.exit(1);
  }

  const existing = await prisma.hotel.count();
  if (existing > 0) {
    console.error(`❌ Таблиця hotels вже містить ${existing} записів. Імпорт скасовано (щоб не задублювати дані).`);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows: CsvRow[] = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });

  console.log(`📄 Прочитано ${rows.length} рядків з CSV`);

  const data = rows.map((r) => ({
    hotelExternalId:    numOrNull(r['Hotel ID']),
    name:               r['Hotel Name'].trim(),
    country:            r.Country.trim(),
    city:               r.City.trim(),
    address:            strOrNull(r.Address),
    zip:                strOrNull(r.Zip),
    district:           strOrNull(r.District),
    accommodationType:  strOrNull(r['Accommodation Type']),
    stars:              numOrNull(r.Stars),
    reviewScore:        numOrNull(r['Review Score']),
    reviewCount:        intOrNull(r['Review Count']),
    distanceFromCentre: numOrNull(r['Distance from Centre']),
    latitude:           numOrNull(r.Latitude),
    longitude:          numOrNull(r.Longitude),
    priceApr:           numOrNull(r['Price (EUR, 1 night, Apr)']),
    priceJun:           numOrNull(r['Price (EUR, 1 night, Jun)']),
    priceOct:           numOrNull(r['Price (EUR, 1 night, Oct)']),
    email:              strOrNull(r.Email),
    phone:              strOrNull(r.Phone),
    bookingUrl:         strOrNull(r['Booking URL']),
    website:            strOrNull(r.Website),
    facilities:         strOrNull(r.Facilities),
    languagesSpoken:    strOrNull(r['Languages Spoken']),
    isFamilyFriendly:   yesNoToBool(r['Family Friendly']),
    breakfastScore:     numOrNull(r['Breakfast Review Score']),
    wifiScore:          numOrNull(r['WiFi Review Score']),
    avgRoomSizeM2:      numOrNull(r['Avg Room Size (m2)']),
    isVerified:         yesNoToBool(r.Verified),
    notes:              strOrNull(r.Notes),
    // status: залишаємо дефолт моделі ('active') — CSV "Status" це email-метадані, не операційний статус
  }));

  const result = await prisma.hotel.createMany({ data, skipDuplicates: true });
  console.log(`✅ Імпортовано ${result.count} готелів`);

  const byCountry = await prisma.hotel.groupBy({ by: ['country'], _count: { _all: true } });
  byCountry
    .sort((a, b) => b._count._all - a._count._all)
    .forEach((c) => console.log(`   ${c.country}: ${c._count._all}`));

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('❌ Помилка імпорту:', err);
  await prisma.$disconnect();
  process.exit(1);
});
