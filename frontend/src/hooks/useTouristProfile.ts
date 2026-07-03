// ============================================================
// EUROTRIPS — hooks/useTouristProfile.ts
// GET /tourists/me — власний профіль туриста (кабінет туриста)
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Tourist } from '../types';

export function useTouristProfile(enabled = true) {
  return useQuery({
    queryKey: ['tourists', 'me'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Tourist }>('/tourists/me');
      return data.data;
    },
    enabled,
    staleTime: 60_000,
  });
}

/** PATCH /tourists/me — body камелCase (email навмисно відсутній, див. бекенд) */
export interface UpdateTouristProfilePayload {
  phone?:               string;
  dateOfBirth?:         string;
  passportNumber?:      string;
  passportExpiry?:      string;
  nationality?:         string;
  allergies?:           string;
  dietaryRestrictions?: string;
}

export function useUpdateTouristProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: UpdateTouristProfilePayload) => {
      const { data } = await api.patch<{ data: Tourist }>('/tourists/me', dto);
      return data.data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(['tourists', 'me'], updated);
    },
  });
}

export default useTouristProfile;
