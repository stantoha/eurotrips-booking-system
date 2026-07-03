// ============================================================
// EUROTRIPS — hooks/useTouristPreferences.ts
// PATCH /bookings/:id/tourist/:touristId/preferences (BR-12 / OPS-03)
// ============================================================

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { TouristPreferencesDto, TouristPreferencesResult } from '../types';

export function useUpdateTouristPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      bookingId:  string;
      touristId:  string;
      dto:        TouristPreferencesDto;
    }) => {
      const { data } = await api.patch<{ data: TouristPreferencesResult }>(
        `/bookings/${payload.bookingId}/tourist/${payload.touristId}/preferences`,
        payload.dto,
      );
      return data.data;
    },
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ['bookings', variables.bookingId, 'seat-map'] });
      qc.invalidateQueries({ queryKey: ['bookings', 'detail', variables.bookingId] });
    },
  });
}

export default useUpdateTouristPreferences;
