// ============================================================
// EUROTRIPS — useTourActivities hook
// GET /tours/:id/activities (read-only, TimelineView)
// Відповідь — snake_case (preSerialization hook).
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export interface TourActivity {
  id: string;
  tour_id: string;
  city: string;
  program_type: string | null;
  activity_date: string;
  activity_name: string;
  start_time: string | null;
  guide_name: string | null;
  guide_phone: string | null;
  cost_eur: number | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export function useTourActivities(tourId: string) {
  return useQuery({
    queryKey: ['tours', tourId, 'activities'],
    queryFn: async () => {
      const res = await api.get<{ data: TourActivity[] }>(`/tours/${tourId}/activities`);
      return res.data.data;
    },
    enabled: !!tourId,
  });
}
