// =============================================================================
// EUROTRIPS — Commission Calculation Unit Tests (BR-02, BR-05)
// =============================================================================

import { describe, it, expect } from 'vitest';
import { Prisma, AgentType } from '@prisma/client';
import { calculateCommission, formatCommissionForAgent } from './commission';

describe('calculateCommission — BR-02: рахується від basePrice × persons, НЕ від totalAmount', () => {
  it('standard: agentAmount = basePrice × persons × commissionPct', () => {
    const result = calculateCommission(1000, 4, {
      agentType: AgentType.standard,
      commissionPct: new Prisma.Decimal(0.15),
      coCommissionPct: null,
      royaltyPct: null,
    });

    // 1000 × 4 × 0.15 = 600
    expect(result.grossAmount).toBe(600);
    expect(result.agentAmount).toBe(600);
    expect(result.coAmount).toBeNull();
    expect(result.royaltyAmount).toBeNull();
    expect(result.agentType).toBe(AgentType.standard);
  });

  it('доплати/знижки/ДОПи НЕ впливають на комісію — функція взагалі не приймає totalAmount', () => {
    // Єдиний вхід ціни — basePrice. Той самий basePrice+persons завжди дає той
    // самий результат незалежно від того, скільки клієнт фактично доплатив.
    const agent = {
      agentType: AgentType.standard,
      commissionPct: new Prisma.Decimal(0.1),
      coCommissionPct: null,
      royaltyPct: null,
    };
    const r1 = calculateCommission(500, 2, agent);
    const r2 = calculateCommission(500, 2, agent);
    expect(r1.grossAmount).toBe(r2.grossAmount);
    expect(r1.grossAmount).toBe(100); // 500×2×0.1, без урахування будь-яких доплат
  });

  it('network: coAmount/royaltyAmount за формулою BR-05, agentAmount = gross − co − royalty', () => {
    // commissionPct=0.20, coCommissionPct=0.05, royaltyPct=0.03 (з 0.20 загальних)
    const result = calculateCommission(1000, 10, {
      agentType: AgentType.network,
      commissionPct: new Prisma.Decimal(0.2),
      coCommissionPct: new Prisma.Decimal(0.05),
      royaltyPct: new Prisma.Decimal(0.03),
    });

    // gross = 1000×10×0.2 = 2000
    expect(result.grossAmount).toBe(2000);
    // coAmount = gross × (0.05/0.2) = 2000 × 0.25 = 500
    expect(result.coAmount).toBe(500);
    // royaltyAmount = gross × (0.03/0.2) = 2000 × 0.15 = 300
    expect(result.royaltyAmount).toBe(300);
    // agentAmount = 2000 − 500 − 300 = 1200
    expect(result.agentAmount).toBe(1200);
    expect(result.agentType).toBe(AgentType.network);
  });

  it('network: commissionPct=0 не ділить на нуль — 0 без NaN/Infinity', () => {
    const result = calculateCommission(1000, 5, {
      agentType: AgentType.network,
      commissionPct: new Prisma.Decimal(0),
      coCommissionPct: new Prisma.Decimal(0.05),
      royaltyPct: new Prisma.Decimal(0.03),
    });

    expect(result.grossAmount).toBe(0);
    expect(result.coAmount).toBe(0);
    expect(result.royaltyAmount).toBe(0);
    expect(result.agentAmount).toBe(0);
    expect(Number.isNaN(result.coAmount)).toBe(false);
    expect(Number.isFinite(result.coAmount as number)).toBe(true);
  });

  it('network: coCommissionPct/royaltyPct відсутні (null) → трактуються як 0', () => {
    const result = calculateCommission(1000, 1, {
      agentType: AgentType.network,
      commissionPct: new Prisma.Decimal(0.1),
      coCommissionPct: null,
      royaltyPct: null,
    });

    expect(result.coAmount).toBe(0);
    expect(result.royaltyAmount).toBe(0);
    expect(result.agentAmount).toBe(result.grossAmount);
  });

  it('Decimal-точність: Prisma.Decimal коректно конвертується в number (округлення до 2 знаків)', () => {
    const result = calculateCommission(333.33, 3, {
      agentType: AgentType.standard,
      commissionPct: new Prisma.Decimal('0.125'),
      coCommissionPct: null,
      royaltyPct: null,
    });

    // 333.33 × 3 × 0.125 = 124.99875 → округлення до 124.99 або 125.00 (2 знаки)
    expect(result.grossAmount).toBeCloseTo(125.0, 2);
    expect(Number.isInteger(result.grossAmount * 100)).toBe(true); // рівно 2 знаки після коми
  });
});

describe('formatCommissionForAgent — BR-04: агент не бачить ЦО/роялті мережі напряму', () => {
  it('standard: без networkNote', () => {
    const result = calculateCommission(1000, 2, {
      agentType: AgentType.standard,
      commissionPct: new Prisma.Decimal(0.1),
      coCommissionPct: null,
      royaltyPct: null,
    });
    const formatted = formatCommissionForAgent(result);

    expect(formatted.label).toBe('Ваша комісія');
    expect(formatted.amount).toBe(result.agentAmount);
    expect(formatted.networkNote).toBeNull();
  });

  it('network: з networkNote, що показує лише суму (не формулу/proцент ЦО)', () => {
    const result = calculateCommission(1000, 2, {
      agentType: AgentType.network,
      commissionPct: new Prisma.Decimal(0.2),
      coCommissionPct: new Prisma.Decimal(0.05),
      royaltyPct: new Prisma.Decimal(0.03),
    });
    const formatted = formatCommissionForAgent(result);

    expect(formatted.amount).toBe(result.agentAmount);
    expect(formatted.networkNote).toContain(String(result.royaltyAmount));
  });
});
