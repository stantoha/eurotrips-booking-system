// ============================================================
// EUROTRIPS — useBookingDocuments hook
// GET/POST /bookings/:id/documents (+ /voucher, /contract, download)
// Відповідь — snake_case (preSerialization hook).
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export interface BookingDocument {
  id: string;
  booking_id: string;
  doc_type: 'voucher' | 'contract' | string;
  title: string;
  file_size_kb: number | null;
  generated_at: string;
}

export function useBookingDocuments(bookingId: string) {
  return useQuery({
    queryKey: ['bookings', bookingId, 'documents'],
    queryFn: async () => {
      const res = await api.get<{ data: BookingDocument[] }>(`/bookings/${bookingId}/documents`);
      return res.data.data;
    },
    enabled: !!bookingId,
  });
}

export function useGenerateBookingDocument(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (docType: 'voucher' | 'contract') => {
      const res = await api.post<{ data: BookingDocument }>(`/bookings/${bookingId}/documents/${docType}`);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings', bookingId, 'documents'] }),
  });
}

/** Відкриває PDF у новій вкладці (авторизований запит → blob URL) */
export async function openBookingDocument(bookingId: string, documentId: string): Promise<void> {
  const res = await api.get(`/bookings/${bookingId}/documents/${documentId}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
