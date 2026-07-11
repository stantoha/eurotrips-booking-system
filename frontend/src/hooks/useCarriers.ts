// ============================================================
// EUROTRIPS — useCarriers hook
// GET/POST/PATCH /carriers, /carriers/:id/buses, /buses/:id
// Відповідь — snake_case (preSerialization hook).
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export interface Bus {
  id: string;
  carrier_id: string;
  brand: string;
  plate_number: string;
  seats_count: number;
  notes: string | null;
  status: string;
}

export interface Carrier {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: string;
  buses: Bus[];
}

/** Тіло POST/PATCH-запитів — camelCase (Zod-схема без трансформації) */
export interface CarrierPayload {
  name?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  status?: 'active' | 'inactive';
  notes?: string;
}

export interface BusPayload {
  brand?: string;
  plateNumber?: string;
  seatsCount?: number;
  status?: 'active' | 'inactive';
  notes?: string;
}

export function useCarriersList(query: { search?: string; status?: string } = {}) {
  return useQuery({
    queryKey: ['carriers', query],
    queryFn: async () => {
      const res = await api.get<{ data: Carrier[]; meta: { total: number } }>('/carriers', { params: query });
      return res.data;
    },
  });
}

export function useCreateCarrier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CarrierPayload) => {
      const res = await api.post<{ data: Carrier }>('/carriers', payload);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['carriers'] }),
  });
}

export function usePatchCarrier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: CarrierPayload }) => {
      const res = await api.patch<{ data: Carrier }>(`/carriers/${id}`, payload);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['carriers'] }),
  });
}

export function useCreateBus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ carrierId, payload }: { carrierId: string; payload: BusPayload }) => {
      const res = await api.post<{ data: Bus }>(`/carriers/${carrierId}/buses`, payload);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['carriers'] }),
  });
}

export function usePatchBus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: BusPayload }) => {
      const res = await api.patch<{ data: Bus }>(`/buses/${id}`, payload);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['carriers'] }),
  });
}
