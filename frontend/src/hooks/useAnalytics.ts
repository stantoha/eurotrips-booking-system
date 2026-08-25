// ============================================================
// EUROTRIPS — useAnalytics hook
// GET /analytics/sales-funnel | /tours-load | /agents-top
// Відповідь — snake_case (preSerialization hook).
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export interface AnalyticsPeriod {
  dateFrom?: string;
  dateTo?: string;
}

export interface SalesFunnel {
  period: { date_from: string | null; date_to: string | null };
  funnel: { leads: number; bookings: number; confirmed: number };
  conversion: { lead_to_booking_pct: number; booking_to_confirmed_pct: number };
}

export interface TourLoad {
  id: string;
  code: string;
  name: string;
  direction: string | null;
  departure_date: string;
  status: string;
  total_seats: number;
  available_seats: number;
  base_price: number;
  cost_price?: number;
  sold_seats: number;
  occupancy_pct: number;
}

export interface AgentTopRow {
  agent_id: string | null;
  agency_name: string | null;
  agent_type: string | null;
  manager_name: string | null;
  bookings_count: number;
  total_amount: number;
  total_commission: number;
}

export interface AgentsTop {
  period: { date_from: string | null; date_to: string | null };
  agents: AgentTopRow[];
}

export function useSalesFunnel(period: AnalyticsPeriod = {}, enabled = true) {
  return useQuery({
    queryKey: ['analytics', 'sales-funnel', period],
    queryFn: async () => {
      const res = await api.get<{ data: SalesFunnel }>('/analytics/sales-funnel', { params: period });
      return res.data.data;
    },
    enabled,
    staleTime: 60_000,
  });
}

export function useToursLoad(period: AnalyticsPeriod = {}, enabled = true) {
  return useQuery({
    queryKey: ['analytics', 'tours-load', period],
    queryFn: async () => {
      const res = await api.get<{ data: TourLoad[] }>('/analytics/tours-load', { params: period });
      return res.data.data;
    },
    enabled,
    staleTime: 60_000,
  });
}

export interface RevenueTrendPoint {
  month: string;
  label: string;
  revenue: number;
  bookings: number;
}

export interface RevenueTrend {
  period: { date_from: string | null; date_to: string | null };
  totals: { revenue: number; bookings: number };
  points: RevenueTrendPoint[];
}

/** GET /analytics/revenue-trend — оборот і к-сть бронювань по місяцях */
export function useRevenueTrend(period: AnalyticsPeriod & { months?: number } = {}, enabled = true) {
  return useQuery({
    queryKey: ['analytics', 'revenue-trend', period],
    queryFn: async () => {
      const res = await api.get<{ data: RevenueTrend }>('/analytics/revenue-trend', { params: period });
      return res.data.data;
    },
    enabled,
    staleTime: 60_000,
  });
}

export function useAgentsTop(period: AnalyticsPeriod = {}, enabled = true) {
  return useQuery({
    queryKey: ['analytics', 'agents-top', period],
    queryFn: async () => {
      const res = await api.get<{ data: AgentsTop }>('/analytics/agents-top', { params: period });
      return res.data.data;
    },
    enabled,
    staleTime: 60_000,
  });
}
