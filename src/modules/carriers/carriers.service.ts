// =============================================================================
// EUROTRIPS — Carriers/Buses Service
// Soft-delete: status='inactive' (CLAUDE.md §10 — без фізичного видалення).
// =============================================================================

import { Prisma } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { Errors } from '../../shared/utils/errors';
import type {
  CarrierListQueryDto, CreateCarrierDto, PatchCarrierDto, CreateBusDto, PatchBusDto,
} from './carriers.schema';

export class CarriersService {

  // ── CARRIERS ─────────────────────────────────────────────────────────────
  async listCarriers(query: CarrierListQueryDto) {
    const { search, status, page, limit } = query;

    const where: Prisma.CarrierWhereInput = {
      ...(status ? { status } : { status: { not: 'inactive' } }),
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };

    const [total, carriers] = await Promise.all([
      prisma.carrier.count({ where }),
      prisma.carrier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { buses: true },
      }),
    ]);

    return {
      data: carriers,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async getCarrier(id: string) {
    const carrier = await prisma.carrier.findUnique({ where: { id }, include: { buses: true } });
    if (!carrier) throw Errors.notFound('Перевізник', id);
    return carrier;
  }

  async createCarrier(dto: CreateCarrierDto) {
    return prisma.carrier.create({ data: dto });
  }

  async patchCarrier(id: string, dto: PatchCarrierDto) {
    const existing = await prisma.carrier.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound('Перевізник', id);

    return prisma.carrier.update({ where: { id }, data: dto });
  }

  // ── BUSES ────────────────────────────────────────────────────────────────
  async listBuses(carrierId: string) {
    const carrier = await prisma.carrier.findUnique({ where: { id: carrierId } });
    if (!carrier) throw Errors.notFound('Перевізник', carrierId);

    return prisma.bus.findMany({ where: { carrierId }, orderBy: { brand: 'asc' } });
  }

  async createBus(carrierId: string, dto: CreateBusDto) {
    const carrier = await prisma.carrier.findUnique({ where: { id: carrierId } });
    if (!carrier) throw Errors.notFound('Перевізник', carrierId);

    return prisma.bus.create({ data: { carrierId, ...dto } });
  }

  async patchBus(id: string, dto: PatchBusDto) {
    const existing = await prisma.bus.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound('Автобус', id);

    return prisma.bus.update({ where: { id }, data: dto });
  }
}
