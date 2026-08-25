// ============================================================
// EUROTRIPS — AddonBridge Component (OPS)
// Звірка проданих туристам допуслуг (ДОП) із замовленими в
// постачальника. Рядок, де продано > замовлено, тінтується — це
// той баг, який компонент існує, щоб ловити: постачальник ще не
// знає про частину проданих місць.
//
// AddonMatrix відповідає на «хто що купив», AddonBridge — на
// «чи все це замовлено». В кабінеті агента НЕ показується (BR-04).
//
// Презентаційний компонент. Як і AddonMatrix, чекає на backend:
// tour_extras описує лише витрати туру, без розрізнення
// «продано туристам» vs «замовлено в постачальника».
// ============================================================

import React from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '../ui/Button';

export type AddonBridgeStatus = 'pending' | 'ordered' | 'confirmed' | 'paid' | 'failed';

export interface AddonBridgeRow {
  id: string;
  label: string;
  /** Продано туристам */
  sold: number;
  /** Замовлено в постачальника */
  ordered: number;
  supplier?: string | null;
  /** Дедлайн замовлення в постачальника, ISO */
  deadline?: string | null;
  /** Ціна за одиницю, EUR */
  price?: number | null;
  status: AddonBridgeStatus;
}

export interface AddonBridgeProps {
  rows: AddonBridgeRow[];
  /** BR-04: false на будь-якій поверхні для агента */
  showRevenue?: boolean;
  /** Лише ops_manager / admin */
  canEdit?: boolean;
  onOrder?: (id: string, quantity: number) => void;
  emptyLabel?: string;
  orderLabel?: string;
  className?: string;
}

const STATUS_CONFIG: Record<AddonBridgeStatus, { label: string; cls: string }> = {
  pending:   { label: 'Не замовлено', cls: 'bg-status-neutral-bg text-status-neutral-fg border-status-neutral-border' },
  ordered:   { label: 'Замовлено',    cls: 'bg-status-info-bg text-status-info-fg border-status-info-border' },
  confirmed: { label: 'Підтверджено', cls: 'bg-status-success-bg text-status-success-fg border-status-success-border' },
  paid:      { label: 'Оплачено',     cls: 'bg-status-success-bg text-status-success-fg border-status-success-border' },
  failed:    { label: 'Відмова',      cls: 'bg-status-danger-bg text-status-danger-fg border-status-danger-border' },
};

export const ADDON_BRIDGE_STATUSES = Object.keys(STATUS_CONFIG) as AddonBridgeStatus[];

const money = (n: number) => Number(n).toLocaleString('uk-UA');
const formatDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('uk-UA') : null);

const GRID = 'grid grid-cols-[1fr_78px_92px_1fr_auto] gap-3 items-center';

export const AddonBridge: React.FC<AddonBridgeProps> = ({
  rows = [], showRevenue = true, canEdit = false, onOrder,
  emptyLabel = 'На цей виїзд допуслуги не продавалися.',
  orderLabel = 'Замовити', className = '',
}) => {
  if (rows.length === 0) {
    return <p className="text-sm text-content-tertiary py-6">{emptyLabel}</p>;
  }

  const gapOf = (r: AddonBridgeRow) => Math.max(0, r.sold - r.ordered);
  const totalGap = rows.reduce((sum, r) => sum + gapOf(r), 0);
  const revenue = rows.reduce((sum, r) => sum + (r.price ?? 0) * r.sold, 0);

  return (
    <div className={`border border-line rounded-panel overflow-hidden ${className}`.trim()}>
      {/* Головний сигнал компонента */}
      {totalGap > 0 && (
        <div className="flex items-start gap-2 px-4 py-2.5 bg-status-danger-bg border-b border-status-danger-border">
          <TriangleAlert size={15} className="text-status-danger shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-status-danger-fg">
            Незамовлених місць: <b className="font-mono">{totalGap}</b> — постачальники ще не знають про частину проданих допуслуг.
          </p>
        </div>
      )}

      <div className={`${GRID} px-4 py-2 bg-surface-2 text-micro uppercase tracking-eyebrow font-semibold text-content-tertiary`}>
        <span>Допуслуга</span>
        <span className="text-right">Продано</span>
        <span className="text-right">Замовлено</span>
        <span>Постачальник</span>
        <span>Статус</span>
      </div>

      {rows.map((r) => {
        const gap = gapOf(r);
        const status = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
        return (
          <div
            key={r.id}
            className={`${GRID} px-4 py-2.5 border-b border-line last:border-b-0 text-sm ${gap > 0 ? 'bg-status-danger-bg/40' : ''}`}
          >
            <div className="min-w-0">
              <p className="text-content-primary truncate">{r.label}</p>
              {showRevenue && r.price != null && (
                <p className="text-caption text-content-tertiary font-mono">
                  {money(r.price)} EUR × {r.sold} = {money(r.price * r.sold)} EUR
                </p>
              )}
            </div>

            <span className="font-mono text-right text-content-primary">{r.sold}</span>

            <span className={`font-mono text-right ${gap > 0 ? 'text-status-danger-fg font-semibold' : 'text-content-primary'}`}>
              {r.ordered}
              {gap > 0 && <em className="not-italic text-caption ml-1">−{gap}</em>}
            </span>

            <div className="min-w-0">
              <p className="text-content-secondary truncate">{r.supplier || '—'}</p>
              {r.deadline && <p className="text-caption text-content-tertiary">до {formatDate(r.deadline)}</p>}
            </div>

            <div className="flex items-center gap-2 justify-end">
              <span className={`text-caption font-medium px-2 py-0.5 rounded-pill border whitespace-nowrap ${status.cls}`}>
                {status.label}
              </span>
              {canEdit && gap > 0 && onOrder && (
                <Button size="xs" variant="secondary" onClick={() => onOrder(r.id, gap)}>
                  {orderLabel} {gap}
                </Button>
              )}
            </div>
          </div>
        );
      })}

      {showRevenue && (
        <div className="flex flex-wrap items-baseline gap-x-3 px-4 py-2.5 bg-surface-2 text-sm">
          <span className="text-content-secondary">Разом продано допуслуг</span>
          <b className="font-mono text-content-primary">{money(revenue)} EUR</b>
          {/* BR-02: комісія агента рахується лише від базової ціни туру */}
          <em className="not-italic text-caption text-content-tertiary">не входить у комісію агента (BR-02)</em>
        </div>
      )}
    </div>
  );
};

export default AddonBridge;
