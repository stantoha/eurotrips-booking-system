// =============================================================================
// EUROTRIPS — Leads Schemas (Zod)
// =============================================================================

import { z } from 'zod';
import { LeadSource, LeadStatus } from '@prisma/client';

// ── Список ────────────────────────────────────────────────────────────────────

export const LeadListQuerySchema = z.object({
  status:     z.nativeEnum(LeadStatus).optional(),
  source:     z.nativeEnum(LeadSource).optional(),
  managerId:  z.string().uuid().optional(),
  tourId:     z.string().uuid().optional(),
  search:     z.string().max(100).optional(),
  dateFrom:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page:  z.string().optional().transform(v => v ? parseInt(v, 10) : 1).pipe(z.number().int().min(1)),
  limit: z.string().optional().transform(v => v ? parseInt(v, 10) : 20).pipe(z.number().int().min(1).max(100)),
});

// ── Створити лід ──────────────────────────────────────────────────────────────

export const CreateLeadSchema = z.object({
  source:       z.nativeEnum(LeadSource),
  tourId:       z.string().uuid().optional(),
  agentId:      z.string().uuid().optional(),
  managerId:    z.string().uuid().optional(),

  // Турист — або вже існуючий, або нові дані для створення
  touristId:    z.string().uuid().optional(),
  tourist: z.object({
    firstName:  z.string().min(1).max(100),
    lastName:   z.string().min(1).max(100),
    email:      z.string().email().optional(),
    phone:      z.string().max(30).optional(),
  }).optional(),

  interestNote: z.string().max(2000).optional(),
  budget:       z.number().positive().optional(),
  personsCount: z.number().int().min(1).optional(),
  nextActionAt: z.string().datetime().optional(),
  notes:        z.string().max(2000).optional(),
}).refine(
  d => d.touristId || d.tourist,
  { message: 'Вкажіть touristId або дані туриста (tourist)' }
);

// ── Оновити лід ───────────────────────────────────────────────────────────────

export const UpdateLeadSchema = z.object({
  status:       z.nativeEnum(LeadStatus).optional(),
  tourId:       z.string().uuid().optional().nullable(),
  managerId:    z.string().uuid().optional(),
  agentId:      z.string().uuid().optional().nullable(),
  interestNote: z.string().max(2000).optional(),
  budget:       z.number().positive().optional(),
  personsCount: z.number().int().min(1).optional(),
  nextActionAt: z.string().datetime().optional().nullable(),
  lossReason:   z.string().max(255).optional(),
  notes:        z.string().max(2000).optional(),
});

// ── Конвертувати в бронювання ─────────────────────────────────────────────────

export const ConvertLeadSchema = z.object({
  tourId:            z.string().uuid({ message: 'Оберіть тур для бронювання' }),
  bookingType:       z.enum(['direct', 'agent', 'corporate', 'group']).default('direct'),
  personsCount:      z.number().int().min(1).optional(),
  totalAmount:       z.number().positive(),
  depositAmount:     z.number().positive(),
  depositDeadline:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  balanceDeadline:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  agentId:           z.string().uuid().optional(),
  comment:           z.string().max(2000).optional(),
});

export type LeadListQueryDto  = z.infer<typeof LeadListQuerySchema>;
export type CreateLeadDto     = z.infer<typeof CreateLeadSchema>;
export type UpdateLeadDto     = z.infer<typeof UpdateLeadSchema>;
export type ConvertLeadDto    = z.infer<typeof ConvertLeadSchema>;
