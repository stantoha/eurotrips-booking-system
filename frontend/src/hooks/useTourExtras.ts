// ============================================================
// EUROTRIPS — useTourExtras hook
// GET/POST/PATCH/DELETE /tours/:id/extras — ДОПи туру
// Відповідь — snake_case (preSerialization hook).
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export interface TourExtra {
  id: string;
  tour_id: string;
  connection_type: string | null;
  guide_cost: number | null;
  parking_cost: number | null;
  city_entries_cost: number | null;
  gifts_cost: number | null;
  insurance_cost: number | null;
  other_cost: number | null;
  total_cost: number | null;
  persons_count: number | null;
  status: string | null;
  notes: string | null;
}

/** Тіло POST/PATCH-запитів — camelCase (Zod-схема без трансформації) */
export interface TourExtraPayload {
  connectionType?: string;
  guideCost?: number;
  parkingCost?: number;
  cityEntriesCost?: number;
  giftsCost?: number;
  insuranceCost?: number;
  otherCost?: number;
  personsCount?: number;
  status?: 'planned' | 'відбувся' | 'відмінено';
  notes?: string;
}

export function useTourExtras(tourId: string) {
  return useQuery({
    queryKey: ['tours', tourId, 'extras'],
    queryFn: async () => {
      const res = await api.get<{ data: TourExtra[] }>(`/tours/${tourId}/extras`);
      return res.data.data;
    },
    enabled: !!tourId,
  });
}

export function useCreateTourExtra(tourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TourExtraPayload) => {
      const res = await api.post<{ data: TourExtra }>(`/tours/${tourId}/extras`, payload);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours', tourId, 'extras'] }),
  });
}

export function usePatchTourExtra(tourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ extraId, payload }: { extraId: string; payload: TourExtraPayload }) => {
      const res = await api.patch<{ data: TourExtra }>(`/tours/${tourId}/extras/${extraId}`, payload);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours', tourId, 'extras'] }),
  });
}

export function useCancelTourExtra(tourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (extraId: string) => {
      await api.delete(`/tours/${tourId}/extras/${extraId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours', tourId, 'extras'] }),
  });
}
