// =============================================================================
// EUROTRIPS — Перевірка ризику негативної маржі (CLAUDE.md §15)
// Відома знахідка: тур Budapest+Vienna мав комісію агента 30% при маржі
// оператора 14.5% → потенційно збитковий P&L. Не блокуємо створення/
// оновлення туру — лише попереджаємо (meta.warnings) і логуємо.
// =============================================================================

export const NEGATIVE_MARGIN_RISK = 'NEGATIVE_MARGIN_RISK';

export interface MarginRiskInput {
  basePrice: number;
  /** null якщо собівартість ще не заповнена — ризик тоді нерозрахований */
  costPrice: number | null;
  agentCommissionPct: number;
}

export interface MarginRiskResult {
  isAtRisk: boolean;
  /** Маржа оператора у частках (0.145 = 14.5%). null якщо costPrice відсутній. */
  marginPct: number | null;
}

/**
 * Ризик: комісія агента (від basePrice) ≥ маржа оператора (basePrice−costPrice)/basePrice.
 * Якщо costPrice ще не вказано — оцінити ризик неможливо (isAtRisk: false).
 */
export function checkMarginRisk({
  basePrice,
  costPrice,
  agentCommissionPct,
}: MarginRiskInput): MarginRiskResult {
  if (costPrice === null || costPrice === undefined || basePrice <= 0) {
    return { isAtRisk: false, marginPct: null };
  }

  const marginPct = (basePrice - costPrice) / basePrice;
  return { isAtRisk: agentCommissionPct >= marginPct, marginPct };
}
