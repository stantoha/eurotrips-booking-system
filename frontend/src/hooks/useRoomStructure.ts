// ============================================================
// EUROTRIPS — useRoomStructure hook
// OPS-01/09/10: GET/PUT /tours/:id/room-structure + approve/finalize
//
// Контракт: GET-відповідь — snake_case (preSerialization hook,
// CLAUDE.md розділ 14). Тіла PUT/PATCH-запитів — camelCase
// (room-structure.schema.ts на бекенді не транформується).
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export type RoomingStatus = 'draft' | 'approved' | 'final';

/** GET-відповідь — snake_case */
export interface HotelBookingStructure {
  id: string;
  hotel_name: string;
  city: string;
  check_in_date: string;
  planned_twin: number;
  planned_double: number;
  planned_triple: number;
  planned_single: number;
  capacity: number;
  structure_status: RoomingStatus;
  structure_approved_by: string | null;
  structure_approved_at: string | null;
  is_fast_launch: boolean;
}

/** GET-відповідь — snake_case */
export interface RoomStructureResponse {
  tour_id: string;
  tour_code: string;
  total_seats: number;
  hotel_bookings: HotelBookingStructure[];
}

/** Тіло PUT-запиту — camelCase (Zod-схема бекенду) */
export interface SetRoomStructurePayload {
  hotelBookingId: string;
  plannedTwin: number;
  plannedDouble: number;
  plannedTriple: number;
  plannedSingle: number;
}

export function useRoomStructure(tourId: string) {
  return useQuery({
    queryKey: ['tours', tourId, 'room-structure'],
    queryFn: async () => {
      const res = await api.get<{ data: RoomStructureResponse }>(`/tours/${tourId}/room-structure`);
      return res.data.data;
    },
    enabled: !!tourId,
  });
}

export function useSetRoomStructure(tourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SetRoomStructurePayload) => {
      const res = await api.put(`/tours/${tourId}/room-structure`, payload);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours', tourId, 'room-structure'] }),
  });
}

export function useApproveRoomStructure(tourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (hotelBookingId: string) => {
      const res = await api.patch(`/tours/${tourId}/room-structure/approve`, { hotelBookingId });
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours', tourId, 'room-structure'] }),
  });
}

export function useFinalizeRoomStructure(tourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (hotelBookingId: string) => {
      const res = await api.patch(`/tours/${tourId}/room-structure/finalize`, { hotelBookingId });
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours', tourId, 'room-structure'] }),
  });
}
