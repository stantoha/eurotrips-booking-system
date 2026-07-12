// =============================================================================
// EUROTRIPS — Tours Schemas (Zod)
// =============================================================================

import { z } from 'zod';
import { TourStatus, TourType } from '@prisma/client';

// ── List query ────────────────────────────────────────────────────────────────

export const TourListQuerySchema = z.object({
  status: z.nativeEnum(TourStatus).optional(),
  tourType: z.nativeEnum(TourType).optional(),
  departureDateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат дати: YYYY-MM-DD')
    .optional(),
  departureDateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат дати: YYYY-MM-DD')
    .optional(),
  product: z.string().max(100).optional(),
  direction: z.string().max(100).optional(),
  departureCity: z.string().max(100).optional(),
  tags: z.string().optional(),
  availableOnly: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  sortBy: z
    .enum(['departureDate', 'basePrice', 'availableSeats', 'createdAt'])
    .optional()
    .default('departureDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

// ── Create ────────────────────────────────────────────────────────────────────

const CreateTourSchemaBase = z.object({
  code: z
    .string()
    .min(8, 'Код туру мінімум 8 символів')
    .max(20)
    .regex(/^[A-Z]{2,4}\d{8}$/, 'Формат коду: LPYYMMDDNN (напр. LP26010301)'),
  name: z.string().min(3, 'Назва занадто коротка').max(255),
  product: z.string().max(100).optional(),
  direction: z.string().max(100).optional(),
  countries: z.array(z.string().max(100)).min(1, 'Вкажіть хоча б одну країну'),
  tourType: z.nativeEnum(TourType),
  format: z.string().max(50).optional(),
  departureDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат: YYYY-MM-DD'),
  returnDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат: YYYY-MM-DD'),
  durationDays: z.number().int().min(1).max(90),
  departureCity: z.string().max(100).optional(),
  arrivalCity: z.string().max(100).optional(),

  // Комерційні
  basePrice: z.number().positive('Ціна має бути > 0'),
  currency: z.string().length(3).default('EUR'),
  depositAmount: z.number().positive().optional(),
  depositDeadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  cancelPolicyId: z.string().uuid().optional(),
  agentCommissionPct: z
    .number()
    .min(0)
    .max(1, 'Комісія має бути у форматі 0.14 (не 14)'),

  // Операційні
  totalSeats: z.number().int().min(1).max(500),
  guideId: z.string().uuid().optional(),
  costPrice: z.number().positive().optional(),
  included: z.string().max(2000).optional(),
  notIncluded: z.string().max(2000).optional(),

  // Маркетингові
  tags: z.array(z.string().max(50)).default([]),
  audience: z.string().max(100).optional(),
  difficulty: z.string().max(50).optional(),
  isFamily: z.boolean().default(false),
  isPremium: z.boolean().default(false),
  isCorporate: z.boolean().default(false),
  isFirstExperience: z.boolean().default(false),
  asanaLink: z.string().url().optional(),
});

export const CreateTourSchema = CreateTourSchemaBase.refine(
  (d) => new Date(d.returnDate) >= new Date(d.departureDate),
  { message: 'Дата повернення має бути не раніше дати виїзду', path: ['returnDate'] }
);

// ── Create departure (новий виїзд на базі існуючого туру, ADR-003 Tour=Departure) ──

export const CreateDepartureSchema = z.object({
  departureDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат: YYYY-MM-DD'),
  /// Опційні overrides — все інше копіюється з туру-шаблону
  totalSeats: z.number().int().min(1).max(500).optional(),
  basePrice: z.number().positive().optional(),
  costPrice: z.number().positive().optional(),
  agentCommissionPct: z.number().min(0).max(1).optional(),
  guideId: z.string().uuid().optional(),
});

// ── Update ────────────────────────────────────────────────────────────────────

export const UpdateTourSchema = CreateTourSchemaBase.partial().omit({ code: true });

// ── Change status ─────────────────────────────────────────────────────────────

const ALLOWED_STATUS_TRANSITIONS: Record<TourStatus, TourStatus[]> = {
  draft: [TourStatus.open],
  open: [TourStatus.active, TourStatus.cancelled],
  active: [TourStatus.almost_full, TourStatus.closed, TourStatus.cancelled],
  almost_full: [TourStatus.closed, TourStatus.active, TourStatus.cancelled],
  closed: [TourStatus.on_tour, TourStatus.cancelled],
  on_tour: [TourStatus.completed],
  completed: [],
  cancelled: [],
};

export const ChangeStatusSchema = z.object({
  status: z.nativeEnum(TourStatus),
  reason: z.string().max(500).optional(),
});

export { ALLOWED_STATUS_TRANSITIONS };

export type TourListQueryDto  = z.infer<typeof TourListQuerySchema>;
export type CreateTourDto     = z.infer<typeof CreateTourSchema>;
export type CreateDepartureDto = z.infer<typeof CreateDepartureSchema>;
export type UpdateTourDto     = z.infer<typeof UpdateTourSchema>;
export type ChangeStatusDto   = z.infer<typeof ChangeStatusSchema>;
