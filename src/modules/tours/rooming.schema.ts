// =============================================================================
// EUROTRIPS — Rooming (факт-розселення) Schemas (Zod)
// OPS-14/15: призначення кімнати + харчування туристу
// OPS-16: фіналізація румінгу
// =============================================================================

import { z } from 'zod';
import { RoomType, MealType } from '@prisma/client';

export const AssignRoomSchema = z.object({
  actualRoomNumber: z.string().max(20).nullable(),
  actualRoomType: z.nativeEnum(RoomType).nullable().optional(),
  mealType: z.nativeEnum(MealType).nullable().optional(),
  roommatePreference: z.string().max(1000).optional(),
});

export type AssignRoomDto = z.infer<typeof AssignRoomSchema>;
