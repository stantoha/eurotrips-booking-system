// =============================================================================
// EUROTRIPS — Agents Service
// BR-04: агент НІКОЛИ не бачить costPrice, margin, netProfit
// BR-05: standard vs network різна формула виплати
// BR-07: royalty тільки для agentType === 'network'
// =============================================================================

import { UserRole, AgentType, Prisma } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { Errors, AppError } from '../../shared/utils/errors';
import type { JwtPayload } from '../auth/auth.types';
import type { AgentListQueryDto, AgentCommissionQueryDto } from './agents.schema';

const AGENT_PUBLIC_SELECT = {
  id:             true,
  agencyName:     true,
  agentType:      true,
  networkId:      true,
  commissionPct:  true,
  contractNumber: true,
  contractDate:   true,
  status:         true,
  balance:        true,
  city:           true,
  country:        true,
  createdAt:      true,
  updatedAt:      true,
  user: {
    select: {
      id:        true,
      firstName: true,
      lastName:  true,
      email:     true,
      phone:     true,
    },
  },
  network: {
    select: {
      id:   true,
      name: true,
    },
  },
} as const;

export class AgentsService {

  // ── LIST ─────────────────────────────────────────────────────────────────
  async listAgents(query: AgentListQueryDto, _user: JwtPayload) {
    const { status, agentType, networkId, search, page, limit, sortBy, sortOrder } = query;

    const where: Prisma.AgentWhereInput = {
      ...(status    && { status }),
      ...(agentType && { agentType }),
      ...(networkId && { networkId }),
      ...(search    && {
        OR: [
          { agencyName: { contains: search, mode: 'insensitive' } },
          { user: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName:  { contains: search, mode: 'insensitive' } },
              { email:     { contains: search, mode: 'insensitive' } },
            ],
          }},
        ],
      }),
    };

    const orderBy: Prisma.AgentOrderByWithRelationInput =
      sortBy === 'agencyName'
        ? { agencyName: sortOrder }
        : sortBy === 'balance'
        ? { balance: sortOrder }
        : { createdAt: sortOrder };

    const [total, agents] = await Promise.all([
      prisma.agent.count({ where }),
      prisma.agent.findMany({
        where,
        orderBy,
        skip:  (page - 1) * limit,
        take:  limit,
        select: AGENT_PUBLIC_SELECT,
      }),
    ]);

    return {
      data: agents,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ── GET ONE ───────────────────────────────────────────────────────────────
  async getAgent(id: string) {
    const agent = await prisma.agent.findUnique({
      where: { id },
      select: {
        ...AGENT_PUBLIC_SELECT,
        notes: true,
        _count: {
          select: {
            bookings:    true,
            commissions: true,
          },
        },
      },
    });

    if (!agent) throw Errors.notFound('Агент', id);
    return agent;
  }

  // ── COMMISSIONS ───────────────────────────────────────────────────────────
  async getAgentCommissions(
    agentId: string,
    query: AgentCommissionQueryDto,
    user: JwtPayload
  ) {
    // Агент бачить тільки свої комісії (RBAC)
    if (user.role === UserRole.agent && user.agentId !== agentId) {
      throw Errors.forbidden('Доступ до комісій іншого агента заборонено');
    }

    const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { id: true } });
    if (!agent) throw Errors.notFound('Агент', agentId);

    const { status, dateFrom, dateTo, page, limit } = query;

    const where: Prisma.AgentCommissionWhereInput = {
      agentId,
      ...(status   && { status }),
      ...(dateFrom && { createdAt: { gte: new Date(dateFrom) } }),
      ...(dateTo   && { createdAt: { lte: new Date(dateTo) } }),
    };

    const [total, commissions] = await Promise.all([
      prisma.agentCommission.count({ where }),
      prisma.agentCommission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
        select: {
          id:             true,
          bookingId:      true,
          grossAmount:    true,
          agentAmount:    true,
          commissionRate: true,
          status:         true,
          paidAt:         true,
          createdAt:      true,
          // BR-04: coAmount і royaltyAmount не показуємо агенту
          ...(user.role !== UserRole.agent && {
            coAmount:      true,
            royaltyAmount: true,
            notes:         true,
          }),
          booking: {
            select: {
              bookingNumber: true,
              tour: {
                select: { name: true, departureDate: true },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: commissions,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ── ROYALTY (BR-07: тільки network) ──────────────────────────────────────
  async getAgentRoyalty(agentId: string) {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id:             true,
        agentType:      true,
        royaltyPct:     true,
        coCommissionPct: true,
        commissionPct:  true,
        network:        { select: { id: true, name: true, royaltyPct: true, coCommissionPct: true } },
        commissions: {
          where:   { status: { in: ['paid', 'to_pay'] } },
          select: {
            royaltyAmount: true,
            coAmount:      true,
            status:        true,
            paidAt:        true,
            createdAt:     true,
          },
        },
      },
    });

    if (!agent) throw Errors.notFound('Агент', agentId);

    // BR-07: роялті тільки для network
    if (agent.agentType !== AgentType.network) {
      throw new AppError(
        'NOT_NETWORK_AGENT',
        'Роялті доступне тільки для мережевих агентів',
        400
      );
    }

    const totalRoyalty  = agent.commissions.reduce((s, c) => s + Number(c.royaltyAmount ?? 0), 0);
    const totalCoAmount = agent.commissions.reduce((s, c) => s + Number(c.coAmount      ?? 0), 0);
    const paidRoyalty   = agent.commissions
      .filter(c => c.status === 'paid')
      .reduce((s, c) => s + Number(c.royaltyAmount ?? 0), 0);

    return {
      agentId,
      agentType:       agent.agentType,
      royaltyPct:      agent.royaltyPct,
      coCommissionPct: agent.coCommissionPct,
      network:         agent.network,
      summary: {
        totalRoyalty,
        totalCoAmount,
        paidRoyalty,
        pendingRoyalty: totalRoyalty - paidRoyalty,
      },
    };
  }
}
