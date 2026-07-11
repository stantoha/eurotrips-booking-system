// =============================================================================
// EUROTRIPS — Tour Extras Schemas (Zod)
// ДОПи туру: тургід, парковки, в'їзди, подарунки, страхування, інше
// =============================================================================

import { z } from 'zod';

export const TOUR_EXTRA_STATUSES = ['planned', 'відбувся', 'відмінено'] as const;

export const CreateTourExtraSchema = z.object({
  connectionType: z.string().max(50).optional(),
  guideCost: z.number().nonnegative().optional(),
  parkingCost: z.number().nonnegative().optional(),
  cityEntriesCost: z.number().nonnegative().optional(),
  giftsCost: z.number().nonnegative().optional(),
  insuranceCost: z.number().nonnegative().optional(),
  otherCost: z.number().nonnegative().optional(),
  personsCount: z.number().int().positive().optional(),
  status: z.enum(TOUR_EXTRA_STATUSES).optional(),
  notes: z.string().max(2000).optional(),
});

export const PatchTourExtraSchema = CreateTourExtraSchema.partial();

export type CreateTourExtraDto = z.infer<typeof CreateTourExtraSchema>;
export type PatchTourExtraDto = z.infer<typeof PatchTourExtraSchema>;
