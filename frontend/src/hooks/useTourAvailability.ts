// TODO: підключити GET /tours/:id/availability → реальні дані з БД
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';

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
      const res = await apiClient.get(`/tours/${tourId}/availability`);
      return res.data;
    },
    enabled: options.enabled !== false && !!tourId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
