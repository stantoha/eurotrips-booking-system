// ============================================================
// EUROTRIPS — useStaff hook
// GET/POST/PATCH/DELETE /staff — персонал (турлідери/гіди/водії/координатори)
// Відповідь — snake_case (preSerialization hook).
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export type StaffRole = 'tour_leader' | 'guide' | 'driver' | 'coordinator';

export interface Staff {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  role: StaffRole;
  phone: string | null;
  email: string | null;
  languages: string[];
  specializations: string[];
  status: string;
  notes: string | null;
}

/** Тіло POST/PATCH-запитів — camelCase (Zod-схема без трансформації) */
export interface StaffPayload {
  firstName?: string;
  lastName?: string;
  role?: StaffRole;
  phone?: string;
  email?: string;
  languages?: string[];
  specializations?: string[];
  status?: 'active' | 'inactive';
  notes?: string;
}

export interface StaffListQuery {
  role?: StaffRole;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function useStaffList(query: StaffListQuery = {}) {
  return useQuery({
    queryKey: ['staff', query],
    queryFn: async () => {
      const res = await api.get<{ data: Staff[]; meta: { total: number; page: number; limit: number; pages: number } }>(
        '/staff',
        { params: query }
      );
      return res.data;
    },
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: StaffPayload) => {
      const res = await api.post<{ data: Staff }>('/staff', payload);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  });
}

export function usePatchStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: StaffPayload }) => {
      const res = await api.patch<{ data: Staff }>(`/staff/${id}`, payload);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  });
}

export function useDeactivateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/staff/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  });
}
