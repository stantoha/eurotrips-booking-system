// ============================================================
// EUROTRIPS — useOpsDashboard hook
// GET /ops/dashboard — дашборд операційного менеджера
// Відповідь — snake_case (preSerialization hook).
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export interface OpsHotelDeadline {
  hotel_booking_id: string;
  tour_id: string;
  tour_code: string;
  tour_name: string;
  hotel_name: string;
  city: string;
  option_deadline: string;
}

export interface OpsUpcomingTour {
  tour_id: string;
  code: string;
  name: string;
  departure_date: string;
  total_seats: number;
  available_seats: number;
  status: string;
  readiness_percent: number;
}

export interface OpsChecklistProgress {
  tour_id: string;
  code: string;
  name: string;
  departure_date: string;
  readiness_percent: number;
}

export interface OpsNewTourist {
  booking_id: string;
  booking_number: string;
  tour_id: string;
  tour_code: string;
  tour_name: string;
  contact_name: string;
  persons_count: number;
  updated_at: string;
}

export interface OpsDashboard {
  hotel_deadlines: OpsHotelDeadline[];
  upcoming_tours: OpsUpcomingTour[];
  checklist_progress: OpsChecklistProgress[];
  new_tourists: OpsNewTourist[];
}

export function useOpsDashboard() {
  return useQuery({
    queryKey: ['ops', 'dashboard'],
    queryFn: async () => {
      const res = await api.get<{ data: OpsDashboard }>('/ops/dashboard');
      return res.data.data;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
