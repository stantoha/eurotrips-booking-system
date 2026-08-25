// =============================================================================
// EUROTRIPS — Analytics Schema (Zod)
// =============================================================================

import { z } from 'zod';
import { TourStatus } from '@prisma/client';

export const AnalyticsPeriodQuerySchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo:   z.coerce.date().optional(),
});
export type AnalyticsPeriodQueryDto = z.infer<typeof AnalyticsPeriodQuerySchema>;

export const ToursLoadQuerySchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo:   z.coerce.date().optional(),
  status:   z.nativeEnum(TourStatus).optional(),
});
export type ToursLoadQueryDto = z.infer<typeof ToursLoadQuerySchema>;

export const AgentsTopQuerySchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo:   z.coerce.date().optional(),
  limit:    z.coerce.number().int().min(1).max(50).default(10),
});
export type AgentsTopQueryDto = z.infer<typeof AgentsTopQuerySchema>;

/** Тренд обороту по місяцях (RevenueTrendChart дизайн-системи) */
export const RevenueTrendQuerySchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo:   z.coerce.date().optional(),
  /** Скільки останніх місяців повернути, якщо період не вказано */
  months:   z.coerce.number().int().min(2).max(36).default(12),
});
export type RevenueTrendQueryDto = z.infer<typeof RevenueTrendQuerySchema>;
