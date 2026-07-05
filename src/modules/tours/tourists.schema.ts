// =============================================================================
// EUROTRIPS — Tour Tourists Query Schema (Zod)
// =============================================================================

import { z } from 'zod';

export const TourTouristsQuerySchema = z.object({
  missingPassport: z.string().optional().transform((v) => v === 'true'),
  hasDebt: z.string().optional().transform((v) => v === 'true'),
  noRoom: z.string().optional().transform((v) => v === 'true'),
});

export type TourTouristsQueryDto = z.infer<typeof TourTouristsQuerySchema>;
