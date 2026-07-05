// ============================================================
// EUROTRIPS — useTourDocuments hook
// GET /tours/:id/documents, POST rooming-pdf/passenger-list,
// GET .../download (OPS-18/19). Відповідь — snake_case.
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export interface TourDocument {
  id: string;
  tour_id: string;
  doc_type: 'rooming_hotel' | 'passenger_list';
  doc_for: string;
  title: string;
  file_size_kb: number | null;
  generated_at: string;
  is_sent: boolean;
  sent_at: string | null;
}

export function useTourDocuments(tourId: string) {
  return useQuery({
    queryKey: ['tours', tourId, 'documents'],
    queryFn: async () => {
      const res = await api.get<{ data: TourDocument[] }>(`/tours/${tourId}/documents`);
      return res.data.data;
    },
    enabled: !!tourId,
  });
}

export function useGenerateRoomingPdf(tourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (hotelBookingId: string) => {
      const res = await api.post<{ data: TourDocument }>(`/tours/${tourId}/documents/rooming-pdf`, { hotelBookingId });
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours', tourId, 'documents'] }),
  });
}

export function useGeneratePassengerList(tourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: TourDocument }>(`/tours/${tourId}/documents/passenger-list`, {});
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours', tourId, 'documents'] }),
  });
}

/** Завантажує PDF як blob і відкриває/скачує в браузері (Authorization-заголовок потребує axios, не прямий <a href>) */
export async function openTourDocument(tourId: string, documentId: string, mode: 'view' | 'download', fileName: string) {
  const res = await api.get(`/tours/${tourId}/documents/${documentId}/download`, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(res.data);

  if (mode === 'view') {
    window.open(blobUrl, '_blank');
  } else {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${fileName}.pdf`;
    link.click();
  }

  setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
}
