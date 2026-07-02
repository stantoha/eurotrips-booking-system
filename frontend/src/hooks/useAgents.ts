// ============================================================
// EUROTRIPS — hooks/useAgents.ts
// Мінімальний список агентів — потрібен для форми бронювання
// (вибір агента при booking_type === 'agent').
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export interface AgentOption {
  id:           string;
  agency_name:  string;
  agent_type:   'standard' | 'network';
  user: { first_name: string; last_name: string };
}

export function useAgents() {
  return useQuery({
    queryKey: ['agents', 'list'],
    queryFn: async () => {
      const { data } = await api.get<{ data: AgentOption[] }>('/agents');
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
