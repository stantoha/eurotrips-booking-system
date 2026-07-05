// =============================================================================
// EUROTRIPS — Tour Activities Schemas (Zod)
// OPS-11 (створення), OPS-12 (гід), OPS-13 (підтвердження)
// =============================================================================

import { z } from 'zod';

/// OPS-12: формат +38XXXXXXXXXX або міжнародний +XX...
const GUIDE_PHONE_REGEX = /^\+\d{10,15}$/;

export const ACTIVITY_STATUSES = ['очікує', 'затверджено', 'скасовано'] as const;

export const CreateActivitySchema = z.object({
  city: z.string().min(1).max(100),
  /// "Основна" | "Додаткова" | "ДОП" — вільний текст за моделлю
  programType: z.string().min(1).max(50),
  activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат: YYYY-MM-DD'),
  activityName: z.string().min(1).max(255),
  /// HH:MM
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Формат: HH:MM').optional(),
  guideName: z.string().max(100).optional(),
  guidePhone: z.string().regex(GUIDE_PHONE_REGEX, 'Формат телефону: +380XXXXXXXXX').optional(),
  costEur: z.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
});

export const PatchActivitySchema = z.object({
  city: z.string().min(1).max(100).optional(),
  programType: z.string().min(1).max(50).optional(),
  activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  activityName: z.string().min(1).max(255).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  guideName: z.string().max(100).optional(),
  guidePhone: z.string().regex(GUIDE_PHONE_REGEX, 'Формат телефону: +380XXXXXXXXX').optional(),
  costEur: z.number().nonnegative().optional(),
  status: z.enum(ACTIVITY_STATUSES).optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateActivityDto = z.infer<typeof CreateActivitySchema>;
export type PatchActivityDto = z.infer<typeof PatchActivitySchema>;
