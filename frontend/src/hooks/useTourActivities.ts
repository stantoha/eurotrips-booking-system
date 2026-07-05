// ============================================================
// EUROTRIPS — useTourActivities hook
// GET /tours/:id/activities (read-only, TimelineView)
// Відповідь — snake_case (preSerialization hook).
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export interface TourActivity {
  id: string;
  tour_id: string;
  city: string;
  program_type: string | null;
  activity_date: string;
  /// Повний ISO-timestamp з фіксованою датою-заглушкою (Prisma @db.Time) — брати тільки час
  start_time: string | null;
  activity_name: string;
  guide_name: string | null;
  guide_phone: string | null;
  cost_eur: number | null;
  status: string;
  notes: string | null;
  created_at: string;
}

/** ISO-timestamp @db.Time-поля → "HH:MM" для відображення */
export function formatActivityTime(startTime: string | null): string | null {
  if (!startTime) return null;
  return new Date(startTime).toISOString().slice(11, 16);
}

/** Тіло POST/PATCH-запитів — camelCase (Zod-схема без трансформації) */
export interface ActivityPayload {
  city?: string;
  programType?: string;
  activityDate?: string;
  activityName?: string;
  startTime?: string;
  guideName?: string;
  guidePhone?: string;
  costEur?: number;
  status?: 'очікує' | 'затверджено' | 'скасовано';
  notes?: string;
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

export function useCreateActivity(tourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ActivityPayload) => {
      const res = await api.post<{ data: { activity: TourActivity; warning: string | null } }>(
        `/tours/${tourId}/activities`,
        payload
      );
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours', tourId, 'activities'] }),
  });
}

export function usePatchActivity(tourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ activityId, payload }: { activityId: string; payload: ActivityPayload }) => {
      const res = await api.patch<{ data: TourActivity }>(
        `/tours/${tourId}/activities/${activityId}`,
        payload
      );
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tours', tourId, 'activities'] }),
  });
}
