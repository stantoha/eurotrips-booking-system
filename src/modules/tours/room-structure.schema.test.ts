// =============================================================================
// EUROTRIPS — Room Structure Schema Unit Tests (BR-10)
//
// ПРИМІТКА: sum(twin×2+double×2+triple×3+single×1) ≤ tour.totalSeats
// перевіряється НЕ тут — Zod-схема не має доступу до tour.totalSeats (це
// окремий запис у БД), тому ємнісна перевірка реалізована на сервісному рівні
// (room-structure.service.ts::setStructure). Тут — тільки форма/типи полів,
// які СПРАВДІ описані в SetRoomStructureSchema. Ємнісний ліміт — у
// room-structure.service.test.ts.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  SetRoomStructureSchema,
  ApproveRoomStructureSchema,
  FinalizeRoomStructureSchema,
} from './room-structure.schema';

const VALID_ID = '11111111-1111-1111-1111-111111111111';

describe('SetRoomStructureSchema', () => {
  it('приймає валідні дані з усіма полями', () => {
    const result = SetRoomStructureSchema.parse({
      hotelBookingId: VALID_ID,
      plannedTwin: 10,
      plannedDouble: 5,
      plannedTriple: 2,
      plannedSingle: 1,
    });
    expect(result).toEqual({
      hotelBookingId: VALID_ID,
      plannedTwin: 10,
      plannedDouble: 5,
      plannedTriple: 2,
      plannedSingle: 1,
    });
  });

  it('застосовує default(0) для planned* полів, якщо не передані', () => {
    const result = SetRoomStructureSchema.parse({ hotelBookingId: VALID_ID });
    expect(result).toEqual({
      hotelBookingId: VALID_ID,
      plannedTwin: 0,
      plannedDouble: 0,
      plannedTriple: 0,
      plannedSingle: 0,
    });
  });

  it('відхиляє hotelBookingId, що не є UUID', () => {
    expect(() =>
      SetRoomStructureSchema.parse({ hotelBookingId: 'not-a-uuid' }),
    ).toThrow();
  });

  it('відхиляє hotelBookingId відсутній взагалі', () => {
    expect(() => SetRoomStructureSchema.parse({})).toThrow();
  });

  it('відхиляє від\'ємні значення planned*', () => {
    expect(() =>
      SetRoomStructureSchema.parse({ hotelBookingId: VALID_ID, plannedTwin: -1 }),
    ).toThrow();
  });

  it('відхиляє дробові значення planned* (тільки цілі)', () => {
    expect(() =>
      SetRoomStructureSchema.parse({ hotelBookingId: VALID_ID, plannedDouble: 1.5 }),
    ).toThrow();
  });
});

describe('ApproveRoomStructureSchema / FinalizeRoomStructureSchema', () => {
  it('приймають валідний hotelBookingId', () => {
    expect(ApproveRoomStructureSchema.parse({ hotelBookingId: VALID_ID })).toEqual({
      hotelBookingId: VALID_ID,
    });
    expect(FinalizeRoomStructureSchema.parse({ hotelBookingId: VALID_ID })).toEqual({
      hotelBookingId: VALID_ID,
    });
  });

  it('відхиляють невалідний UUID', () => {
    expect(() => ApproveRoomStructureSchema.parse({ hotelBookingId: 'xyz' })).toThrow();
    expect(() => FinalizeRoomStructureSchema.parse({ hotelBookingId: 'xyz' })).toThrow();
  });
});
