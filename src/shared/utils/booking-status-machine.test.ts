// =============================================================================
// EUROTRIPS — Booking Status Machine Unit Tests (BR-06)
// =============================================================================

import { describe, it, expect } from 'vitest';
import { BookingStatus } from '@prisma/client';
import {
  BOOKING_STATUS_TRANSITIONS,
  isValidStatusTransition,
  getAvailableTransitions,
  isTerminalStatus,
  isCancelledStatus,
} from './booking-status-machine';

const ALL_STATUSES = Object.values(BookingStatus);

describe('isValidStatusTransition', () => {
  it('дозволяє КОЖЕН перехід, описаний у BOOKING_STATUS_TRANSITIONS', () => {
    for (const [from, targets] of Object.entries(BOOKING_STATUS_TRANSITIONS)) {
      for (const to of targets) {
        expect(
          isValidStatusTransition(from as BookingStatus, to),
          `${from} → ${to} має бути дозволено`,
        ).toBe(true);
      }
    }
  });

  it('забороняє переходи, що НЕ описані у карті (для кожного статусу)', () => {
    for (const from of ALL_STATUSES) {
      const allowed = new Set(BOOKING_STATUS_TRANSITIONS[from]);
      for (const to of ALL_STATUSES) {
        if (to === from || allowed.has(to)) continue;
        expect(
          isValidStatusTransition(from, to),
          `${from} → ${to} має бути заборонено`,
        ).toBe(false);
      }
    }
  });

  it('забороняє стрибок через стадії: new → confirmed (минаючи in_work/awaiting_payment)', () => {
    expect(isValidStatusTransition(BookingStatus.new, BookingStatus.confirmed)).toBe(false);
  });

  it('забороняє стрибок: new → on_trip', () => {
    expect(isValidStatusTransition(BookingStatus.new, BookingStatus.on_trip)).toBe(false);
  });

  it('забороняє повернення назад: confirmed → new', () => {
    expect(isValidStatusTransition(BookingStatus.confirmed, BookingStatus.new)).toBe(false);
  });

  it('забороняє БУДЬ-ЯКИЙ перехід із термінальних статусів (completed/no_show/refund)', () => {
    const terminal: BookingStatus[] = [BookingStatus.completed, BookingStatus.no_show, BookingStatus.refund];
    for (const from of terminal) {
      for (const to of ALL_STATUSES) {
        if (to === from) continue;
        expect(isValidStatusTransition(from, to), `${from} → ${to}`).toBe(false);
      }
    }
  });

  it('дозволяє щасливий шлях по всьому ланцюгу до completed', () => {
    const path: BookingStatus[] = [
      BookingStatus.new,
      BookingStatus.in_work,
      BookingStatus.awaiting_payment,
      BookingStatus.confirmed,
      BookingStatus.docs_collected,
      BookingStatus.ready_to_depart,
      BookingStatus.on_trip,
      BookingStatus.completed,
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(isValidStatusTransition(path[i], path[i + 1]), `${path[i]} → ${path[i + 1]}`).toBe(true);
    }
  });

  it('дозволяє cancelled_client → refund і cancelled_operator → refund', () => {
    expect(isValidStatusTransition(BookingStatus.cancelled_client, BookingStatus.refund)).toBe(true);
    expect(isValidStatusTransition(BookingStatus.cancelled_operator, BookingStatus.refund)).toBe(true);
  });

  it(
    'ПРИМІТКА: на рівні цієї чистої функції cancelled_* → refund дозволено ' +
    'БЕЗУМОВНО (наявність платежів тут не перевіряється — це відповідальність ' +
    'викликача/сервісу, не state machine)',
    () => {
      // Задокументовано явно, щоб майбутня зміна цієї поведінки була свідомою.
      expect(BOOKING_STATUS_TRANSITIONS.cancelled_client).toEqual([BookingStatus.refund]);
      expect(BOOKING_STATUS_TRANSITIONS.cancelled_operator).toEqual([BookingStatus.refund]);
    },
  );
});

describe('getAvailableTransitions', () => {
  it('повертає точний список дозволених переходів', () => {
    expect(getAvailableTransitions(BookingStatus.awaiting_payment)).toEqual([
      BookingStatus.partially_paid,
      BookingStatus.confirmed,
      BookingStatus.cancelled_client,
      BookingStatus.cancelled_operator,
    ]);
  });

  it('повертає порожній масив для термінальних статусів', () => {
    expect(getAvailableTransitions(BookingStatus.completed)).toEqual([]);
    expect(getAvailableTransitions(BookingStatus.no_show)).toEqual([]);
    expect(getAvailableTransitions(BookingStatus.refund)).toEqual([]);
  });
});

describe('isTerminalStatus', () => {
  it('completed/no_show/refund — термінальні', () => {
    expect(isTerminalStatus(BookingStatus.completed)).toBe(true);
    expect(isTerminalStatus(BookingStatus.no_show)).toBe(true);
    expect(isTerminalStatus(BookingStatus.refund)).toBe(true);
  });

  it('усі інші статуси — НЕ термінальні', () => {
    const nonTerminal = ALL_STATUSES.filter(
      (s) => ![BookingStatus.completed, BookingStatus.no_show, BookingStatus.refund].includes(s),
    );
    for (const s of nonTerminal) {
      expect(isTerminalStatus(s), s).toBe(false);
    }
  });
});

describe('isCancelledStatus', () => {
  it('true для cancelled_client/cancelled_operator/no_show/refund', () => {
    expect(isCancelledStatus(BookingStatus.cancelled_client)).toBe(true);
    expect(isCancelledStatus(BookingStatus.cancelled_operator)).toBe(true);
    expect(isCancelledStatus(BookingStatus.no_show)).toBe(true);
    expect(isCancelledStatus(BookingStatus.refund)).toBe(true);
  });

  it('false для активних статусів', () => {
    expect(isCancelledStatus(BookingStatus.new)).toBe(false);
    expect(isCancelledStatus(BookingStatus.confirmed)).toBe(false);
    expect(isCancelledStatus(BookingStatus.completed)).toBe(false);
  });
});
