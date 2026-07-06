// ============================================================
// EUROTRIPS — useTourTourists hook
// GET /tours/:id/tourists — зведений список туристів виїзду
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export interface TourTouristRow {
  tourist_id: string;
  booking_tourist_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  passport_number: string | null;
  phone: string | null;
  email: string | null;
  allergies: string | null;
  dietary_restrictions: string | null;
  booking_id: string;
  booking_number: string;
  booking_status: string;
  payment_status: string;
  balance_due: number;
  seat_number: string | null;
  bus_sea_number: number | null;
  room_type: string | null;
  preferred_room_type: string | null;
  actual_room_number: string | null;
  actual_room_type: string | null;
  meal_type: string | null;
  special_requirements: string | null;
  special_notes: string | null;
}

export interface TourTouristsResponse {
  tour_id: string;
  total_confirmed: number;
  tourists: TourTouristRow[];
}

export interface TourTouristsFilters {
  missingPassport?: boolean;
  hasDebt?: boolean;
  noRoom?: boolean;
}

export function useTourTourists(tourId: string, filters?: TourTouristsFilters) {
  return useQuery({
    queryKey: ['tours', tourId, 'tourists', filters ?? {}],
    queryFn: async () => {
      const res = await api.get<{ data: TourTouristsResponse }>(`/tours/${tourId}/tourists`, {
        params: {
          ...(filters?.missingPassport && { missingPassport: 'true' }),
          ...(filters?.hasDebt && { hasDebt: 'true' }),
          ...(filters?.noRoom && { noRoom: 'true' }),
        },
      });
      return res.data.data;
    },
    enabled: !!tourId,
  });
}
