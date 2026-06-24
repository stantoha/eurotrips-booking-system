// =============================================================================
// EUROTRIPS — Agents Schema (Zod)
// =============================================================================

import { z } from 'zod';

export const AgentListQuerySchema = z.object({
  status:    z.enum(['active', 'suspended', 'blocked']).optional(),
  agentType: z.enum(['standard', 'network']).optional(),
  networkId: z.string().uuid().optional(),
  search:    z.string().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  sortBy:    z.enum(['createdAt', 'agencyName', 'balance']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const AgentCommissionQuerySchema = z.object({
  status:   z.enum(['pending', 'frozen', 'to_pay', 'paid', 'cancelled']).optional(),
  dateFrom: z.string().optional(),
  dateTo:   z.string().optional(),
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
});

export type AgentListQueryDto       = z.infer<typeof AgentListQuerySchema>;
export type AgentCommissionQueryDto = z.infer<typeof AgentCommissionQuerySchema>;
