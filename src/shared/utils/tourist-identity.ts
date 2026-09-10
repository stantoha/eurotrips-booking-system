// =============================================================================
// EUROTRIPS — ідентичність туриста
//
// Раніше турист шукався виключно по email, а Tourist.email був @unique. Це
// ламається на двох сценаріях:
//
//   1. Кабінет агента. Агент вводить ім'я латиницею, ІПН і паспорт, а email
//      часто свій власний. Перше ж бронювання на двох осіб зливало учасників
//      в один запис (або падало на unique).
//   2. Міграція з Zoho (етап 5, ~91 860 контактів). Там email не unique —
//      колізії гарантовані.
//
// Каскад пошуку: паспорт + дата народження → email → створити нового.
// Паспорт+ДН — справжня ідентичність людини; email — лише контакт.
// =============================================================================

import { Prisma } from '@prisma/client';

/** Мінімум, за яким можна впізнати туриста. */
export interface TouristIdentity {
  passportNumber?: string | null;
  dateOfBirth?: Date | string | null;
  email?: string | null;
}

type Db = Prisma.TransactionClient | {
  tourist: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
};

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  return v instanceof Date ? v : new Date(v);
}

/**
 * Шукає наявного туриста за каскадом ідентичності.
 * Повертає null, якщо нікого не знайдено — викликач створює нового.
 *
 * Свідомо НЕ використовує findUnique: після зняття @unique з email
 * findUnique по ньому недоступний, а по парі паспорт+ДН пошук має
 * коректно ігнорувати неповні дані (лише паспорт без ДН не ідентифікує).
 */
export async function findExistingTourist(
  db: Db,
  identity: TouristIdentity,
): Promise<{ id: string } | null> {
  const passportNumber = identity.passportNumber?.trim() || null;
  const dateOfBirth = toDate(identity.dateOfBirth);
  const email = identity.email?.trim() || null;

  // 1. Паспорт + дата народження — найнадійніше
  if (passportNumber && dateOfBirth) {
    const byPassport = await (db as Prisma.TransactionClient).tourist.findFirst({
      where: { passportNumber, dateOfBirth },
      select: { id: true },
    });
    if (byPassport) return byPassport;
  }

  // 2. Email — слабший, але кращий за створення дубля.
  // findFirst, бо email більше не унікальний: за збігом може бути кілька
  // записів (агент на всіх учасників вказав свою адресу). Беремо найстаріший —
  // він з більшою ймовірністю справжній профіль клієнта.
  if (email) {
    const byEmail = await (db as Prisma.TransactionClient).tourist.findFirst({
      where: { email },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (byEmail) return byEmail;
  }

  // 3. Не знайдено — створювати нового
  return null;
}
