// =============================================================================
// EUROTRIPS — Статусна машина бронювань (BR-06)
// Тільки дозволені переходи — ніяких стрибків через стадії
// =============================================================================

import { BookingStatus } from '@prisma/client';

/** Карта дозволених переходів статусів */
export const BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  new: [
    BookingStatus.in_work,
    BookingStatus.cancelled_operator,
  ],
  in_work: [
    BookingStatus.needs_clarification,
    BookingStatus.pre_booked,
    BookingStatus.awaiting_payment,
    BookingStatus.cancelled_operator,
  ],
  needs_clarification: [
    BookingStatus.in_work,
    BookingStatus.awaiting_payment,
    BookingStatus.cancelled_client,
    BookingStatus.cancelled_operator,
  ],
  pre_booked: [
    BookingStatus.awaiting_payment,
    BookingStatus.cancelled_client,
    BookingStatus.cancelled_operator,
  ],
  awaiting_payment: [
    BookingStatus.partially_paid,
    BookingStatus.confirmed,
    BookingStatus.cancelled_client,
    BookingStatus.cancelled_operator,
  ],
  partially_paid: [
    BookingStatus.confirmed,
    BookingStatus.cancelled_client,
    BookingStatus.cancelled_operator,
  ],
  confirmed: [
    BookingStatus.docs_collected,
    BookingStatus.cancelled_client,
    BookingStatus.cancelled_operator,
  ],
  docs_collected: [
    BookingStatus.ready_to_depart,
  ],
  ready_to_depart: [
    BookingStatus.on_trip,
  ],
  on_trip: [
    BookingStatus.completed,
    BookingStatus.no_show,
  ],
  completed:            [],  // terminal
  cancelled_client: [
    BookingStatus.refund,
  ],
  cancelled_operator: [
    BookingStatus.refund,
  ],
  no_show:              [],  // terminal
  refund:               [],  // terminal
};

/**
 * Перевіряє чи дозволений перехід між статусами.
 */
export function isValidStatusTransition(
  from: BookingStatus,
  to: BookingStatus
): boolean {
  return BOOKING_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Повертає список доступних наступних статусів.
 */
export function getAvailableTransitions(status: BookingStatus): BookingStatus[] {
  return BOOKING_STATUS_TRANSITIONS[status] ?? [];
}

/**
 * Перевіряє чи є статус фінальним (terminal).
 */
export function isTerminalStatus(status: BookingStatus): boolean {
  return BOOKING_STATUS_TRANSITIONS[status]?.length === 0;
}

/**
 * Перевіряє чи статус означає скасування (для повернення коштів).
 */
export function isCancelledStatus(status: BookingStatus): boolean {
  return ([
    BookingStatus.cancelled_client,
    BookingStatus.cancelled_operator,
    BookingStatus.no_show,
    BookingStatus.refund,
  ] as BookingStatus[]).includes(status);
}
