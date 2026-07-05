// =============================================================================
// EUROTRIPS — Transport Booking Schemas (Zod)
// OPS-08 (реєстрація перевізника), OPS-09 (авторозрахунок), OPS-10 (підтвердження)
// =============================================================================

import { z } from 'zod';

export const TRANSPORT_STATUSES = ['planned', 'confirmed', 'completed', 'cancelled'] as const;

export const CreateTransportSchema = z.object({
  transportType: z.string().min(1).max(50),
  connectionType: z.string().max(50).optional(),
  carrierName: z.string().max(255).optional(),
  busBrand: z.string().max(100).optional(),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  kmGoogle: z.number().nonnegative().optional(),
  kmExtras: z.number().nonnegative().optional(),
  ratePerKm: z.number().nonnegative().optional(),
  fuelSurcharge: z.number().nonnegative().optional(),
  wifiOrDeliveryFee: z.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
});

export const PatchTransportSchema = z.object({
  transportType: z.string().min(1).max(50).optional(),
  connectionType: z.string().max(50).optional(),
  carrierName: z.string().max(255).optional(),
  busBrand: z.string().max(100).optional(),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  kmGoogle: z.number().nonnegative().optional(),
  kmExtras: z.number().nonnegative().optional(),
  ratePerKm: z.number().nonnegative().optional(),
  fuelSurcharge: z.number().nonnegative().optional(),
  wifiOrDeliveryFee: z.number().nonnegative().optional(),
  /// OPS-10: аванс перевізнику
  paidAdvanceEur: z.number().nonnegative().optional(),
  paidCashEur: z.number().nonnegative().optional(),
  status: z.enum(TRANSPORT_STATUSES).optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateTransportDto = z.infer<typeof CreateTransportSchema>;
export type PatchTransportDto = z.infer<typeof PatchTransportSchema>;
