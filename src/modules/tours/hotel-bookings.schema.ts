// =============================================================================
// EUROTRIPS — Hotel Bookings Schemas (Zod)
// OPS-04 (додати готель), OPS-05 (дедлайн опції), OPS-06 (депозит/фінал)
// =============================================================================

import { z } from 'zod';

/// OPS-04 edge case: якщо готелю немає в базі — приймаємо назву вручну (free-text fallback)
export const CreateHotelBookingSchema = z.object({
  hotelId: z.string().uuid().optional(),
  hotelName: z.string().min(1).max(255).optional(),
  hotelCity: z.string().min(1).max(100).optional(),
  hotelCountry: z.string().min(1).max(100).optional(),
  city: z.string().min(1).max(100),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат: YYYY-MM-DD'),
  nightsCount: z.number().int().min(1),
  priceTwin: z.number().nonnegative().optional(),
  qtyTwin: z.number().int().nonnegative().optional(),
  priceDbl: z.number().nonnegative().optional(),
  qtyDbl: z.number().int().nonnegative().optional(),
  priceTrpl: z.number().nonnegative().optional(),
  qtyTrpl: z.number().int().nonnegative().optional(),
  priceSngl: z.number().nonnegative().optional(),
  qtySngl: z.number().int().nonnegative().optional(),
  budgetPerNight: z.number().nonnegative().optional(),
  optionDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(
  (d) => d.hotelId || d.hotelName,
  { message: 'Вкажіть hotelId (з бази) або hotelName (вручну, якщо готелю немає в базі)', path: ['hotelId'] }
);

export const HOTEL_CONFIRMATION_STATUSES = ['searching', 'option', 'confirmed'] as const;
export const HOTEL_DEPOSIT_STATUSES = ['unpaid', 'paid'] as const;

export const PatchHotelBookingSchema = z.object({
  optionDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  confirmationStatus: z.enum(HOTEL_CONFIRMATION_STATUSES).optional(),
  depositAmount: z.number().nonnegative().optional(),
  depositStatus: z.enum(HOTEL_DEPOSIT_STATUSES).optional(),
  balanceAmount: z.number().nonnegative().optional(),
  /// OPS-06: фактично сплачена сума — наявність означає фінальний розрахунок закрито
  factAmountEur: z.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateHotelBookingDto = z.infer<typeof CreateHotelBookingSchema>;
export type PatchHotelBookingDto = z.infer<typeof PatchHotelBookingSchema>;
