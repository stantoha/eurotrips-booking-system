// =============================================================================
// EUROTRIPS — Tour Checklist Schemas (Zod)
// OPS-18: 9-пунктний операційний чекліст готовності виїзду
// =============================================================================

import { z } from 'zod';

/** 9 пунктів чекліста — точні назви полів моделі TourChecklist */
export const CHECKLIST_ITEMS = [
  'transportConfirmed',
  'hotelsAllPaid',
  'guidesAllConfirmed',
  'roomingFinalizedAndSent',
  'documentsGenerated',
  'touristsNotified',
  'guideAssigned',
  'emergencyContactsReady',
  'finalLetterSent',
] as const;

export type ChecklistItem = (typeof CHECKLIST_ITEMS)[number];

export const PatchChecklistItemSchema = z.object({
  item: z.enum(CHECKLIST_ITEMS),
  value: z.boolean(),
});

export type PatchChecklistItemDto = z.infer<typeof PatchChecklistItemSchema>;
