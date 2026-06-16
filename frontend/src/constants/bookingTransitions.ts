// Booking FSM — дозволені переходи між статусами (BR-06)
// Дублює логіку src/shared/utils/booking-status-machine.ts для фронтенду
import type { BookingStatus } from '../types';

export const BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  new:                   ['in_work', 'pre_booked', 'cancelled_operator'],
  in_work:               ['needs_clarification', 'pre_booked', 'cancelled_operator', 'cancelled_client'],
  needs_clarification:   ['in_work', 'cancelled_client', 'cancelled_operator'],
  pre_booked:            ['awaiting_payment', 'cancelled_client', 'cancelled_operator'],
  awaiting_payment:      ['partially_paid', 'confirmed', 'cancelled_client', 'cancelled_operator'],
  partially_paid:        ['confirmed', 'cancelled_client', 'cancelled_operator'],
  confirmed:             ['docs_collected', 'cancelled_client', 'cancelled_operator'],
  docs_collected:        ['ready_to_depart', 'cancelled_client', 'cancelled_operator'],
  ready_to_depart:       ['on_trip', 'no_show', 'cancelled_operator'],
  on_trip:               ['completed'],
  completed:             [],
  cancelled_client:      ['refund'],
  cancelled_operator:    ['refund'],
  no_show:               [],
  refund:                [],
};

export function getAllowedTransitions(status: BookingStatus): BookingStatus[] {
  return BOOKING_STATUS_TRANSITIONS[status] ?? [];
}

export function isTransitionAllowed(from: BookingStatus, to: BookingStatus): boolean {
  return getAllowedTransitions(from).includes(to);
}

export const TERMINAL_STATUSES: BookingStatus[] = [
  'completed', 'no_show', 'refund',
];

export function isTerminalStatus(status: BookingStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
