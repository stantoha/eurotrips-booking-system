// ============================================================
// EUROTRIPS — useBookingCommunications hook
// GET/POST /bookings/:id/communications — лог повідомлень
// Відповідь — snake_case (preSerialization hook).
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export type CommunicationChannel = 'email' | 'sms' | 'telegram' | 'viber' | 'internal';

export interface BookingCommunication {
  id: string;
  booking_id: string;
  channel: CommunicationChannel;
  direction: 'outbound' | 'inbound';
  subject: string | null;
  body: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
}

export interface BookingCommunicationPayload {
  channel: CommunicationChannel;
  direction?: 'outbound' | 'inbound';
  subject?: string;
  body?: string;
}

export function useBookingCommunications(bookingId: string) {
  return useQuery({
    queryKey: ['bookings', bookingId, 'communications'],
    queryFn: async () => {
      const res = await api.get<{ data: BookingCommunication[] }>(`/bookings/${bookingId}/communications`);
      return res.data.data;
    },
    enabled: !!bookingId,
  });
}

export function useCreateBookingCommunication(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BookingCommunicationPayload) => {
      const res = await api.post<{ data: BookingCommunication }>(`/bookings/${bookingId}/communications`, payload);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings', bookingId, 'communications'] }),
  });
}
