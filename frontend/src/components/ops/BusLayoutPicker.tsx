// ============================================================
// EUROTRIPS — BusLayoutPicker Component
// Вибір сімейства схеми розсадки (OPS-03). Прев'ю кожної схеми —
// мініатюрний рендер перших рядів через ту саму generateBusLayout,
// щоб мініатюра завжди відповідала реальному вигляду.
// ============================================================

import React from 'react';
import { Check } from 'lucide-react';
import {
  BUS_LAYOUT_FAMILIES, generateBusLayout, type BusLayoutFamilyKey,
} from '../../data/busLayoutTemplates';

export interface BusLayoutPickerProps {
  totalSeats: number;
  value: BusLayoutFamilyKey;
  onChange: (family: BusLayoutFamilyKey) => void;
  className?: string;
}

const MiniPreview: React.FC<{ totalSeats: number; family: BusLayoutFamilyKey }> = ({ totalSeats, family }) => {
  const layout = generateBusLayout(totalSeats, family);
  const previewRows = layout.sections.flatMap((s) => s.rows).slice(0, 4);
  return (
    <div className="flex flex-col gap-0.5">
      {previewRows.map((row, i) => (
        <div key={i} className="flex items-center gap-0.5">
          {row.map((slot, j) => (
            <div
              key={j}
              className={
                slot.kind === 'seat'
                  ? 'w-2 h-2 rounded-[2px] bg-brand-cyan/50'
                  : slot.kind === 'aisle' || slot.kind === 'gap'
                  ? 'w-1 h-2'
                  : 'w-2 h-2 rounded-[2px] bg-slate-300 dark:bg-slate-600'
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export const BusLayoutPicker: React.FC<BusLayoutPickerProps> = ({ totalSeats, value, onChange, className = '' }) => {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 ${className}`}>
      {BUS_LAYOUT_FAMILIES.map((fam) => {
        const active = fam.key === value;
        return (
          <button
            key={fam.key}
            type="button"
            onClick={() => onChange(fam.key)}
            title={fam.description}
            className={`
              relative text-left p-2.5 rounded-lg border transition-colors
              ${active
                ? 'border-brand-cyan bg-brand-cyan/5 dark:bg-brand-cyan/10'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}
            `}
          >
            {active && (
              <span className="absolute top-1.5 right-1.5 text-brand-cyan-dark dark:text-brand-cyan">
                <Check size={13} aria-hidden="true" />
              </span>
            )}
            <MiniPreview totalSeats={totalSeats} family={fam.key} />
            <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 mt-2">{fam.label}</p>
          </button>
        );
      })}
    </div>
  );
};

export default BusLayoutPicker;
