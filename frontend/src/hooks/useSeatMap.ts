// ============================================================
// EUROTRIPS — hooks/useSeatMap.ts
// GET /bookings/:id/seat-map — схема місць в автобусі (OPS-03)
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { SeatMap } from '../types';

export function useSeatMap(bookingId: string | undefined) {
  return useQuery({
    queryKey: ['bookings', bookingId, 'seat-map'],
    queryFn: async () => {
      const { data } = await api.get<{ data: SeatMap }>(`/bookings/${bookingId}/seat-map`);
      return data.data;
    },
    enabled: !!bookingId,
    staleTime: 15_000,
  });
}

export default useSeatMap;
