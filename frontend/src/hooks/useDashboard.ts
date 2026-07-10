// ============================================================
// EUROTRIPS — hooks/useDashboard.ts
// Агрегації, потрібні тільки для Dashboard.tsx.
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { LEAD_STATUS_CONFIG } from '../constants/statuses';
import type { LeadStatus } from '../types';

interface RawLeadListItem {
  status: LeadStatus;
}

export type LeadsByStatus = Record<LeadStatus, number>;

/**
 * Підрахунок лідів по статусу для панелі "Ліди по статусах".
 * Один запит з limit=100 (максимум бекенду) без фільтра статусу,
 * далі клієнтський reduce. НЕ рахує лідів понад 100 по системі —
 * для точної агрегації в майбутньому потрібен окремий бекенд-ендпоінт
 * (напр. GET /leads/summary), тут — легка апроксимація на клієнті.
 */
export function useLeadsByStatus() {
  return useQuery({
    queryKey: ['dashboard', 'leads-by-status'],
    queryFn: async (): Promise<LeadsByStatus> => {
      const { data } = await api.get<{ data: RawLeadListItem[] }>('/leads', {
        params: { limit: 100 },
      });
      const counts = Object.fromEntries(
        Object.keys(LEAD_STATUS_CONFIG).map((status) => [status, 0]),
      ) as LeadsByStatus;
      for (const lead of data.data) {
        if (lead.status in counts) counts[lead.status] += 1;
      }
      return counts;
    },
    staleTime: 60_000,
  });
}
