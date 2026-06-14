// =============================================================================
// EUROTRIPS — Розрахунок комісій агентів
// BR-02: Комісія = basePrice × persons × rate (БЕЗ ДОПів)
// BR-05: network агент → окремо ЦО та роялті
// =============================================================================

import { Agent, AgentType } from '@prisma/client';

/** Округлення до 2 знаків після коми */
const r2 = (n: number): number => Math.round(n * 100) / 100;

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
  const base = basePrice * personsCount;
  const commissionRate = Number(agent.commissionPct);
  const grossAmount = r2(base * commissionRate);

  if (agent.agentType === AgentType.standard) {
    return {
      grossAmount,
      agentAmount: grossAmount,
      coAmount: null,
      royaltyAmount: null,
      commissionRate,
      agentType: AgentType.standard,
    };
  }

  // network агент — вираховуємо ЦО та роялті
  const coPct = Number(agent.coCommissionPct ?? 0);
  const royaltyPct = Number(agent.royaltyPct ?? 0);

  const coFraction = commissionRate === 0 ? 0 : coPct / commissionRate;
  const royaltyFraction = commissionRate === 0 ? 0 : royaltyPct / commissionRate;

  const coAmount = r2(grossAmount * coFraction);
  const royaltyAmount = r2(grossAmount * royaltyFraction);
  const agentAmount = r2(grossAmount - coAmount - royaltyAmount);

  return {
    grossAmount,
    agentAmount,
    coAmount,
    royaltyAmount,
    commissionRate,
    agentType: AgentType.network,
  };
}

/**
 * Форматує результат для відображення агенту в кабінеті.
 * BR-04: Агент бачить тільки свою частину, не ЦО та не роялті у деталях.
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
