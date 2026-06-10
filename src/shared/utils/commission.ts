// =============================================================================
// EUROTRIPS — Розрахунок комісій агентів
// BR-02: Комісія = basePrice × persons × rate (БЕЗ ДОПів)
// BR-05: network агент → окремо ЦО та роялті
// =============================================================================

import { Agent, AgentType } from '@prisma/client';
import Decimal from 'decimal.js';

export interface CommissionResult {
  /** Загальна валова комісія (EUR) */
  grossAmount: number;
  /** Сума до виплати агенту (EUR) */
  agentAmount: number;
  /** Сума до ЦО мережі (NULL для standard) */
  coAmount: number | null;
  /** Сума роялті (NULL для standard) */
  royaltyAmount: number | null;
  /** Ставка комісії */
  commissionRate: number;
  agentType: AgentType;
}

/**
 * Розраховує комісію агента.
 *
 * @param basePrice - Базова ціна туру (EUR, без ДОПів)
 * @param personsCount - Кількість туристів
 * @param agent - Повна модель агента
 */
export function calculateCommission(
  basePrice: number,
  personsCount: number,
  agent: Pick<Agent, 'agentType' | 'commissionPct' | 'coCommissionPct' | 'royaltyPct'>
): CommissionResult {
  const base = new Decimal(basePrice).mul(personsCount);
  const commissionRate = new Decimal(agent.commissionPct.toString());

  const grossAmount = base.mul(commissionRate);

  if (agent.agentType === AgentType.standard) {
    return {
      grossAmount: grossAmount.toDecimalPlaces(2).toNumber(),
      agentAmount: grossAmount.toDecimalPlaces(2).toNumber(),
      coAmount: null,
      royaltyAmount: null,
      commissionRate: Number(agent.commissionPct),
      agentType: AgentType.standard,
    };
  }

  // network агент — вираховуємо ЦО та роялті
  const coPct = new Decimal(agent.coCommissionPct?.toString() ?? '0');
  const royaltyPct = new Decimal(agent.royaltyPct?.toString() ?? '0');

  // coAmount та royaltyAmount як частки від grossAmount
  const coFraction = commissionRate.eq(0) ? new Decimal(0) : coPct.div(commissionRate);
  const royaltyFraction = commissionRate.eq(0) ? new Decimal(0) : royaltyPct.div(commissionRate);

  const coAmount = grossAmount.mul(coFraction).toDecimalPlaces(2);
  const royaltyAmount = grossAmount.mul(royaltyFraction).toDecimalPlaces(2);
  const agentAmount = grossAmount.minus(coAmount).minus(royaltyAmount).toDecimalPlaces(2);

  return {
    grossAmount: grossAmount.toDecimalPlaces(2).toNumber(),
    agentAmount: agentAmount.toNumber(),
    coAmount: coAmount.toNumber(),
    royaltyAmount: royaltyAmount.toNumber(),
    commissionRate: Number(agent.commissionPct),
    agentType: AgentType.network,
  };
}

/**
 * Форматує результат для відображення агенту в кабінеті.
 * BR-04: Agент бачить тільки свою частину, не ЦО та не роялті у деталях.
 */
export function formatCommissionForAgent(result: CommissionResult): {
  label: string;
  amount: number;
  networkNote: string | null;
} {
  if (result.agentType === AgentType.standard) {
    return {
      label: 'Ваша комісія',
      amount: result.agentAmount,
      networkNote: null,
    };
  }

  return {
    label: 'Ваша комісія (агентська частина)',
    amount: result.agentAmount,
    networkNote: `Мережева комісія: ${result.royaltyAmount} EUR (за умовами договору з мережею)`,
  };
}
