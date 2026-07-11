// ============================================================
// EUROTRIPS — useTourDrivers hook
// GET/POST/DELETE /tours/:id/drivers — призначення водіїв на тур (max 2)
// Відповідь — snake_case (preSerialization hook).
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Staff } from './useStaff';

export interface TourDriverAssignment {
  id: string;
  tour_id: string;
  staff_id: string;
  created_at: string;
  staff: Staff;
}

export function useTourDrivers(tourId: string) {
  return useQuery({
    queryKey: ['tours', tourId, 'drivers'],
    queryFn: async () => {
      const res = await api.get<{ data: TourDriverAssignment[] }>(`/tours/${tourId}/drivers`);
      return res.data.data;
    },
    enabled: !!tourId,
  });
}

export function useAssignDriver(tourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (staffId: string) => {
      const res = await api.post<{ data: TourDriverAssignment }>(`/tours/${tourId}/drivers`, { staffId });
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours', tourId, 'drivers'] }),
  });
}

export function useUnassignDriver(tourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (staffId: string) => {
      await api.delete(`/tours/${tourId}/drivers/${staffId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours', tourId, 'drivers'] }),
  });
}
