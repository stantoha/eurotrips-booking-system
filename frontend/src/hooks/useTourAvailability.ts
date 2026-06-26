// TODO: підключити GET /tours/:id/availability → реальні дані з БД
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

interface TourAvailability {
  availableSeats:  number;
  bookedSeats:     number;
  totalSeats:      number;
  occupancyPct:    number;
  barColorClass:   string;
  roomStructure: {
    twin:   number;
    dbl:    number;
    sngl:   number;
    triple: number;
  };
}

interface UseTourAvailabilityOptions {
  enabled?: boolean;
}

export function useTourAvailability(
  tourId: string | undefined,
  options: UseTourAvailabilityOptions = {},
) {
  return useQuery<TourAvailability>({
    queryKey: ['tour-availability', tourId],
    queryFn: async () => {
      const res = await api.get(`/tours/${tourId}/availability`);
      return res.data;
    },
    enabled: options.enabled !== false && !!tourId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function invalidateTourAvailability(_tourId: string) {
  // Placeholder — invalidation handled via queryClient in components
}
