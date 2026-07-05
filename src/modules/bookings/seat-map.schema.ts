// =============================================================================
// EUROTRIPS — Seat Map & Preferences Schemas (Zod)
// OPS-03 / BR-12: self-service туриста — побажання по кімнаті та місцю
// =============================================================================

import { z } from 'zod';
import { RoomType } from '@prisma/client';

export const PatchPreferencesSchema = z.object({
  preferredRoomType: z.nativeEnum(RoomType).optional(),
  /// NULL знімає побажання по місцю
  busSeaNumber: z.number().int().min(1).nullable().optional(),
  roommatePreference: z.string().max(1000).optional(),
});

export type PatchPreferencesDto = z.infer<typeof PatchPreferencesSchema>;
