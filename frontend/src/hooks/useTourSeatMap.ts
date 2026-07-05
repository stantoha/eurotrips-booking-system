// ============================================================
// EUROTRIPS — useTourSeatMap hook
// GET /tours/:id/seat-map + PATCH /tours/:id/tourist/:touristId/seat (OPS-17)
// Відповідь — snake_case (preSerialization hook).
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export interface TourSeat {
  seat_number: number;
  is_occupied: boolean;
  tourist_id: string | null;
  tourist_name: string | null;
}

export interface TourSeatMap {
  tour_id: string;
  total_seats: number;
  seats: TourSeat[];
}

export function useTourSeatMap(tourId: string) {
  return useQuery({
    queryKey: ['tours', tourId, 'seat-map'],
    queryFn: async () => {
      const res = await api.get<{ data: TourSeatMap }>(`/tours/${tourId}/seat-map`);
      return res.data.data;
    },
    enabled: !!tourId,
  });
}

export function useAssignSeat(tourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ touristId, seatNumber }: { touristId: string; seatNumber: number | null }) => {
      const res = await api.patch(`/tours/${tourId}/tourist/${touristId}/seat`, { seatNumber });
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours', tourId, 'seat-map'] }),
  });
}
