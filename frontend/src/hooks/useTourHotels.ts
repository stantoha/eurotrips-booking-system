// ============================================================
// EUROTRIPS — useTourHotels hook
// GET/POST/PATCH /tours/:id/hotels (OPS-04/05/06)
// GET-відповідь — snake_case. Тіла POST/PATCH — camelCase.
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { HotelBookingUiStatus } from '../components/ui/HotelStatusBadge';

export interface TourHotelBooking {
  id: string;
  tour_id: string;
  hotel_id: string;
  city: string;
  check_in_date: string;
  nights_count: number;
  price_twin: number | null; qty_twin: number | null;
  price_dbl: number | null; qty_dbl: number | null;
  price_trpl: number | null; qty_trpl: number | null;
  price_sngl: number | null; qty_sngl: number | null;
  total_cost: number | null;
  deposit_amount: number | null;
  deposit_status: string | null;
  balance_amount: number | null;
  option_deadline: string | null;
  confirmation_status: string | null;
  fact_amount_eur: number | null;
  notes: string | null;
  hotel: { name: string; city: string; country: string };
  ui_status: HotelBookingUiStatus;
}

export interface CreateHotelPayload {
  hotelName: string;
  hotelCity?: string;
  hotelCountry?: string;
  city: string;
  checkInDate: string;
  nightsCount: number;
  priceTwin?: number;
  qtyTwin?: number;
  optionDeadline?: string;
}

export interface PatchHotelPayload {
  optionDeadline?: string;
  confirmationStatus?: 'searching' | 'option' | 'confirmed';
  depositAmount?: number;
  depositStatus?: 'unpaid' | 'paid';
  balanceAmount?: number;
  factAmountEur?: number;
  notes?: string;
}

export function useTourHotels(tourId: string) {
  return useQuery({
    queryKey: ['tours', tourId, 'hotels'],
    queryFn: async () => {
      const res = await api.get<{ data: TourHotelBooking[] }>(`/tours/${tourId}/hotels`);
      return res.data.data;
    },
    enabled: !!tourId,
  });
}

export function useCreateHotel(tourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateHotelPayload) => {
      const res = await api.post<{ data: TourHotelBooking }>(`/tours/${tourId}/hotels`, payload);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours', tourId, 'hotels'] }),
  });
}

export function usePatchHotel(tourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ hotelBookingId, payload }: { hotelBookingId: string; payload: PatchHotelPayload }) => {
      const res = await api.patch<{ data: TourHotelBooking }>(`/tours/${tourId}/hotels/${hotelBookingId}`, payload);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours', tourId, 'hotels'] }),
  });
}
