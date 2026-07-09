// =============================================================================
// EUROTRIPS — Room Structure Service Unit Tests (BR-09/BR-10, OPS-01/09/10)
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoomingStatus, UserRole } from '@prisma/client';

// ── Моки ──────────────────────────────────────────────────────────────────
vi.mock('../../shared/database/prisma', () => ({
  default: {
    tour: {
      findFirst: vi.fn(),
    },
    hotelBooking: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

import prisma from '../../shared/database/prisma';
import { RoomStructureService } from './room-structure.service';
import type { JwtPayload } from '../auth/auth.types';

const opsUser: JwtPayload = {
  sub: 'user-ops-001', email: 'ops@eurotrips.ua', role: UserRole.ops,
  agentId: null, agentType: null, networkId: null, touristId: null,
};
const adminUser: JwtPayload = {
  sub: 'user-admin-001', email: 'admin@eurotrips.ua', role: UserRole.admin,
  agentId: null, agentType: null, networkId: null, touristId: null,
};

const mockTour = { id: 'tour-001', totalSeats: 20, isArchived: false };

function mockHotelBooking(overrides: Partial<{ structureStatus: RoomingStatus }> = {}) {
  return {
    id: 'hb-001',
    tourId: 'tour-001',
    plannedTwin: 0,
    plannedDouble: 0,
    plannedTriple: 0,
    plannedSingle: 0,
    structureStatus: RoomingStatus.draft,
    ...overrides,
  };
}

describe('RoomStructureService.setStructure() — BR-10 (місткість)', () => {
  let service: RoomStructureService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RoomStructureService();
  });

  it('кидає 422 ROOM_CAPACITY_EXCEEDED якщо sum(twin×2+double×2+triple×3+single×1) > totalSeats', async () => {
    vi.mocked(prisma.tour.findFirst).mockResolvedValueOnce(mockTour as any);
    vi.mocked(prisma.hotelBooking.findFirst).mockResolvedValueOnce(mockHotelBooking() as any);

    // 6×2 + 3×2 + 2×3 + 1×1 = 12+6+6+1 = 25 > 20 totalSeats
    await expect(
      service.setStructure(
        'tour-001',
        { hotelBookingId: 'hb-001', plannedTwin: 6, plannedDouble: 3, plannedTriple: 2, plannedSingle: 1 },
        opsUser,
      ),
    ).rejects.toMatchObject({ code: 'ROOM_CAPACITY_EXCEEDED', statusCode: 422 });

    expect(prisma.hotelBooking.update).not.toHaveBeenCalled();
  });

  it('дозволяє структуру РІВНО на межі totalSeats (не строго менше)', async () => {
    vi.mocked(prisma.tour.findFirst).mockResolvedValueOnce(mockTour as any);
    vi.mocked(prisma.hotelBooking.findFirst).mockResolvedValueOnce(mockHotelBooking() as any);
    vi.mocked(prisma.hotelBooking.update).mockResolvedValueOnce({} as any);

    // 10×2 = 20 = totalSeats
    await expect(
      service.setStructure(
        'tour-001',
        { hotelBookingId: 'hb-001', plannedTwin: 10, plannedDouble: 0, plannedTriple: 0, plannedSingle: 0 },
        opsUser,
      ),
    ).resolves.toBeDefined();

    expect(prisma.hotelBooking.update).toHaveBeenCalledOnce();
  });

  it('успішно оновлює структуру в межах ліміту (draft, ops)', async () => {
    vi.mocked(prisma.tour.findFirst).mockResolvedValueOnce(mockTour as any);
    vi.mocked(prisma.hotelBooking.findFirst).mockResolvedValueOnce(mockHotelBooking() as any);
    vi.mocked(prisma.hotelBooking.update).mockResolvedValueOnce({} as any);

    await service.setStructure(
      'tour-001',
      { hotelBookingId: 'hb-001', plannedTwin: 5, plannedDouble: 0, plannedTriple: 0, plannedSingle: 0 },
      opsUser,
    );

    expect(prisma.hotelBooking.update).toHaveBeenCalledWith({
      where: { id: 'hb-001' },
      data: { plannedTwin: 5, plannedDouble: 0, plannedTriple: 0, plannedSingle: 0 },
    });
  });

  it('кидає 404 якщо тур не знайдено', async () => {
    vi.mocked(prisma.tour.findFirst).mockResolvedValueOnce(null);

    await expect(
      service.setStructure('tour-999', { hotelBookingId: 'hb-001', plannedTwin: 0, plannedDouble: 0, plannedTriple: 0, plannedSingle: 0 }, opsUser),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('кидає 404 якщо готельне бронювання не знайдено (або належить іншому туру)', async () => {
    vi.mocked(prisma.tour.findFirst).mockResolvedValueOnce(mockTour as any);
    vi.mocked(prisma.hotelBooking.findFirst).mockResolvedValueOnce(null);

    await expect(
      service.setStructure('tour-001', { hotelBookingId: 'hb-999', plannedTwin: 0, plannedDouble: 0, plannedTriple: 0, plannedSingle: 0 }, opsUser),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('RoomStructureService.setStructure() — OPS-10 (тільки admin після approved)', () => {
  let service: RoomStructureService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RoomStructureService();
  });

  it('забороняє ops редагувати структуру зі статусом approved (403)', async () => {
    vi.mocked(prisma.tour.findFirst).mockResolvedValueOnce(mockTour as any);
    vi.mocked(prisma.hotelBooking.findFirst).mockResolvedValueOnce(
      mockHotelBooking({ structureStatus: RoomingStatus.approved }) as any,
    );

    await expect(
      service.setStructure(
        'tour-001',
        { hotelBookingId: 'hb-001', plannedTwin: 1, plannedDouble: 0, plannedTriple: 0, plannedSingle: 0 },
        opsUser,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });

    expect(prisma.hotelBooking.update).not.toHaveBeenCalled();
  });

  it('дозволяє admin редагувати структуру зі статусом approved', async () => {
    vi.mocked(prisma.tour.findFirst).mockResolvedValueOnce(mockTour as any);
    vi.mocked(prisma.hotelBooking.findFirst).mockResolvedValueOnce(
      mockHotelBooking({ structureStatus: RoomingStatus.approved }) as any,
    );
    vi.mocked(prisma.hotelBooking.update).mockResolvedValueOnce({} as any);

    await expect(
      service.setStructure(
        'tour-001',
        { hotelBookingId: 'hb-001', plannedTwin: 1, plannedDouble: 0, plannedTriple: 0, plannedSingle: 0 },
        adminUser,
      ),
    ).resolves.toBeDefined();

    expect(prisma.hotelBooking.update).toHaveBeenCalledOnce();
  });

  it('забороняє ops редагувати структуру зі статусом final (403)', async () => {
    vi.mocked(prisma.tour.findFirst).mockResolvedValueOnce(mockTour as any);
    vi.mocked(prisma.hotelBooking.findFirst).mockResolvedValueOnce(
      mockHotelBooking({ structureStatus: RoomingStatus.final }) as any,
    );

    await expect(
      service.setStructure(
        'tour-001',
        { hotelBookingId: 'hb-001', plannedTwin: 1, plannedDouble: 0, plannedTriple: 0, plannedSingle: 0 },
        opsUser,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
  });
});

describe('RoomStructureService.approveStructure()', () => {
  let service: RoomStructureService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RoomStructureService();
  });

  it('переводить draft → approved і записує structureApprovedBy/At', async () => {
    vi.mocked(prisma.hotelBooking.findFirst).mockResolvedValueOnce(mockHotelBooking() as any);
    vi.mocked(prisma.hotelBooking.update).mockResolvedValueOnce({} as any);

    await service.approveStructure('tour-001', { hotelBookingId: 'hb-001' }, adminUser);

    expect(prisma.hotelBooking.update).toHaveBeenCalledWith({
      where: { id: 'hb-001' },
      data: expect.objectContaining({
        structureStatus: RoomingStatus.approved,
        structureApprovedBy: adminUser.sub,
      }),
    });
  });

  it('кидає 409 CONFLICT якщо структура вже не в draft (approved/final)', async () => {
    vi.mocked(prisma.hotelBooking.findFirst).mockResolvedValueOnce(
      mockHotelBooking({ structureStatus: RoomingStatus.approved }) as any,
    );

    await expect(
      service.approveStructure('tour-001', { hotelBookingId: 'hb-001' }, adminUser),
    ).rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 });

    expect(prisma.hotelBooking.update).not.toHaveBeenCalled();
  });
});

describe('RoomStructureService.finalizeStructure()', () => {
  let service: RoomStructureService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RoomStructureService();
  });

  it('переводить approved → final', async () => {
    vi.mocked(prisma.hotelBooking.findFirst).mockResolvedValueOnce(
      mockHotelBooking({ structureStatus: RoomingStatus.approved }) as any,
    );
    vi.mocked(prisma.hotelBooking.update).mockResolvedValueOnce({} as any);

    await service.finalizeStructure('tour-001', { hotelBookingId: 'hb-001' }, opsUser);

    expect(prisma.hotelBooking.update).toHaveBeenCalledWith({
      where: { id: 'hb-001' },
      data: { structureStatus: RoomingStatus.final },
    });
  });

  it('кидає 409 CONFLICT якщо структура ще в draft (не approved)', async () => {
    vi.mocked(prisma.hotelBooking.findFirst).mockResolvedValueOnce(mockHotelBooking() as any);

    await expect(
      service.finalizeStructure('tour-001', { hotelBookingId: 'hb-001' }, opsUser),
    ).rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 });

    expect(prisma.hotelBooking.update).not.toHaveBeenCalled();
  });
});
