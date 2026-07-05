// ============================================================
// EUROTRIPS — useTourChecklist hook
// OPS-18: GET/PATCH /tours/:id/checklist
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export const CHECKLIST_ITEM_KEYS = [
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

export type ChecklistItemKey = (typeof CHECKLIST_ITEM_KEYS)[number];

export type TourChecklist = {
  id: string;
  tourId: string;
  readinessPercent: number;
} & Record<ChecklistItemKey, boolean>;

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
