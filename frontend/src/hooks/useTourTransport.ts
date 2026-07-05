// ============================================================
// EUROTRIPS — useTourTransport hook
// GET/POST/PATCH /tours/:id/transport (OPS-08/09/10)
// GET-відповідь — snake_case. Тіла POST/PATCH — camelCase.
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export interface TourTransport {
  id: string;
  tour_id: string;
  transport_type: string;
  connection_type: string | null;
  carrier_name: string | null;
  bus_brand: string | null;
  km_google: number | null;
  km_extras: number | null;
  km_total_plan: number | null;
  rate_per_km: number | null;
  fuel_surcharge: number | null;
  wifi_or_delivery_fee: number | null;
  paid_advance_eur: number | null;
  paid_cash_eur: number | null;
  status: 'planned' | 'confirmed' | 'completed' | 'cancelled';
  notes: string | null;
  // Авторозрахунок (OPS-09)
  km_total_computed: number;
  base_transport_cost: number;
  total_transport_cost: number;
  cost_per_person: number | null;
  remaining_amount: number;
}

export interface TransportPayload {
  transportType?: string;
  carrierName?: string;
  busBrand?: string;
  kmGoogle?: number;
  kmExtras?: number;
  ratePerKm?: number;
  fuelSurcharge?: number;
  wifiOrDeliveryFee?: number;
  paidAdvanceEur?: number;
  paidCashEur?: number;
  status?: TourTransport['status'];
  notes?: string;
}

export function useTourTransport(tourId: string) {
  return useQuery({
    queryKey: ['tours', tourId, 'transport'],
    queryFn: async () => {
      const res = await api.get<{ data: TourTransport[] }>(`/tours/${tourId}/transport`);
      return res.data.data;
    },
    enabled: !!tourId,
  });
}

export function useCreateTransport(tourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TransportPayload) => {
      const res = await api.post<{ data: TourTransport }>(`/tours/${tourId}/transport`, payload);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours', tourId, 'transport'] }),
  });
}

export function usePatchTransport(tourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ transportId, payload }: { transportId: string; payload: TransportPayload }) => {
      const res = await api.patch<{ data: TourTransport }>(`/tours/${tourId}/transport/${transportId}`, payload);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours', tourId, 'transport'] }),
  });
}
