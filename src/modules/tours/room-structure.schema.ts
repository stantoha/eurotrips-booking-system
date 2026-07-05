// =============================================================================
// EUROTRIPS — Room Structure Schemas (Zod)
// OPS-01/OPS-10: структура номерів по готелю в межах туру
// =============================================================================

import { z } from 'zod';

export const SetRoomStructureSchema = z.object({
  hotelBookingId: z.string().uuid(),
  plannedTwin: z.number().int().min(0).default(0),
  plannedDouble: z.number().int().min(0).default(0),
  plannedTriple: z.number().int().min(0).default(0),
  plannedSingle: z.number().int().min(0).default(0),
});

export const ApproveRoomStructureSchema = z.object({
  hotelBookingId: z.string().uuid(),
});

export const FinalizeRoomStructureSchema = z.object({
  hotelBookingId: z.string().uuid(),
});

export type SetRoomStructureDto = z.infer<typeof SetRoomStructureSchema>;
export type ApproveRoomStructureDto = z.infer<typeof ApproveRoomStructureSchema>;
export type FinalizeRoomStructureDto = z.infer<typeof FinalizeRoomStructureSchema>;
