// =============================================================================
// EUROTRIPS — Carriers/Buses Schemas (Zod)
// Перевізники та їх автобуси (для роботи логіста)
// =============================================================================

import { z } from 'zod';

const PHONE_REGEX = /^\+\d{10,15}$/;

export const CarrierListQuerySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const CreateCarrierSchema = z.object({
  name: z.string().min(1).max(255),
  contactName: z.string().max(255).optional(),
  phone: z.string().regex(PHONE_REGEX, 'Формат телефону: +380XXXXXXXXX').optional(),
  email: z.string().email().optional(),
  notes: z.string().max(2000).optional(),
});

export const PatchCarrierSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  contactName: z.string().max(255).optional(),
  phone: z.string().regex(PHONE_REGEX, 'Формат телефону: +380XXXXXXXXX').optional(),
  email: z.string().email().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  notes: z.string().max(2000).optional(),
});

export const CreateBusSchema = z.object({
  brand: z.string().min(1).max(100),
  plateNumber: z.string().min(1).max(20),
  seatsCount: z.number().int().positive(),
  notes: z.string().max(2000).optional(),
});

export const PatchBusSchema = z.object({
  brand: z.string().min(1).max(100).optional(),
  plateNumber: z.string().min(1).max(20).optional(),
  seatsCount: z.number().int().positive().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  notes: z.string().max(2000).optional(),
});

export type CarrierListQueryDto = z.infer<typeof CarrierListQuerySchema>;
export type CreateCarrierDto = z.infer<typeof CreateCarrierSchema>;
export type PatchCarrierDto = z.infer<typeof PatchCarrierSchema>;
export type CreateBusDto = z.infer<typeof CreateBusSchema>;
export type PatchBusDto = z.infer<typeof PatchBusSchema>;
