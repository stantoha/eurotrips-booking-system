// =============================================================================
// EUROTRIPS — Tourists Schemas (Zod)
// =============================================================================

import { z } from 'zod';

export const TouristListQuerySchema = z.object({
  search: z.string().max(100).optional(),
  page:   z.string().optional().transform(v => v ? parseInt(v, 10) : 1).pipe(z.number().int().min(1)),
  limit:  z.string().optional().transform(v => v ? parseInt(v, 10) : 20).pipe(z.number().int().min(1).max(100)),
});

export const CreateTouristSchema = z.object({
  firstName:   z.string().min(1, "Вкажіть ім'я").max(100),
  lastName:    z.string().min(1, 'Вкажіть прізвище').max(100),
  email:       z.string().email('Некоректний email').max(255).optional().or(z.literal('')),
  phone:       z.string().max(30).optional(),
  nationality: z.string().max(100).optional(),
});

export type TouristListQueryDto = z.infer<typeof TouristListQuerySchema>;
export type CreateTouristDto    = z.infer<typeof CreateTouristSchema>;
