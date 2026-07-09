// =============================================================================
// EUROTRIPS — Bookings Service Unit Tests
// A3: реальний запис у audit_log при зміні статусу бронювання — перевіряємо,
// що auditLog.create() викликається з полями, які СПРАВДІ існують на
// Prisma-моделі AuditLog (userId, action, tableName, recordId, oldData,
// newData) — а не entityType/entityId/details/severity/source.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingStatus, UserRole } from '@prisma/client';

// ── Моки ──────────────────────────────────────────────────────────────────
vi.mock('../../shared/database/prisma', () => ({
  default: {
    booking: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('../communications/email.queue', () => ({
  getEmailQueue: vi.fn(),
  schedulePaymentReminders: vi.fn().mockResolvedValue(undefined),
  schedulePreDepartureEmail: vi.fn().mockResolvedValue(undefined),
  cancelBookingEmailJobs: vi.fn().mockResolvedValue(undefined),
}));

import prisma from '../../shared/database/prisma';
import { BookingsService } from './bookings.service';
import type { JwtPayload } from '../auth/auth.types';

const managerUser: JwtPayload = {
  sub: 'user-manager-001',
  email: 'manager@eurotrips.ua',
  role: UserRole.manager,
  agentId: null,
  agentType: null,
  networkId: null,
  touristId: null,
};

const mockBooking = {
  id: 'booking-001',
  status: BookingStatus.new,
  agentId: null,
  paymentStatus: 'unpaid',
  balanceDeadline: null,
  tour: { departureDate: new Date('2026-12-01') },
};

describe('BookingsService.changeStatus()', () => {
  let service: BookingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BookingsService();
  });

  it('реально створює audit_log запис з коректними полями Prisma-моделі AuditLog', async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValueOnce(mockBooking as any);
    vi.mocked(prisma.booking.update).mockResolvedValueOnce({
      ...mockBooking,
      status: BookingStatus.in_work,
    } as any);

    await service.changeStatus(
      'booking-001',
      { status: BookingStatus.in_work },
      managerUser,
    );

    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
    const call = vi.mocked(prisma.auditLog.create).mock.calls[0][0] as any;

    // Поля, яких НЕ існує на AuditLog (entityType/entityId/details/severity/source) —
    // якщо хтось повернe стару розбіжність назад, цей тест впаде.
    expect(call.data).not.toHaveProperty('entityType');
    expect(call.data).not.toHaveProperty('entityId');
    expect(call.data).not.toHaveProperty('details');
    expect(call.data).not.toHaveProperty('severity');
    expect(call.data).not.toHaveProperty('source');

    // Реальні поля моделі AuditLog.
    expect(call.data).toMatchObject({
      userId: managerUser.sub,
      action: 'STATUS_CHANGE',
      tableName: 'bookings',
      recordId: 'booking-001',
      oldData: { status: BookingStatus.new },
      newData: { status: BookingStatus.in_work, reason: undefined },
    });
  });

  it('не ламає зміну статусу якщо запис в audit_log впав (catch внутрішній)', async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValueOnce(mockBooking as any);
    vi.mocked(prisma.booking.update).mockResolvedValueOnce({
      ...mockBooking,
      status: BookingStatus.in_work,
    } as any);
    vi.mocked(prisma.auditLog.create).mockRejectedValueOnce(new Error('db down'));

    await expect(
      service.changeStatus('booking-001', { status: BookingStatus.in_work }, managerUser),
    ).resolves.toBeDefined();
  });
});
