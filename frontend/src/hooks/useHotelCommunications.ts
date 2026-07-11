// ============================================================
// EUROTRIPS — useHotelCommunications hook
// GET/POST /tours/:id/hotels/:hotelBookingId/communications
// Ручний лог листування логіста з готелем (не реальний SMTP).
// Відповідь — snake_case (preSerialization hook).
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export interface HotelCommunication {
  id: string;
  hotel_booking_id: string;
  channel: string;
  direction: 'outbound' | 'inbound';
  subject: string | null;
  body: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
}

export interface HotelCommunicationPayload {
  direction?: 'outbound' | 'inbound';
  subject?: string;
  body?: string;
}

export function useHotelCommunications(tourId: string, hotelBookingId: string) {
  return useQuery({
    queryKey: ['tours', tourId, 'hotels', hotelBookingId, 'communications'],
    queryFn: async () => {
      const res = await api.get<{ data: HotelCommunication[] }>(
        `/tours/${tourId}/hotels/${hotelBookingId}/communications`
      );
      return res.data.data;
    },
    enabled: !!tourId && !!hotelBookingId,
  });
}

export function useCreateHotelCommunication(tourId: string, hotelBookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: HotelCommunicationPayload) => {
      const res = await api.post<{ data: HotelCommunication }>(
        `/tours/${tourId}/hotels/${hotelBookingId}/communications`,
        payload
      );
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({
      queryKey: ['tours', tourId, 'hotels', hotelBookingId, 'communications'],
    }),
  });
}
