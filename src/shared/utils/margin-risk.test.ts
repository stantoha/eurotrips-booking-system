// =============================================================================
// EUROTRIPS — Margin Risk Unit Tests (B1, CLAUDE.md §15)
// =============================================================================

import { describe, it, expect } from 'vitest';
import { checkMarginRisk } from './margin-risk';

describe('checkMarginRisk', () => {
  it('виявляє ризик коли комісія агента ≥ маржа оператора (реальний кейс Budapest+Vienna)', () => {
    // basePrice=1000, costPrice=855 → маржа = 14.5%, комісія 30% ≥ 14.5%
    const result = checkMarginRisk({ basePrice: 1000, costPrice: 855, agentCommissionPct: 0.3 });
    expect(result.marginPct).toBeCloseTo(0.145, 5);
    expect(result.isAtRisk).toBe(true);
  });

  it('НЕ виявляє ризик коли комісія менша за маржу', () => {
    // маржа = 40%, комісія 15% < 40%
    const result = checkMarginRisk({ basePrice: 1000, costPrice: 600, agentCommissionPct: 0.15 });
    expect(result.marginPct).toBeCloseTo(0.4, 5);
    expect(result.isAtRisk).toBe(false);
  });

  it('межовий випадок: комісія РІВНО дорівнює маржі → теж ризик (≥, не >)', () => {
    const result = checkMarginRisk({ basePrice: 1000, costPrice: 850, agentCommissionPct: 0.15 });
    expect(result.marginPct).toBeCloseTo(0.15, 5);
    expect(result.isAtRisk).toBe(true);
  });

  it('costPrice відсутній (null) — ризик не можна оцінити, isAtRisk=false, marginPct=null', () => {
    const result = checkMarginRisk({ basePrice: 1000, costPrice: null, agentCommissionPct: 0.3 });
    expect(result.isAtRisk).toBe(false);
    expect(result.marginPct).toBeNull();
  });

  it('basePrice = 0 не ділить на нуль — isAtRisk=false, marginPct=null', () => {
    const result = checkMarginRisk({ basePrice: 0, costPrice: 100, agentCommissionPct: 0.3 });
    expect(result.isAtRisk).toBe(false);
    expect(result.marginPct).toBeNull();
    expect(Number.isNaN(result.marginPct)).toBe(false);
  });

  it('costPrice > basePrice (від\'ємна маржа) — комісія > 0 завжди ризик', () => {
    const result = checkMarginRisk({ basePrice: 500, costPrice: 600, agentCommissionPct: 0.1 });
    expect(result.marginPct).toBeLessThan(0);
    expect(result.isAtRisk).toBe(true);
  });

  it('costPrice = 0 (маржа 100%) — ризику немає при звичайних комісіях', () => {
    const result = checkMarginRisk({ basePrice: 1000, costPrice: 0, agentCommissionPct: 0.3 });
    expect(result.marginPct).toBe(1);
    expect(result.isAtRisk).toBe(false);
  });
});
