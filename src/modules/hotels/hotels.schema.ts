// =============================================================================
// EUROTRIPS — Hotels Schema (Zod)
// =============================================================================

import { z } from 'zod';

export const HotelListQuerySchema = z.object({
  country: z.string().optional(),
  city:    z.string().optional(),
  stars:   z.coerce.number().min(0).max(5).optional(),
  search:  z.string().optional(),
  page:    z.coerce.number().int().min(1).default(1),
  limit:   z.coerce.number().int().min(1).max(100).default(20),
  sortBy:    z.enum(['name', 'city', 'stars', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type HotelListQueryDto = z.infer<typeof HotelListQuerySchema>;
