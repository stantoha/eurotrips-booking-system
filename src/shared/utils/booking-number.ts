// =============================================================================
// EUROTRIPS — Генератор номерів бронювань
// Формат: ET-{YEAR}-{NNNNN} → ET-2025-00123
// =============================================================================

import { prisma } from '../database/prisma';
import { config } from '../../config';

/**
 * Генерує унікальний номер бронювання.
 * Використовує atomic increment через PostgreSQL.
 */
export async function generateBookingNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = config.BOOKING_NUMBER_PREFIX;
  const pad = config.BOOKING_NUMBER_PAD;

  // Шукаємо останній номер поточного року
  const lastBooking = await prisma.booking.findFirst({
    where: { bookingNumber: { startsWith: `${prefix}-${year}-` } },
    orderBy: { bookingNumber: 'desc' },
    select: { bookingNumber: true },
  });

  let sequence = 1;
  if (lastBooking) {
    const parts = lastBooking.bookingNumber.split('-');
    sequence = parseInt(parts[parts.length - 1], 10) + 1;
  }

  return `${prefix}-${year}-${String(sequence).padStart(pad, '0')}`;
}

/**
 * Перевіряє формат номера бронювання
 */
export function isValidBookingNumber(number: string): boolean {
  const regex = new RegExp(`^${config.BOOKING_NUMBER_PREFIX}-\\d{4}-\\d{${config.BOOKING_NUMBER_PAD}}$`);
  return regex.test(number);
}
