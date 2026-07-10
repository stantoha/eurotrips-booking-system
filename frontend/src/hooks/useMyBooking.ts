// ============================================================
// EUROTRIPS — hooks/useMyBooking.ts
// Кабінет туриста /my/* (C4, WF5, OPS-03, BR-12).
//
// GET   /bookings                                    — власні бронювання (RBAC: contactTouristId)
// GET   /bookings/:id                                 — деталь (учасники, платежі; без commissions — BR-04-подібне)
// GET   /bookings/:id/seat-map                        — схема автобуса (is_occupied, без імен)
// PATCH /bookings/:id/tourist/:tId/preferences (BR-12) — тип номеру + місце в автобусі
//
// Окремі типи від Booking у types/index.ts — той тип відображає інший (не
// завжди актуальний) контракт списку бронювань (CLAUDE.md §13). Тут — типи,
// звірені напряму з bookings.service.ts / seat-map.service.ts.
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { BookingStatus, PaymentStatus } from '../types';

// ─── TYPES ────────────────────────────────────────────────────

export interface MyBookingListItem {
  id: string;
  booking_number: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  persons_count: number;
  total_amount: number;
  deposit_paid: number;
  balance_paid: number;
  tour: { id: string; code: string; name: string; departure_date: string };
}

export interface MyBookingParticipant {
  id: string;
  role: string;
  seat_number: string | null;
  room_type: string | null;
  preferred_room_type: string | null;
  bus_sea_number: number | null;
  meal_type: string | null;
  roommate_preference: string | null;
  tourist: {
    id: string;
    first_name: string;
    last_name: string;
    passport_number: string | null;
    passport_expiry: string | null;
  };
}

export interface MyBookingPayment {
  id: string;
  amount: number;
  payment_type: string;
  payment_method: string | null;
  status: string;
  paid_at: string | null;
  reference: string | null;
}

export interface MyBookingDetail extends MyBookingListItem {
  deposit_amount: number;
  balance_amount: number;
  deposit_deadline: string | null;
  balance_deadline: string | null;
  currency: string;
  contact_tourist: { id: string; first_name: string; last_name: string; phone: string; email: string };
  participants: MyBookingParticipant[];
  payments: MyBookingPayment[];
  agent: { id: string; agency_name: string; agent_type: string } | null;
  manager: { id: string; first_name: string; last_name: string } | null;
}

export interface MySeatMapSeat {
  seat_number: number;
  is_occupied: boolean;
}

export interface MySeatMap {
  tour_id: string;
  total_seats: number;
  seats: MySeatMapSeat[];
}

export type MyRoomType = 'twin' | 'double' | 'triple' | 'single' | 'no_preference';

export interface SetMyPreferencesDto {
  preferredRoomType?: MyRoomType;
  /** Бекенд-поле навмисно з друкарською помилкою (без 't') — seat-map.schema.ts */
  busSeaNumber?: number | null;
  roommatePreference?: string;
}

export interface SetMyPreferencesResult {
  applied: boolean;
  message?: string;
  /** Оновлений booking_tourists рядок (без вкладеного tourist — seat-map.service.ts повертає його "сирим") */
  data?: Omit<MyBookingParticipant, 'tourist'>;
}

// ─── QUERY KEYS ───────────────────────────────────────────────

export const myBookingKeys = {
  list:     ()           => ['my', 'bookings']              as const,
  detail:   (id: string) => ['my', 'bookings', id]           as const,
  seatMap:  (id: string) => ['my', 'bookings', id, 'seat-map'] as const,
};

// ─── QUERIES ──────────────────────────────────────────────────

export function useMyBookings() {
  return useQuery({
    queryKey: myBookingKeys.list(),
    queryFn: async () => {
      const { data } = await api.get<{ data: MyBookingListItem[] }>('/bookings');
      return data.data;
    },
    staleTime: 30_000,
  });
}

export function useMyBookingDetail(id: string | undefined) {
  return useQuery({
    queryKey: myBookingKeys.detail(id ?? ''),
    queryFn: async () => {
      const { data } = await api.get<{ data: MyBookingDetail }>(`/bookings/${id}`);
      return data.data;
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useMySeatMap(bookingId: string | undefined) {
  return useQuery({
    queryKey: myBookingKeys.seatMap(bookingId ?? ''),
    queryFn: async () => {
      const { data } = await api.get<{ data: MySeatMap }>(`/bookings/${bookingId}/seat-map`);
      return data.data;
    },
    enabled: !!bookingId,
  });
}

// ─── MUTATIONS ────────────────────────────────────────────────

export function useSetMyPreferences(bookingId: string, touristId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: SetMyPreferencesDto) => {
      const { data } = await api.patch<{ data: SetMyPreferencesResult }>(
        `/bookings/${bookingId}/tourist/${touristId}/preferences`,
        dto,
      );
      return data.data;
    },
    onSuccess: (result) => {
      if (result.applied) {
        qc.invalidateQueries({ queryKey: myBookingKeys.detail(bookingId) });
        qc.invalidateQueries({ queryKey: myBookingKeys.seatMap(bookingId) });
      }
    },
  });
}
