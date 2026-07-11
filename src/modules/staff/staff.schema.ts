// =============================================================================
// EUROTRIPS — Staff Schemas (Zod)
// Турлідери, гіди, водії, координатори
// =============================================================================

import { z } from 'zod';

const PHONE_REGEX = /^\+\d{10,15}$/;

export const STAFF_ROLES = ['tour_leader', 'guide', 'driver', 'coordinator'] as const;

export const StaffListQuerySchema = z.object({
  role: z.enum(STAFF_ROLES).optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const CreateStaffSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(STAFF_ROLES),
  phone: z.string().regex(PHONE_REGEX, 'Формат телефону: +380XXXXXXXXX').optional(),
  email: z.string().email().optional(),
  languages: z.array(z.string()).optional(),
  specializations: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional(),
});

export const PatchStaffSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  role: z.enum(STAFF_ROLES).optional(),
  phone: z.string().regex(PHONE_REGEX, 'Формат телефону: +380XXXXXXXXX').optional(),
  email: z.string().email().optional(),
  languages: z.array(z.string()).optional(),
  specializations: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  notes: z.string().max(2000).optional(),
});

export type StaffListQueryDto = z.infer<typeof StaffListQuerySchema>;
export type CreateStaffDto = z.infer<typeof CreateStaffSchema>;
export type PatchStaffDto = z.infer<typeof PatchStaffSchema>;
