// =============================================================================
// EUROTRIPS — каскад ідентичності туриста
// паспорт + дата народження → email → створити нового
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findExistingTourist } from './tourist-identity';

const db = { tourist: { findFirst: vi.fn() } };

describe('findExistingTourist', () => {
  beforeEach(() => vi.clearAllMocks());

  it('спершу шукає за парою паспорт + дата народження', async () => {
    db.tourist.findFirst.mockResolvedValueOnce({ id: 'by-passport' });

    const res = await findExistingTourist(db as any, {
      passportNumber: 'FE123456',
      dateOfBirth: '1990-05-01',
      email: 'agent@agency.ua',
    });

    expect(res).toEqual({ id: 'by-passport' });
    expect(db.tourist.findFirst).toHaveBeenCalledTimes(1);
    const where = db.tourist.findFirst.mock.calls[0][0].where;
    expect(where.passportNumber).toBe('FE123456');
    expect(where.dateOfBirth).toBeInstanceOf(Date);
    // email до пошуку не дійшов
    expect(where.email).toBeUndefined();
  });

  it('падає назад на email, якщо за паспортом нікого', async () => {
    db.tourist.findFirst
      .mockResolvedValueOnce(null)              // паспорт
      .mockResolvedValueOnce({ id: 'by-mail' }); // email

    const res = await findExistingTourist(db as any, {
      passportNumber: 'FE123456',
      dateOfBirth: '1990-05-01',
      email: 'ivan@example.com',
    });

    expect(res).toEqual({ id: 'by-mail' });
    expect(db.tourist.findFirst).toHaveBeenCalledTimes(2);
    expect(db.tourist.findFirst.mock.calls[1][0].where).toEqual({ email: 'ivan@example.com' });
  });

  it('не шукає за паспортом, якщо дати народження немає', async () => {
    db.tourist.findFirst.mockResolvedValueOnce({ id: 'by-mail' });

    await findExistingTourist(db as any, {
      passportNumber: 'FE123456', // без dateOfBirth пара неповна
      email: 'ivan@example.com',
    });

    expect(db.tourist.findFirst).toHaveBeenCalledTimes(1);
    expect(db.tourist.findFirst.mock.calls[0][0].where).toEqual({ email: 'ivan@example.com' });
  });

  it('при кількох туристах з одним email бере найстарішого', async () => {
    db.tourist.findFirst.mockResolvedValueOnce({ id: 'oldest' });

    await findExistingTourist(db as any, { email: 'family@example.com' });

    expect(db.tourist.findFirst.mock.calls[0][0].orderBy).toEqual({ createdAt: 'asc' });
  });

  it('повертає null, коли ідентифікувати нічим — викликач створює нового', async () => {
    const res = await findExistingTourist(db as any, {});
    expect(res).toBeNull();
    expect(db.tourist.findFirst).not.toHaveBeenCalled();
  });

  it('порожні рядки не вважає ідентифікаторами', async () => {
    const res = await findExistingTourist(db as any, {
      passportNumber: '   ',
      email: '',
    });
    expect(res).toBeNull();
    expect(db.tourist.findFirst).not.toHaveBeenCalled();
  });
});
