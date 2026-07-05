// ============================================================
// EUROTRIPS — useTourChecklist hook
// OPS-18: GET/PATCH /tours/:id/checklist
//
// Контракт: відповіді API — snake_case (preSerialization hook в app.ts,
// CLAUDE.md розділ 14). Тіло PATCH-запиту — camelCase (Zod-схема
// checklist.schema.ts не транформується). Тому `item` в PatchChecklistItem
// лишається camelCase, а поля відповіді TourChecklist — snake_case.
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

/** { camelCase-ключ для PATCH body, snake_case-поле у відповіді GET } */
export const CHECKLIST_ITEMS = [
  { key: 'transportConfirmed',      field: 'transport_confirmed' },
  { key: 'hotelsAllPaid',           field: 'hotels_all_paid' },
  { key: 'guidesAllConfirmed',      field: 'guides_all_confirmed' },
  { key: 'roomingFinalizedAndSent', field: 'rooming_finalized_and_sent' },
  { key: 'documentsGenerated',      field: 'documents_generated' },
  { key: 'touristsNotified',        field: 'tourists_notified' },
  { key: 'guideAssigned',           field: 'guide_assigned' },
  { key: 'emergencyContactsReady',  field: 'emergency_contacts_ready' },
  { key: 'finalLetterSent',         field: 'final_letter_sent' },
] as const;

export type ChecklistItemKey = (typeof CHECKLIST_ITEMS)[number]['key'];
export type ChecklistItemField = (typeof CHECKLIST_ITEMS)[number]['field'];

export type TourChecklist = {
  id: string;
  tour_id: string;
  readiness_percent: number;
} & Record<ChecklistItemField, boolean>;

export function useTourChecklist(tourId: string) {
  return useQuery({
    queryKey: ['tours', tourId, 'checklist'],
    queryFn: async () => {
      const res = await api.get<{ data: TourChecklist }>(`/tours/${tourId}/checklist`);
      return res.data.data;
    },
    enabled: !!tourId,
  });
}

export function usePatchChecklistItem(tourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, value }: { item: ChecklistItemKey; value: boolean }) => {
      const res = await api.patch<{ data: TourChecklist }>(`/tours/${tourId}/checklist`, { item, value });
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['tours', tourId, 'checklist'], data);
    },
  });
}
