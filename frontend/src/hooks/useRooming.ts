// ============================================================
// EUROTRIPS — useRooming hook
// PATCH /tours/:id/tourist/:touristId/room (OPS-14/15)
// PATCH /tours/:id/hotels/:hotelBookingId/finalize-rooming (OPS-16)
// Тіла запитів — camelCase (Zod-схема без трансформації).
// ============================================================

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export interface AssignRoomPayload {
  actualRoomNumber: string | null;
  actualRoomType?: 'twin' | 'double' | 'triple' | 'single' | 'no_preference' | null;
  mealType?: 'RO' | 'BB' | 'HB' | 'FB' | null;
}

export function useAssignRoom(tourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ touristId, payload }: { touristId: string; payload: AssignRoomPayload }) => {
      const res = await api.patch(`/tours/${tourId}/tourist/${touristId}/room`, payload);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours', tourId, 'tourists'] }),
  });
}

export function useFinalizeRooming(tourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (hotelBookingId: string) => {
      const res = await api.patch(`/tours/${tourId}/hotels/${hotelBookingId}/finalize-rooming`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tours', tourId, 'hotels'] });
      queryClient.invalidateQueries({ queryKey: ['tours', tourId, 'tourists'] });
    },
  });
}
