// ============================================================
// EUROTRIPS — hooks/useAgentCommissions.ts
// GET /agents/:id/commissions — реальні нараховані комісії агента
// (AgentCabinet раніше рахував комісію з booking-списку, де цих
// полів немає взагалі — сума завжди виходила 0).
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export interface AgentCommission {
  id:               string;
  booking_id:       string;
  gross_amount:     number;
  agent_amount:     number;
  commission_rate:  number;
  status:           'pending' | 'frozen' | 'to_pay' | 'paid' | 'cancelled';
  paid_at:          string | null;
  created_at:       string;
  booking: { booking_number: string; tour: { name: string; departure_date: string } };
}

export function useAgentCommissions(agentId: string | undefined) {
  return useQuery({
    queryKey: ['agents', agentId, 'commissions'],
    queryFn: async () => {
      const { data } = await api.get<{ data: AgentCommission[] }>(
        `/agents/${agentId}/commissions`,
      );
      return data.data;
    },
    enabled:   !!agentId,
    staleTime: 60_000,
  });
}
