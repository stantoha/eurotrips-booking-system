// ============================================================
// EUROTRIPS — hooks/useAgentRoyalty.ts
// GET /agents/:id/royalty — BR-07: тільки для мережевого агента
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export interface AgentRoyalty {
  agent_id:         string;
  agent_type:       'standard' | 'network';
  royalty_pct:      number | null;
  co_commission_pct: number | null;
  network:          { id: string; name: string } | null;
  summary: {
    total_royalty:   number;
    total_co_amount: number;
    paid_royalty:    number;
    pending_royalty: number;
  };
}

export function useAgentRoyalty(agentId: string | undefined, isNetworkAgent: boolean) {
  return useQuery({
    queryKey: ['agents', agentId, 'royalty'],
    queryFn: async () => {
      const { data } = await api.get<{ data: AgentRoyalty }>(
        `/agents/${agentId}/royalty`,
      );
      return data.data;
    },
    enabled:   !!agentId && isNetworkAgent,
    staleTime: 60_000,
  });
}
