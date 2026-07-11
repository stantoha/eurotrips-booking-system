// =============================================================================
// EUROTRIPS — Staff Service
// Турлідери, гіди, водії, координатори. Soft-delete через status='inactive'.
// =============================================================================

import { Prisma } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { Errors } from '../../shared/utils/errors';
import type { StaffListQueryDto, CreateStaffDto, PatchStaffDto } from './staff.schema';

export class StaffService {

  // ── LIST ─────────────────────────────────────────────────────────────────
  async listStaff(query: StaffListQueryDto) {
    const { role, status, search, page, limit } = query;

    const where: Prisma.StaffWhereInput = {
      ...(role && { role }),
      ...(status ? { status } : { status: { not: 'inactive' } }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, staff] = await Promise.all([
      prisma.staff.count({ where }),
      prisma.staff.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: staff,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ── GET ONE ──────────────────────────────────────────────────────────────
  async getStaff(id: string) {
    const staff = await prisma.staff.findUnique({ where: { id } });
    if (!staff) throw Errors.notFound('Персонал', id);
    return staff;
  }

  // ── CREATE ───────────────────────────────────────────────────────────────
  async createStaff(dto: CreateStaffDto) {
    return prisma.staff.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        phone: dto.phone,
        email: dto.email,
        languages: dto.languages ?? [],
        specializations: dto.specializations ?? [],
        notes: dto.notes,
      },
    });
  }

  // ── PATCH ────────────────────────────────────────────────────────────────
  async patchStaff(id: string, dto: PatchStaffDto) {
    const existing = await prisma.staff.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound('Персонал', id);

    return prisma.staff.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.languages !== undefined && { languages: dto.languages }),
        ...(dto.specializations !== undefined && { specializations: dto.specializations }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  // ── SOFT DELETE ──────────────────────────────────────────────────────────
  async deactivateStaff(id: string) {
    const existing = await prisma.staff.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound('Персонал', id);

    await prisma.staff.update({ where: { id }, data: { status: 'inactive' } });
  }
}
