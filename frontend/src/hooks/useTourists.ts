// ============================================================
// EUROTRIPS — hooks/useTourists.ts
// Пошук + створення туриста — потрібно для форми бронювання
// (POST /bookings вимагає існуючий contactTouristId).
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Tourist } from '../types';

// Тіла запитів (POST/PATCH) бекенд НЕ конвертує camelCase↔snake_case
// (тільки відповіді) — Zod-схеми на бекенді очікують camelCase.
export interface CreateTouristDto {
  firstName:   string;
  lastName:    string;
  email?:      string;
  phone?:      string;
  nationality?: string;
}

export const touristKeys = {
  all:    () => ['tourists'] as const,
  search: (q: string) => ['tourists', 'search', q] as const,
};

/** Пошук туристів (автокомпліт). Порожній search — не запитує. */
export function useTouristSearch(search: string) {
  return useQuery({
    queryKey: touristKeys.search(search),
    queryFn: async () => {
      const { data } = await api.get<{ data: Tourist[] }>('/tourists', {
        params: { search, limit: 10 },
      });
      return data.data;
    },
    enabled:   search.trim().length >= 2,
    staleTime: 30_000,
  });
}

export function useCreateTourist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateTouristDto) => {
      const { data } = await api.post<{ data: Tourist }>('/tourists', dto);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: touristKeys.all() });
    },
  });
}
