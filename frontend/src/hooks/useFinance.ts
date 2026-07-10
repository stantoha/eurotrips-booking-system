// ============================================================
// EUROTRIPS — hooks/useFinance.ts
// GET /finance/summary, GET /finance/debts, GET /finance/margin-alerts
// Відповідь — snake_case (preSerialization hook, src/app.ts).
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

// ─── SUMMARY ──────────────────────────────────────────────────

export interface FinanceSummary {
  total_bookings: number;
  confirmed_bookings: number;
  total_revenue: number;
  collected_revenue: number;
  currency: string;
  generated_at: string;
}

export function useFinanceSummary() {
  return useQuery({
    queryKey: ['finance', 'summary'],
    queryFn: async () => {
      const { data } = await api.get<{ data: FinanceSummary }>('/finance/summary');
      return data.data;
    },
    staleTime: 60_000,
  });
}

// ─── DEBTS ────────────────────────────────────────────────────

export interface FinanceDebt {
  id: string;
  booking_number: string;
  total_amount: number;
  deposit_paid: number;
  balance_paid: number;
  balance_deadline: string | null;
  payment_status: string;
  status: string;
  contact_tourist: { first_name: string; last_name: string; phone: string | null } | null;
  tour: { code: string; name: string; departure_date: string } | null;
}

export function useFinanceDebts() {
  return useQuery({
    queryKey: ['finance', 'debts'],
    queryFn: async () => {
      const { data } = await api.get<{ data: FinanceDebt[] }>('/finance/debts');
      return data.data;
    },
    staleTime: 60_000,
  });
}

// ─── MARGIN ALERTS ────────────────────────────────────────────

export interface MarginAlert {
  tour_id: string;
  code: string;
  name: string;
  status: string;
  departure_date: string;
  base_price: number;
  cost_price: number;
  agent_commission_pct: number;
  margin_pct: number;
}

export function useMarginAlerts(enabled: boolean) {
  return useQuery({
    queryKey: ['finance', 'margin-alerts'],
    queryFn: async () => {
      const { data } = await api.get<{ data: MarginAlert[]; meta: { total: number } }>(
        '/finance/margin-alerts',
      );
      return data.data;
    },
    enabled,
    staleTime: 60_000,
  });
}
